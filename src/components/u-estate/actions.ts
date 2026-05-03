"use client";

import {
  isAddress,
  parseEventLogs,
  type Address,
  type Hex,
} from "viem";
import { useConfig, useReadContract, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { sepolia } from "wagmi/chains";
import { primaryValueSaleAbi } from "@/lib/contracts/primary-value-sale";
import {
  propertyRegistryAbi,
  propertyRegistryAddress,
} from "@/lib/contracts/property-registry";
import { parseDecimalToUnits } from "@/lib/safe-decimal";
import type { SavedPropertyRecord } from "@/offchain/schemas";
import { patchOnchainSync } from "./onchain";
import type { PropertyDocument, TxStep } from "./types";
import type { WalletState } from "./wallet";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export type NewPropertyForm = {
  marketValueEth: string;
  reservedPct: number;
  description: string;
  street: string;
  number: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  lat: string;
  lng: string;
  documents: PropertyDocument[];
};

export type StepCb = (step: TxStep) => void;

export type UEstateActions = {
  /** True when the env var + wallet + chain are all set up to send transactions. */
  ready: boolean;
  primaryValueSaleAddress: Address | undefined;
  registryAddress: Address | undefined;
  /** Persist the draft and register on-chain. Returns the updated record. */
  submitProperty: (
    form: NewPropertyForm,
    onStep: StepCb,
  ) => Promise<SavedPropertyRecord>;
  mockVerify: (
    localPropertyId: string,
    onchainPropertyId: string,
    onStep: StepCb,
  ) => Promise<SavedPropertyRecord>;
  tokenize: (
    localPropertyId: string,
    onchainPropertyId: string,
    onStep: StepCb,
  ) => Promise<SavedPropertyRecord>;
  publishListing: (
    localPropertyId: string,
    onchainPropertyId: string,
    units: number,
    onStep: StepCb,
  ) => Promise<SavedPropertyRecord>;
  buyListing: (
    localPropertyId: string,
    listingId: string,
    priceWei: bigint,
    onStep: StepCb,
  ) => Promise<SavedPropertyRecord>;
  cancelListing: (
    localPropertyId: string,
    listingId: string,
    onStep: StepCb,
  ) => Promise<SavedPropertyRecord>;
};

export function useUEstateActions(wallet: WalletState): UEstateActions {
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();
  const { data: registryPrimaryValueSale } = useReadContract({
    address: propertyRegistryAddress,
    abi: propertyRegistryAbi,
    functionName: "primaryValueSale",
    chainId: sepolia.id,
    query: { enabled: Boolean(propertyRegistryAddress) },
  });

  const primaryValueSaleAddress: Address | undefined =
    registryPrimaryValueSale &&
    isAddress(registryPrimaryValueSale) &&
    registryPrimaryValueSale !== ZERO_ADDRESS
      ? (registryPrimaryValueSale as Address)
      : undefined;

  const ready = Boolean(
    wallet.canTransact && propertyRegistryAddress && wallet.address,
  );

  const requireReady = () => {
    if (!wallet.address || !wallet.isConnected) {
      throw new Error("Conecte uma carteira antes de continuar.");
    }
    if (!wallet.onSepolia) {
      throw new Error("Troque a carteira para a rede Sepolia.");
    }
    if (!propertyRegistryAddress) {
      throw new Error(
        "NEXT_PUBLIC_PROPERTY_REGISTRY_ADDRESS não está configurado.",
      );
    }
  };

  const requirePrimarySale = () => {
    if (!primaryValueSaleAddress) {
      throw new Error(
        "PrimaryValueSale ainda não está disponível na configuração do Registry.",
      );
    }
  };

  const submitProperty: UEstateActions["submitProperty"] = async (
    form,
    onStep,
  ) => {
    requireReady();
    onStep("sign");

    const linkedValueBps = Math.round(form.reservedPct * 100);
    const lat = form.lat.trim() || "0";
    const lng = form.lng.trim() || "0";

    const draftResponse = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerWallet: wallet.address,
        marketValueEth: form.marketValueEth,
        linkedValueBps,
        description: form.description || undefined,
        street: form.street,
        number: form.number,
        city: form.city,
        state: form.state,
        country: form.country || "Brasil",
        postalCode: form.postalCode || "00000-000",
        lat,
        lng,
        documents:
          form.documents.length > 0
            ? form.documents
            : [{ type: "mock_deed", filename: "matricula.pdf" }],
      }),
    });
    const draftPayload = (await draftResponse.json()) as
      | { record: SavedPropertyRecord }
      | { error: string };
    if (!draftResponse.ok || !("record" in draftPayload)) {
      throw new Error(
        "error" in draftPayload
          ? draftPayload.error
          : "Falha ao salvar o rascunho.",
      );
    }
    const draft = draftPayload.record;

    const txHash = await writeContractAsync({
      address: propertyRegistryAddress as Address,
      abi: propertyRegistryAbi,
      functionName: "registerProperty",
      args: [
        BigInt(draft.marketValueWei),
        draft.linkedValueBps,
        draft.metadataHash as Hex,
        draft.documentsHash as Hex,
        draft.locationHash as Hex,
      ],
      chainId: sepolia.id,
    });

    onStep("sent");
    onStep("confirming");

    const receipt = await waitForTransactionReceipt(config, {
      hash: txHash,
      chainId: sepolia.id,
    });
    const [registeredLog] = parseEventLogs({
      abi: propertyRegistryAbi,
      eventName: "PropertyRegistered",
      logs: receipt.logs,
      strict: true,
    });
    if (!registeredLog) {
      throw new Error(
        "Tx confirmada, mas o evento PropertyRegistered não foi encontrado.",
      );
    }

    const record = await patchOnchainSync({
      kind: "registration",
      localPropertyId: draft.localPropertyId,
      propertyId: registeredLog.args.propertyId.toString(),
      txHash: receipt.transactionHash,
    });

    onStep("done");
    return record;
  };

  const mockVerify: UEstateActions["mockVerify"] = async (
    localPropertyId,
    onchainPropertyId,
    onStep,
  ) => {
    requireReady();
    onStep("sign");
    const txHash = await writeContractAsync({
      address: propertyRegistryAddress as Address,
      abi: propertyRegistryAbi,
      functionName: "mockVerifyProperty",
      args: [BigInt(onchainPropertyId)],
      chainId: sepolia.id,
    });
    onStep("sent");
    onStep("confirming");
    const receipt = await waitForTransactionReceipt(config, {
      hash: txHash,
      chainId: sepolia.id,
    });
    const [verifiedLog] = parseEventLogs({
      abi: propertyRegistryAbi,
      eventName: "PropertyMockVerified",
      logs: receipt.logs,
      strict: true,
    });
    if (!verifiedLog) {
      throw new Error(
        "Tx confirmada, mas o evento PropertyMockVerified não foi encontrado.",
      );
    }
    const record = await patchOnchainSync({
      kind: "mockVerification",
      localPropertyId,
      propertyId: verifiedLog.args.propertyId.toString(),
      txHash: receipt.transactionHash,
    });
    onStep("done");
    return record;
  };

  const tokenize: UEstateActions["tokenize"] = async (
    localPropertyId,
    onchainPropertyId,
    onStep,
  ) => {
    requireReady();
    onStep("sign");
    const txHash = await writeContractAsync({
      address: propertyRegistryAddress as Address,
      abi: propertyRegistryAbi,
      functionName: "tokenizeProperty",
      args: [BigInt(onchainPropertyId)],
      chainId: sepolia.id,
    });
    onStep("sent");
    onStep("confirming");
    const receipt = await waitForTransactionReceipt(config, {
      hash: txHash,
      chainId: sepolia.id,
    });
    const [tokenizedLog] = parseEventLogs({
      abi: propertyRegistryAbi,
      eventName: "PropertyTokenized",
      logs: receipt.logs,
      strict: true,
    });
    const [valueTokenLog] = parseEventLogs({
      abi: propertyRegistryAbi,
      eventName: "PropertyValueTokenCreated",
      logs: receipt.logs,
      strict: true,
    });
    if (!tokenizedLog || !valueTokenLog) {
      throw new Error(
        "Tx confirmada, mas os eventos de tokenização não foram encontrados.",
      );
    }
    const record = await patchOnchainSync({
      kind: "tokenization",
      localPropertyId,
      propertyId: tokenizedLog.args.propertyId.toString(),
      txHash: receipt.transactionHash,
      valueTokenAddress: valueTokenLog.args.valueToken,
      usufructTokenId: tokenizedLog.args.tokenId.toString(),
      linkedValueUnits: tokenizedLog.args.linkedValueUnits.toString(),
      freeValueUnits: tokenizedLog.args.freeValueUnits.toString(),
    });
    onStep("done");
    return record;
  };

  const publishListing: UEstateActions["publishListing"] = async (
    localPropertyId,
    onchainPropertyId,
    units,
    onStep,
  ) => {
    requireReady();
    requirePrimarySale();
    onStep("sign");
    const txHash = await writeContractAsync({
      address: primaryValueSaleAddress as Address,
      abi: primaryValueSaleAbi,
      functionName: "createPrimarySaleListing",
      args: [BigInt(onchainPropertyId), BigInt(units)],
      chainId: sepolia.id,
    });
    onStep("sent");
    onStep("confirming");
    const receipt = await waitForTransactionReceipt(config, {
      hash: txHash,
      chainId: sepolia.id,
    });
    const [listedLog] = parseEventLogs({
      abi: primaryValueSaleAbi,
      eventName: "PrimarySaleListed",
      logs: receipt.logs,
      strict: true,
    });
    if (!listedLog) {
      throw new Error(
        "Tx confirmada, mas o evento PrimarySaleListed não foi encontrado.",
      );
    }
    const record = await patchOnchainSync({
      kind: "primarySaleListing",
      localPropertyId,
      propertyId: listedLog.args.propertyId.toString(),
      listingId: listedLog.args.listingId.toString(),
      txHash: receipt.transactionHash,
      amount: listedLog.args.amount.toString(),
      priceWei: listedLog.args.priceWei.toString(),
    });
    onStep("done");
    return record;
  };

  const buyListing: UEstateActions["buyListing"] = async (
    localPropertyId,
    listingId,
    priceWei,
    onStep,
  ) => {
    requireReady();
    requirePrimarySale();
    onStep("sign");
    const txHash = await writeContractAsync({
      address: primaryValueSaleAddress as Address,
      abi: primaryValueSaleAbi,
      functionName: "buyPrimarySaleListing",
      args: [BigInt(listingId)],
      value: priceWei,
      chainId: sepolia.id,
    });
    onStep("sent");
    onStep("confirming");
    const receipt = await waitForTransactionReceipt(config, {
      hash: txHash,
      chainId: sepolia.id,
    });
    const [purchasedLog] = parseEventLogs({
      abi: primaryValueSaleAbi,
      eventName: "PrimarySalePurchased",
      logs: receipt.logs,
      strict: true,
    });
    if (!purchasedLog) {
      throw new Error(
        "Tx confirmada, mas o evento PrimarySalePurchased não foi encontrado.",
      );
    }
    const record = await patchOnchainSync({
      kind: "primarySalePurchase",
      localPropertyId,
      propertyId: purchasedLog.args.propertyId.toString(),
      listingId: purchasedLog.args.listingId.toString(),
      txHash: receipt.transactionHash,
      buyerWallet: purchasedLog.args.buyer,
      amount: purchasedLog.args.amount.toString(),
      priceWei: purchasedLog.args.priceWei.toString(),
    });
    onStep("done");
    return record;
  };

  const cancelListing: UEstateActions["cancelListing"] = async (
    localPropertyId,
    listingId,
    onStep,
  ) => {
    requireReady();
    requirePrimarySale();
    onStep("sign");
    const txHash = await writeContractAsync({
      address: primaryValueSaleAddress as Address,
      abi: primaryValueSaleAbi,
      functionName: "cancelPrimarySaleListing",
      args: [BigInt(listingId)],
      chainId: sepolia.id,
    });
    onStep("sent");
    onStep("confirming");
    const receipt = await waitForTransactionReceipt(config, {
      hash: txHash,
      chainId: sepolia.id,
    });
    const [cancelledLog] = parseEventLogs({
      abi: primaryValueSaleAbi,
      eventName: "PrimarySaleCancelled",
      logs: receipt.logs,
      strict: true,
    });
    if (!cancelledLog) {
      throw new Error(
        "Tx confirmada, mas o evento PrimarySaleCancelled não foi encontrado.",
      );
    }
    const record = await patchOnchainSync({
      kind: "primarySaleCancellation",
      localPropertyId,
      propertyId: cancelledLog.args.propertyId.toString(),
      listingId: cancelledLog.args.listingId.toString(),
      txHash: receipt.transactionHash,
      amount: cancelledLog.args.amount.toString(),
    });
    onStep("done");
    return record;
  };

  return {
    ready,
    primaryValueSaleAddress,
    registryAddress: propertyRegistryAddress,
    submitProperty,
    mockVerify,
    tokenize,
    publishListing,
    buyListing,
    cancelListing,
  };
}

export function ethToWei(eth: string): bigint {
  return parseDecimalToUnits(eth, 18);
}
