"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { isAddress, parseEventLogs, type Address, type Hex } from "viem";
import { sepolia } from "wagmi/chains";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { WalletPanel } from "@/components/wallet-panel";
import { primaryValueSaleAbi } from "@/lib/contracts/primary-value-sale";
import {
  propertyRegistryAbi,
  propertyRegistryAddress,
} from "@/lib/contracts/property-registry";
import {
  divideDecimalStrings,
  formatDecimalForDisplay,
  multiplyDecimalStrings,
  parseDecimalToUnits,
  scaleBpsToPercent,
  weiToEthDecimalString,
} from "@/lib/safe-decimal";
import { buildPropertyDraftPreview } from "@/offchain/property-draft";
import type {
  FiatRatesResponse,
  FiatRatesSuccessResponse,
  MockDocumentInput,
  MockDocumentType,
  PropertyDraftInput,
  PropertyDraftPreview,
  SavedPropertyRecord,
} from "@/offchain/schemas";

type PropertyWorkbenchProps = {
  initialProperties: SavedPropertyRecord[];
};

type FormState = Omit<PropertyDraftInput, "ownerWallet" | "localPropertyId">;

type PricingPreview = {
  marketValueEth: string;
  listedUnits: string;
  listedPercent: string;
  offerPriceEth: string;
  unitPriceEth: string;
};

type PurchaseTarget = {
  listingId: string;
  localPropertyId: string;
};

const TOTAL_VALUE_UNITS = "1000000";
const initialDocuments: MockDocumentInput[] = [
  {
    type: "mock_deed",
    filename: "mock_matricula.pdf",
  },
  {
    type: "mock_owner_id",
    filename: "mock_owner_id.pdf",
  },
];
const initialFormState: FormState = {
  marketValueEth: "10",
  linkedValueBps: 2000,
  description: "Garden-facing townhouse prepared for the local MVP demo.",
  street: "Rua Haddock Lobo",
  number: "595",
  city: "Sao Paulo",
  state: "SP",
  country: "Brazil",
  postalCode: "01414-001",
  lat: "-23.561414",
  lng: "-46.656632",
  documents: initialDocuments,
};

export function PropertyWorkbench({
  initialProperties,
}: PropertyWorkbenchProps) {
  const { address, chainId, isConnected } = useAccount();
  const { writeContractAsync, isPending: isRegisteringOnchain } = useWriteContract();
  const { writeContractAsync: writeMockVerificationAsync, isPending: isSubmittingMockVerification } =
    useWriteContract();
  const { writeContractAsync: writeTokenizationAsync, isPending: isSubmittingTokenization } =
    useWriteContract();
  const {
    writeContractAsync: writePrimarySaleListingAsync,
    isPending: isSubmittingPrimarySaleListing,
  } = useWriteContract();
  const {
    writeContractAsync: writePrimarySalePurchaseAsync,
    isPending: isSubmittingPrimarySalePurchase,
  } = useWriteContract();
  const { data: configuredPrimaryValueSaleAddress } = useReadContract({
    address: propertyRegistryAddress,
    abi: propertyRegistryAbi,
    functionName: "primaryValueSale",
    query: {
      enabled: Boolean(propertyRegistryAddress),
    },
  });
  const [draftLocalId, setDraftLocalId] = useState(() => crypto.randomUUID());
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [listedUnits] = useState("300000");
  const [saleAmountByLocalPropertyId, setSaleAmountByLocalPropertyId] =
    useState<Record<string, string>>({});
  const [properties, setProperties] =
    useState<SavedPropertyRecord[]>(initialProperties);
  const [lastSaved, setLastSaved] = useState<SavedPropertyRecord | null>(
    initialProperties[0] ?? null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [fiatRates, setFiatRates] = useState<FiatRatesSuccessResponse | null>(
    null,
  );
  const [fiatErrorMessage, setFiatErrorMessage] = useState<string | null>(null);
  const [isLoadingFiatRates, setIsLoadingFiatRates] = useState(true);
  const [registeringLocalPropertyId, setRegisteringLocalPropertyId] = useState<
    string | null
  >(null);
  const [submittedRegistrationHash, setSubmittedRegistrationHash] =
    useState<Hex | null>(null);
  const [processedRegistrationHash, setProcessedRegistrationHash] =
    useState<Hex | null>(null);
  const [registrationErrorMessage, setRegistrationErrorMessage] = useState<
    string | null
  >(null);
  const [registrationNotice, setRegistrationNotice] = useState<string | null>(
    null,
  );
  const [verifyingLocalPropertyId, setVerifyingLocalPropertyId] = useState<
    string | null
  >(null);
  const [submittedVerificationHash, setSubmittedVerificationHash] =
    useState<Hex | null>(null);
  const [processedVerificationHash, setProcessedVerificationHash] =
    useState<Hex | null>(null);
  const [verificationErrorMessage, setVerificationErrorMessage] = useState<
    string | null
  >(null);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(
    null,
  );
  const [tokenizingLocalPropertyId, setTokenizingLocalPropertyId] = useState<
    string | null
  >(null);
  const [submittedTokenizationHash, setSubmittedTokenizationHash] =
    useState<Hex | null>(null);
  const [processedTokenizationHash, setProcessedTokenizationHash] =
    useState<Hex | null>(null);
  const [tokenizationErrorMessage, setTokenizationErrorMessage] = useState<
    string | null
  >(null);
  const [tokenizationNotice, setTokenizationNotice] = useState<string | null>(
    null,
  );
  const [listingLocalPropertyId, setListingLocalPropertyId] = useState<
    string | null
  >(null);
  const [submittedListingHash, setSubmittedListingHash] = useState<Hex | null>(
    null,
  );
  const [processedListingHash, setProcessedListingHash] = useState<Hex | null>(
    null,
  );
  const [listingErrorMessage, setListingErrorMessage] = useState<string | null>(
    null,
  );
  const [listingNotice, setListingNotice] = useState<string | null>(null);
  const [purchaseTarget, setPurchaseTarget] = useState<PurchaseTarget | null>(
    null,
  );
  const [submittedPurchaseHash, setSubmittedPurchaseHash] = useState<Hex | null>(
    null,
  );
  const [processedPurchaseHash, setProcessedPurchaseHash] = useState<Hex | null>(
    null,
  );
  const [purchaseErrorMessage, setPurchaseErrorMessage] = useState<string | null>(
    null,
  );
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null);
  const {
    data: registrationReceipt,
    error: registrationReceiptError,
    isLoading: isConfirmingRegistration,
  } = useWaitForTransactionReceipt({
    chainId: sepolia.id,
    hash: submittedRegistrationHash ?? undefined,
    query: {
      enabled: Boolean(submittedRegistrationHash),
    },
  });
  const {
    data: verificationReceipt,
    error: verificationReceiptError,
    isLoading: isConfirmingVerification,
  } = useWaitForTransactionReceipt({
    chainId: sepolia.id,
    hash: submittedVerificationHash ?? undefined,
    query: {
      enabled: Boolean(submittedVerificationHash),
    },
  });
  const {
    data: tokenizationReceipt,
    error: tokenizationReceiptError,
    isLoading: isConfirmingTokenization,
  } = useWaitForTransactionReceipt({
    chainId: sepolia.id,
    hash: submittedTokenizationHash ?? undefined,
    query: {
      enabled: Boolean(submittedTokenizationHash),
    },
  });
  const {
    data: listingReceipt,
    error: listingReceiptError,
    isLoading: isConfirmingListing,
  } = useWaitForTransactionReceipt({
    chainId: sepolia.id,
    hash: submittedListingHash ?? undefined,
    query: {
      enabled: Boolean(submittedListingHash),
    },
  });
  const {
    data: purchaseReceipt,
    error: purchaseReceiptError,
    isLoading: isConfirmingPurchase,
  } = useWaitForTransactionReceipt({
    chainId: sepolia.id,
    hash: submittedPurchaseHash ?? undefined,
    query: {
      enabled: Boolean(submittedPurchaseHash),
    },
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadFiatRates() {
      try {
        setIsLoadingFiatRates(true);
        setFiatErrorMessage(null);

        const response = await fetch("/api/fiat-rates", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as FiatRatesResponse;

        if (!response.ok || !payload.ok) {
          throw new Error(
            payload.ok ? "Could not load fiat rates." : payload.message,
          );
        }

        setFiatRates(payload);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setFiatRates(null);
        setFiatErrorMessage(
          error instanceof Error
            ? error.message
            : "Could not load fiat rates.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingFiatRates(false);
        }
      }
    }

    void loadFiatRates();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (
      !registrationReceipt ||
      !registeringLocalPropertyId ||
      processedRegistrationHash === registrationReceipt.transactionHash
    ) {
      return;
    }

    void (async () => {
      try {
        setProcessedRegistrationHash(registrationReceipt.transactionHash);

        const [propertyRegisteredLog] = parseEventLogs({
          abi: propertyRegistryAbi,
          eventName: "PropertyRegistered",
          logs: registrationReceipt.logs,
          strict: true,
        });

        if (!propertyRegisteredLog) {
          throw new Error(
            "Transaction confirmed, but PropertyRegistered event was not found.",
          );
        }

        const response = await fetch("/api/properties", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            kind: "registration",
            localPropertyId: registeringLocalPropertyId,
            propertyId: propertyRegisteredLog.args.propertyId.toString(),
            txHash: registrationReceipt.transactionHash,
          }),
        });

        const payload = (await response.json()) as
          | { record: SavedPropertyRecord }
          | { error: string };

        if (!response.ok || !("record" in payload)) {
          throw new Error(
            "error" in payload
              ? payload.error
              : "Could not persist the registered property locally.",
          );
        }

        setProperties((current) =>
          current.map((property) =>
            property.localPropertyId === payload.record.localPropertyId
              ? payload.record
              : property,
          ),
        );
        setLastSaved((current) =>
          current?.localPropertyId === payload.record.localPropertyId
            ? payload.record
            : current,
        );
        setRegistrationNotice(
          `Property #${propertyRegisteredLog.args.propertyId.toString()} registered on-chain.`,
        );
        setRegistrationErrorMessage(null);
      } catch (error) {
        setRegistrationErrorMessage(
          error instanceof Error
            ? error.message
            : "On-chain registration persistence failed.",
        );
        setRegistrationNotice(null);
      } finally {
        setRegisteringLocalPropertyId(null);
      }
    })();
  }, [
    processedRegistrationHash,
    registeringLocalPropertyId,
    registrationReceipt,
  ]);

  useEffect(() => {
    if (
      !verificationReceipt ||
      !verifyingLocalPropertyId ||
      processedVerificationHash === verificationReceipt.transactionHash
    ) {
      return;
    }

    void (async () => {
      try {
        setProcessedVerificationHash(verificationReceipt.transactionHash);

        const [propertyMockVerifiedLog] = parseEventLogs({
          abi: propertyRegistryAbi,
          eventName: "PropertyMockVerified",
          logs: verificationReceipt.logs,
          strict: true,
        });

        if (!propertyMockVerifiedLog) {
          throw new Error(
            "Transaction confirmed, but PropertyMockVerified event was not found.",
          );
        }

        const response = await fetch("/api/properties", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            kind: "mockVerification",
            localPropertyId: verifyingLocalPropertyId,
            propertyId: propertyMockVerifiedLog.args.propertyId.toString(),
            txHash: verificationReceipt.transactionHash,
          }),
        });

        const payload = (await response.json()) as
          | { record: SavedPropertyRecord }
          | { error: string };

        if (!response.ok || !("record" in payload)) {
          throw new Error(
            "error" in payload
              ? payload.error
              : "Could not persist the mock verification locally.",
          );
        }

        setProperties((current) =>
          current.map((property) =>
            property.localPropertyId === payload.record.localPropertyId
              ? payload.record
              : property,
          ),
        );
        setLastSaved((current) =>
          current?.localPropertyId === payload.record.localPropertyId
            ? payload.record
            : current,
        );
        setVerificationNotice(
          `Property #${propertyMockVerifiedLog.args.propertyId.toString()} mock-verified on-chain.`,
        );
        setVerificationErrorMessage(null);
      } catch (error) {
        setVerificationErrorMessage(
          error instanceof Error
            ? error.message
            : "Mock verification persistence failed.",
        );
        setVerificationNotice(null);
      } finally {
        setVerifyingLocalPropertyId(null);
      }
    })();
  }, [
    processedVerificationHash,
    verificationReceipt,
    verifyingLocalPropertyId,
  ]);

  useEffect(() => {
    if (
      !tokenizationReceipt ||
      !tokenizingLocalPropertyId ||
      processedTokenizationHash === tokenizationReceipt.transactionHash
    ) {
      return;
    }

    void (async () => {
      try {
        setProcessedTokenizationHash(tokenizationReceipt.transactionHash);

        const [propertyTokenizedLog] = parseEventLogs({
          abi: propertyRegistryAbi,
          eventName: "PropertyTokenized",
          logs: tokenizationReceipt.logs,
          strict: true,
        });
        const [propertyValueTokenCreatedLog] = parseEventLogs({
          abi: propertyRegistryAbi,
          eventName: "PropertyValueTokenCreated",
          logs: tokenizationReceipt.logs,
          strict: true,
        });

        if (!propertyTokenizedLog || !propertyValueTokenCreatedLog) {
          throw new Error(
            "Transaction confirmed, but tokenization events were not found.",
          );
        }

        const response = await fetch("/api/properties", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            kind: "tokenization",
            localPropertyId: tokenizingLocalPropertyId,
            propertyId: propertyTokenizedLog.args.propertyId.toString(),
            txHash: tokenizationReceipt.transactionHash,
            valueTokenAddress: propertyValueTokenCreatedLog.args.valueToken,
            usufructTokenId: propertyTokenizedLog.args.tokenId.toString(),
            linkedValueUnits:
              propertyTokenizedLog.args.linkedValueUnits.toString(),
            freeValueUnits: propertyTokenizedLog.args.freeValueUnits.toString(),
          }),
        });

        const payload = (await response.json()) as
          | { record: SavedPropertyRecord }
          | { error: string };

        if (!response.ok || !("record" in payload)) {
          throw new Error(
            "error" in payload
              ? payload.error
              : "Could not persist the property tokenization locally.",
          );
        }

        setProperties((current) =>
          current.map((property) =>
            property.localPropertyId === payload.record.localPropertyId
              ? payload.record
              : property,
          ),
        );
        setLastSaved((current) =>
          current?.localPropertyId === payload.record.localPropertyId
            ? payload.record
            : current,
        );
        setTokenizationNotice(
          `Property #${propertyTokenizedLog.args.propertyId.toString()} tokenized on-chain.`,
        );
        setTokenizationErrorMessage(null);
      } catch (error) {
        setTokenizationErrorMessage(
          error instanceof Error
            ? error.message
            : "Tokenization persistence failed.",
        );
        setTokenizationNotice(null);
      } finally {
        setTokenizingLocalPropertyId(null);
      }
    })();
  }, [
    processedTokenizationHash,
    tokenizationReceipt,
    tokenizingLocalPropertyId,
  ]);

  useEffect(() => {
    if (
      !listingReceipt ||
      !listingLocalPropertyId ||
      processedListingHash === listingReceipt.transactionHash
    ) {
      return;
    }

    void (async () => {
      try {
        setProcessedListingHash(listingReceipt.transactionHash);

        const [primarySaleListedLog] = parseEventLogs({
          abi: primaryValueSaleAbi,
          eventName: "PrimarySaleListed",
          logs: listingReceipt.logs,
          strict: true,
        });

        if (!primarySaleListedLog) {
          throw new Error(
            "Transaction confirmed, but PrimarySaleListed event was not found.",
          );
        }

        const response = await fetch("/api/properties", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            kind: "primarySaleListing",
            localPropertyId: listingLocalPropertyId,
            propertyId: primarySaleListedLog.args.propertyId.toString(),
            listingId: primarySaleListedLog.args.listingId.toString(),
            txHash: listingReceipt.transactionHash,
            amount: primarySaleListedLog.args.amount.toString(),
            priceWei: primarySaleListedLog.args.priceWei.toString(),
          }),
        });

        const payload = (await response.json()) as
          | { record: SavedPropertyRecord }
          | { error: string };

        if (!response.ok || !("record" in payload)) {
          throw new Error(
            "error" in payload
              ? payload.error
              : "Could not persist the primary sale listing locally.",
          );
        }

        setProperties((current) =>
          current.map((property) =>
            property.localPropertyId === payload.record.localPropertyId
              ? payload.record
              : property,
          ),
        );
        setLastSaved((current) =>
          current?.localPropertyId === payload.record.localPropertyId
            ? payload.record
            : current,
        );
        setListingNotice(
          `Primary sale listing #${primarySaleListedLog.args.listingId.toString()} created on-chain.`,
        );
        setListingErrorMessage(null);
      } catch (error) {
        setListingErrorMessage(
          error instanceof Error
            ? error.message
            : "Primary sale listing persistence failed.",
        );
        setListingNotice(null);
      } finally {
        setListingLocalPropertyId(null);
      }
    })();
  }, [listingLocalPropertyId, listingReceipt, processedListingHash]);

  useEffect(() => {
    if (
      !purchaseReceipt ||
      !purchaseTarget ||
      processedPurchaseHash === purchaseReceipt.transactionHash
    ) {
      return;
    }

    void (async () => {
      try {
        setProcessedPurchaseHash(purchaseReceipt.transactionHash);

        const [primarySalePurchasedLog] = parseEventLogs({
          abi: primaryValueSaleAbi,
          eventName: "PrimarySalePurchased",
          logs: purchaseReceipt.logs,
          strict: true,
        });

        if (!primarySalePurchasedLog) {
          throw new Error(
            "Transaction confirmed, but PrimarySalePurchased event was not found.",
          );
        }

        const response = await fetch("/api/properties", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            kind: "primarySalePurchase",
            localPropertyId: purchaseTarget.localPropertyId,
            propertyId: primarySalePurchasedLog.args.propertyId.toString(),
            listingId: primarySalePurchasedLog.args.listingId.toString(),
            txHash: purchaseReceipt.transactionHash,
            buyerWallet: primarySalePurchasedLog.args.buyer,
            amount: primarySalePurchasedLog.args.amount.toString(),
            priceWei: primarySalePurchasedLog.args.priceWei.toString(),
          }),
        });

        const payload = (await response.json()) as
          | { record: SavedPropertyRecord }
          | { error: string };

        if (!response.ok || !("record" in payload)) {
          throw new Error(
            "error" in payload
              ? payload.error
              : "Could not persist the primary sale purchase locally.",
          );
        }

        setProperties((current) =>
          current.map((property) =>
            property.localPropertyId === payload.record.localPropertyId
              ? payload.record
              : property,
          ),
        );
        setLastSaved((current) =>
          current?.localPropertyId === payload.record.localPropertyId
            ? payload.record
            : current,
        );
        setPurchaseNotice(
          `Listing #${primarySalePurchasedLog.args.listingId.toString()} purchased on-chain by ${shorten(primarySalePurchasedLog.args.buyer)}.`,
        );
        setPurchaseErrorMessage(null);
      } catch (error) {
        setPurchaseErrorMessage(
          error instanceof Error
            ? error.message
            : "Primary sale purchase persistence failed.",
        );
        setPurchaseNotice(null);
      } finally {
        setPurchaseTarget(null);
      }
    })();
  }, [processedPurchaseHash, purchaseReceipt, purchaseTarget]);

  const primaryValueSaleAddress =
    configuredPrimaryValueSaleAddress &&
    isAddress(configuredPrimaryValueSaleAddress) &&
    configuredPrimaryValueSaleAddress !==
      "0x0000000000000000000000000000000000000000"
      ? (configuredPrimaryValueSaleAddress as Address)
      : undefined;
  const registeredPropertiesCount = properties.filter(
    (property) => property.onchainRegistration,
  ).length;
  const mockVerifiedPropertiesCount = properties.filter(
    (property) => property.onchainRegistration?.status === "MockVerified",
  ).length;
  const tokenizedPropertiesCount = properties.filter(
    (property) =>
      property.onchainRegistration?.status === "Tokenized" ||
      property.onchainRegistration?.status === "ActiveSale" ||
      property.onchainRegistration?.status === "SoldOut",
  ).length;
  const activeSalePropertiesCount = properties.filter(
    (property) => property.onchainRegistration?.status === "ActiveSale",
  ).length;
  const activeRegistrationErrorMessage =
    registrationReceiptError?.message ?? registrationErrorMessage;
  const activeVerificationErrorMessage =
    verificationReceiptError?.message ?? verificationErrorMessage;
  const activeTokenizationErrorMessage =
    tokenizationReceiptError?.message ?? tokenizationErrorMessage;
  const activeListingErrorMessage =
    listingReceiptError?.message ?? listingErrorMessage;
  const activePurchaseErrorMessage =
    purchaseReceiptError?.message ?? purchaseErrorMessage;

  const marketValuePreview = useMemo(() => {
    try {
      return parseDecimalToUnits(formState.marketValueEth || "0", 18).toString();
    } catch {
      return "Invalid ETH value";
    }
  }, [formState.marketValueEth]);

  const normalizedCoordinatePreview = useMemo(() => {
    const normalizedLat = Number(formState.lat);
    const normalizedLng = Number(formState.lng);

    if (!Number.isFinite(normalizedLat) || !Number.isFinite(normalizedLng)) {
      return "Coordinates must be valid numbers.";
    }

    return `${normalizedLat.toFixed(6)}, ${normalizedLng.toFixed(6)}`;
  }, [formState.lat, formState.lng]);

  const pricingPreview = useMemo<PricingPreview | null>(() => {
    if (!/^\d+$/.test(listedUnits) || listedUnits === "0") {
      return null;
    }

    try {
      const marketValueEth = formState.marketValueEth.trim();
      const unitPriceEth = divideDecimalStrings(
        marketValueEth,
        TOTAL_VALUE_UNITS,
        8,
      );
      const offerPriceEth = multiplyDecimalStrings(
        unitPriceEth,
        listedUnits,
        8,
      );
      const listedPercent = divideDecimalStrings(
        multiplyDecimalStrings(listedUnits, "100", 4),
        TOTAL_VALUE_UNITS,
        4,
      );

      return {
        marketValueEth,
        listedUnits,
        listedPercent,
        offerPriceEth,
        unitPriceEth,
      };
    } catch {
      return null;
    }
  }, [formState.marketValueEth, listedUnits]);

  const intakePreview = useMemo<PropertyDraftPreview | null>(() => {
    if (!address || !isConnected) {
      return null;
    }

    try {
      return buildPropertyDraftPreview(
        {
          localPropertyId: draftLocalId,
          ownerWallet: address,
          ...formState,
        },
        {
          localPropertyId: draftLocalId,
        },
      );
    } catch {
      return null;
    }
  }, [address, draftLocalId, formState, isConnected]);

  const updateField = <Key extends keyof FormState>(
    field: Key,
    value: FormState[Key],
  ) => {
    setFormState((current) => ({ ...current, [field]: value }));
  };

  const updateSaleAmount = (localPropertyId: string, value: string) => {
    setSaleAmountByLocalPropertyId((current) => ({
      ...current,
      [localPropertyId]: value,
    }));
  };

  const updateDocument = <Key extends keyof MockDocumentInput>(
    index: number,
    field: Key,
    value: MockDocumentInput[Key],
  ) => {
    setFormState((current) => ({
      ...current,
      documents: current.documents.map((document, documentIndex) =>
        documentIndex === index ? { ...document, [field]: value } : document,
      ),
    }));
  };

  const addDocument = () => {
    setFormState((current) => ({
      ...current,
      documents: [
        ...current.documents,
        {
          type: "mock_tax_record",
          filename: "",
        },
      ],
    }));
  };

  const removeDocument = (index: number) => {
    setFormState((current) => ({
      ...current,
      documents: current.documents.filter((_, documentIndex) => documentIndex !== index),
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!address || !isConnected) {
      setErrorMessage("Connect a wallet before saving the property draft.");
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/properties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          localPropertyId: draftLocalId,
          ownerWallet: address,
          ...formState,
        }),
      });

      const payload = (await response.json()) as
        | { record: SavedPropertyRecord }
        | { error: string };

      if (!response.ok || !("record" in payload)) {
        throw new Error(
          "error" in payload ? payload.error : "Could not save the property.",
        );
      }

      setProperties((current) => [payload.record, ...current]);
      setLastSaved(payload.record);
      setDraftLocalId(crypto.randomUUID());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unexpected save failure.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegisterOnchain = async (property: SavedPropertyRecord) => {
    if (!address || !isConnected) {
      setRegistrationErrorMessage(
        "Connect a wallet before registering the property on-chain.",
      );
      return;
    }

    if (chainId !== sepolia.id) {
      setRegistrationErrorMessage("Switch the wallet to Sepolia first.");
      return;
    }

    if (!propertyRegistryAddress) {
      setRegistrationErrorMessage(
        "NEXT_PUBLIC_PROPERTY_REGISTRY_ADDRESS is not configured.",
      );
      return;
    }

    if (property.ownerWallet.toLowerCase() !== address.toLowerCase()) {
      setRegistrationErrorMessage(
        "Only the draft owner wallet can register this property on-chain.",
      );
      return;
    }

    if (property.onchainRegistration) {
      setRegistrationErrorMessage(
        "This property draft is already linked to an on-chain property.",
      );
      return;
    }

    setRegistrationErrorMessage(null);
    setRegistrationNotice(null);
    setRegisteringLocalPropertyId(property.localPropertyId);

    try {
      const txHash = await writeContractAsync({
        address: propertyRegistryAddress,
        abi: propertyRegistryAbi,
        functionName: "registerProperty",
        args: [
          BigInt(property.marketValueWei),
          property.linkedValueBps,
          property.metadataHash as Hex,
          property.documentsHash as Hex,
          property.locationHash as Hex,
        ],
        chainId: sepolia.id,
      });

      setSubmittedRegistrationHash(txHash);
      setProcessedRegistrationHash(null);
      setRegistrationNotice(
        `Transaction submitted: ${shortenHash(txHash)}. Waiting for confirmation.`,
      );
    } catch (error) {
      setRegisteringLocalPropertyId(null);
      setRegistrationErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not submit the on-chain registration transaction.",
      );
    }
  };

  const handleMockVerification = async (property: SavedPropertyRecord) => {
    if (!address || !isConnected) {
      setVerificationErrorMessage(
        "Connect a wallet before approving mock documents.",
      );
      return;
    }

    if (chainId !== sepolia.id) {
      setVerificationErrorMessage("Switch the wallet to Sepolia first.");
      return;
    }

    if (!propertyRegistryAddress) {
      setVerificationErrorMessage(
        "NEXT_PUBLIC_PROPERTY_REGISTRY_ADDRESS is not configured.",
      );
      return;
    }

    if (!property.onchainRegistration) {
      setVerificationErrorMessage(
        "Register the property on-chain before mock verification.",
      );
      return;
    }

    if (property.ownerWallet.toLowerCase() !== address.toLowerCase()) {
      setVerificationErrorMessage(
        "Only the draft owner wallet can approve mock documents from this dashboard.",
      );
      return;
    }

    if (property.onchainRegistration.status !== "PendingMockVerification") {
      setVerificationErrorMessage("This property is already mock-verified.");
      return;
    }

    setVerificationErrorMessage(null);
    setVerificationNotice(null);
    setVerifyingLocalPropertyId(property.localPropertyId);

    try {
      const txHash = await writeMockVerificationAsync({
        address: propertyRegistryAddress,
        abi: propertyRegistryAbi,
        functionName: "mockVerifyProperty",
        args: [BigInt(property.onchainRegistration.propertyId)],
        chainId: sepolia.id,
      });

      setSubmittedVerificationHash(txHash);
      setProcessedVerificationHash(null);
      setVerificationNotice(
        `Verification tx submitted: ${shortenHash(txHash)}. Waiting for confirmation.`,
      );
    } catch (error) {
      setVerifyingLocalPropertyId(null);
      setVerificationErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not submit the mock verification transaction.",
      );
    }
  };

  const handleTokenization = async (property: SavedPropertyRecord) => {
    if (!address || !isConnected) {
      setTokenizationErrorMessage(
        "Connect a wallet before tokenizing the property.",
      );
      return;
    }

    if (chainId !== sepolia.id) {
      setTokenizationErrorMessage("Switch the wallet to Sepolia first.");
      return;
    }

    if (!propertyRegistryAddress) {
      setTokenizationErrorMessage(
        "NEXT_PUBLIC_PROPERTY_REGISTRY_ADDRESS is not configured.",
      );
      return;
    }

    if (!property.onchainRegistration) {
      setTokenizationErrorMessage(
        "Register the property on-chain before tokenization.",
      );
      return;
    }

    if (property.ownerWallet.toLowerCase() !== address.toLowerCase()) {
      setTokenizationErrorMessage(
        "Only the draft owner wallet can tokenize this property.",
      );
      return;
    }

    if (property.onchainRegistration.status !== "MockVerified") {
      setTokenizationErrorMessage(
        property.onchainRegistration.status === "Tokenized"
          ? "This property is already tokenized."
          : "Approve mock documents before tokenization.",
      );
      return;
    }

    setTokenizationErrorMessage(null);
    setTokenizationNotice(null);
    setTokenizingLocalPropertyId(property.localPropertyId);

    try {
      const txHash = await writeTokenizationAsync({
        address: propertyRegistryAddress,
        abi: propertyRegistryAbi,
        functionName: "tokenizeProperty",
        args: [BigInt(property.onchainRegistration.propertyId)],
        chainId: sepolia.id,
      });

      setSubmittedTokenizationHash(txHash);
      setProcessedTokenizationHash(null);
      setTokenizationNotice(
        `Tokenization tx submitted: ${shortenHash(txHash)}. Waiting for confirmation.`,
      );
    } catch (error) {
      setTokenizingLocalPropertyId(null);
      setTokenizationErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not submit the tokenization transaction.",
      );
    }
  };

  const handleCreatePrimarySaleListing = async (
    property: SavedPropertyRecord,
    amount: string,
  ) => {
    if (!address || !isConnected) {
      setListingErrorMessage(
        "Connect a wallet before creating a primary sale listing.",
      );
      return;
    }

    if (chainId !== sepolia.id) {
      setListingErrorMessage("Switch the wallet to Sepolia first.");
      return;
    }

    if (!propertyRegistryAddress) {
      setListingErrorMessage(
        "NEXT_PUBLIC_PROPERTY_REGISTRY_ADDRESS is not configured.",
      );
      return;
    }

    if (!primaryValueSaleAddress) {
      setListingErrorMessage(
        "PrimaryValueSale is not available from the registry configuration.",
      );
      return;
    }

    if (!property.onchainRegistration) {
      setListingErrorMessage(
        "Register the property on-chain before creating a primary sale listing.",
      );
      return;
    }

    if (
      property.onchainRegistration.status !== "Tokenized" &&
      property.onchainRegistration.status !== "ActiveSale"
    ) {
      setListingErrorMessage(
        "Only tokenized properties can open a primary sale listing.",
      );
      return;
    }

    if (property.ownerWallet.toLowerCase() !== address.toLowerCase()) {
      setListingErrorMessage(
        "Only the property owner can create a primary sale listing.",
      );
      return;
    }

    if (!/^[1-9]\d*$/.test(amount)) {
      setListingErrorMessage(
        "Listing amount must be a positive whole-number amount.",
      );
      return;
    }

    const availableFreeBalance =
      BigInt(property.onchainRegistration.freeValueUnits ?? "0") -
      BigInt(property.onchainRegistration.activeEscrowedAmount ?? "0");
    const requestedAmount = BigInt(amount);

    if (requestedAmount > availableFreeBalance) {
      setListingErrorMessage(
        "Listing amount exceeds the owner free-value balance available outside escrow.",
      );
      return;
    }

    setListingErrorMessage(null);
    setListingNotice(null);
    setListingLocalPropertyId(property.localPropertyId);

    try {
      const txHash = await writePrimarySaleListingAsync({
        address: primaryValueSaleAddress,
        abi: primaryValueSaleAbi,
        functionName: "createPrimarySaleListing",
        args: [BigInt(property.onchainRegistration.propertyId), requestedAmount],
        chainId: sepolia.id,
      });

      setSubmittedListingHash(txHash);
      setProcessedListingHash(null);
      setListingNotice(
        `Primary sale tx submitted: ${shortenHash(txHash)}. Waiting for confirmation.`,
      );
    } catch (error) {
      setListingLocalPropertyId(null);
      setListingErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not submit the primary sale listing transaction.",
      );
    }
  };

  const handleBuyPrimarySaleListing = async (
    property: SavedPropertyRecord,
    listingId: string,
    priceWei: string,
  ) => {
    if (!address || !isConnected) {
      setPurchaseErrorMessage("Connect a wallet before buying a primary sale listing.");
      return;
    }

    if (chainId !== sepolia.id) {
      setPurchaseErrorMessage("Switch the wallet to Sepolia first.");
      return;
    }

    if (!primaryValueSaleAddress) {
      setPurchaseErrorMessage(
        "PrimaryValueSale is not available from the registry configuration.",
      );
      return;
    }

    if (!property.onchainRegistration) {
      setPurchaseErrorMessage(
        "Register and tokenize the property before buying from the marketplace.",
      );
      return;
    }

    const listing = property.onchainRegistration.primarySaleListings?.find(
      (entry) => entry.listingId === listingId,
    );

    if (!listing || listing.status !== "Active") {
      setPurchaseErrorMessage("Only active primary sale listings can be purchased.");
      return;
    }

    if (property.ownerWallet.toLowerCase() === address.toLowerCase()) {
      setPurchaseErrorMessage("The seller cannot buy their own primary sale listing.");
      return;
    }

    setPurchaseErrorMessage(null);
    setPurchaseNotice(null);
    setPurchaseTarget({
      listingId,
      localPropertyId: property.localPropertyId,
    });

    try {
      const txHash = await writePrimarySalePurchaseAsync({
        address: primaryValueSaleAddress,
        abi: primaryValueSaleAbi,
        functionName: "buyPrimarySaleListing",
        args: [BigInt(listingId)],
        value: BigInt(priceWei),
        chainId: sepolia.id,
      });

      setSubmittedPurchaseHash(txHash);
      setProcessedPurchaseHash(null);
      setPurchaseNotice(
        `Purchase tx submitted: ${shortenHash(txHash)}. Waiting for confirmation.`,
      );
    } catch (error) {
      setPurchaseTarget(null);
      setPurchaseErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not submit the primary sale purchase transaction.",
      );
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <section className="glass-panel overflow-hidden rounded-[2rem]">
        <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10 lg:py-10">
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="soft-label">Milestone 0.9</p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
                Buy the free-value token from the primary sale.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted sm:text-lg">
                Buyers can pay the exact ETH price, receive only the listed free-value
                ERC-20 units, and update the economic split while the usufruct NFT and
                linked value remain with the original owner.
              </p>
            </div>

            <div className="data-grid">
              <StatCard
                label="Connected network"
                value={
                  chainId === sepolia.id
                    ? "Sepolia"
                    : chainId
                      ? `Wrong network (${chainId})`
                      : "Wallet not connected"
                }
              />
              <StatCard
                label="Draft local id"
                value={shortenId(draftLocalId)}
              />
              <StatCard
                label="Registry contract"
                value={propertyRegistryAddress ? "Configured" : "Missing env"}
              />
              <StatCard
                label="USD per ETH"
                value={getFiatRateLabel("usd", fiatRates, isLoadingFiatRates)}
              />
              <StatCard
                label="Mock verified"
                value={`${mockVerifiedPropertiesCount}/${registeredPropertiesCount}`}
              />
              <StatCard
                label="Tokenized"
                value={`${tokenizedPropertiesCount}/${registeredPropertiesCount}`}
              />
              <StatCard
                label="Active sales"
                value={`${activeSalePropertiesCount}/${registeredPropertiesCount}`}
              />
            </div>

            {fiatErrorMessage ? (
              <Notice tone="danger">
                Fiat route unavailable. {fiatErrorMessage}
              </Notice>
            ) : null}

            {fiatRates?.cached ? (
              <Notice tone="warning">
                Cached fiat rates in use from {formatTimestamp(fiatRates.updatedAt)}.
              </Notice>
            ) : null}

            {!propertyRegistryAddress ? (
              <Notice tone="warning">
                Set `NEXT_PUBLIC_PROPERTY_REGISTRY_ADDRESS` to enable on-chain
                registration and tokenization from the dashboard.
              </Notice>
            ) : null}

            {!primaryValueSaleAddress && propertyRegistryAddress ? (
              <Notice tone="warning">
                The registry does not expose a configured `PrimaryValueSale` address yet.
              </Notice>
            ) : null}

            {registrationNotice && !activeRegistrationErrorMessage ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900">
                {registrationNotice}
              </div>
            ) : null}

            {activeRegistrationErrorMessage ? (
              <Notice tone="danger">{activeRegistrationErrorMessage}</Notice>
            ) : null}

            {verificationNotice && !activeVerificationErrorMessage ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900">
                {verificationNotice}
              </div>
            ) : null}

            {activeVerificationErrorMessage ? (
              <Notice tone="danger">{activeVerificationErrorMessage}</Notice>
            ) : null}

            {tokenizationNotice && !activeTokenizationErrorMessage ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900">
                {tokenizationNotice}
              </div>
            ) : null}

            {activeTokenizationErrorMessage ? (
              <Notice tone="danger">{activeTokenizationErrorMessage}</Notice>
            ) : null}

            {listingNotice && !activeListingErrorMessage ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900">
                {listingNotice}
              </div>
            ) : null}

            {activeListingErrorMessage ? (
              <Notice tone="danger">{activeListingErrorMessage}</Notice>
            ) : null}

            {purchaseNotice && !activePurchaseErrorMessage ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900">
                {purchaseNotice}
              </div>
            ) : null}

            {activePurchaseErrorMessage ? (
              <Notice tone="danger">{activePurchaseErrorMessage}</Notice>
            ) : null}
          </div>

          <WalletPanel />
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
        <form
          onSubmit={handleSubmit}
          className="glass-panel rounded-[1.75rem] p-6 sm:p-8"
        >
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <p className="soft-label">Tokenize my house</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">
                Save the off-chain property draft
              </h2>
            </div>
            <div className="rounded-full border border-line bg-white/70 px-4 py-2 text-sm font-medium text-muted">
              Owner wallet: {address ? shorten(address) : "required"}
            </div>
          </div>

          <div className="grid gap-5">
            <Field label="Property description">
              <textarea
                value={formState.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                rows={4}
                className="min-h-28 w-full rounded-2xl border border-line bg-white/85 px-4 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                placeholder="Describe the property for the MVP intake flow."
              />
            </Field>

            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Market value (ETH)">
                <input
                  value={formState.marketValueEth}
                  onChange={(event) =>
                    updateField("marketValueEth", event.target.value)
                  }
                  className={inputClassName}
                  inputMode="decimal"
                />
              </Field>

              <Field label="Linked value (bps)">
                <input
                  value={formState.linkedValueBps}
                  onChange={(event) =>
                    updateField(
                      "linkedValueBps",
                      Number(event.target.value || "0"),
                    )
                  }
                  className={inputClassName}
                  inputMode="numeric"
                />
              </Field>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Street">
                <input
                  value={formState.street}
                  onChange={(event) => updateField("street", event.target.value)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Number">
                <input
                  value={formState.number}
                  onChange={(event) => updateField("number", event.target.value)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Postal code">
                <input
                  value={formState.postalCode}
                  onChange={(event) =>
                    updateField("postalCode", event.target.value)
                  }
                  className={inputClassName}
                />
              </Field>

              <Field label="City">
                <input
                  value={formState.city}
                  onChange={(event) => updateField("city", event.target.value)}
                  className={inputClassName}
                />
              </Field>

              <Field label="State">
                <input
                  value={formState.state}
                  onChange={(event) => updateField("state", event.target.value)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Country">
                <input
                  value={formState.country}
                  onChange={(event) =>
                    updateField("country", event.target.value)
                  }
                  className={inputClassName}
                />
              </Field>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Latitude">
                <input
                  value={formState.lat}
                  onChange={(event) => updateField("lat", event.target.value)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Longitude">
                <input
                  value={formState.lng}
                  onChange={(event) => updateField("lng", event.target.value)}
                  className={inputClassName}
                />
              </Field>
            </div>

            <section className="rounded-3xl border border-dashed border-line bg-white/55 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="soft-label">Mock document upload</p>
                  <h3 className="mt-2 text-lg font-semibold text-foreground">
                    Attach mocked ownership evidence
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={addDocument}
                  className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-foreground transition hover:border-foreground/30"
                >
                  Add mock document
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {formState.documents.map((document, index) => (
                  <div
                    key={`${document.type}-${index}`}
                    className="grid gap-4 rounded-3xl border border-line bg-white/80 p-4 md:grid-cols-[0.9fr_1.1fr_auto]"
                  >
                    <Field label="Mock document type">
                      <select
                        value={document.type}
                        onChange={(event) =>
                          updateDocument(
                            index,
                            "type",
                            event.target.value as MockDocumentType,
                          )
                        }
                        className={inputClassName}
                      >
                        <option value="mock_deed">Mock deed</option>
                        <option value="mock_owner_id">Mock owner id</option>
                        <option value="mock_tax_record">Mock tax record</option>
                      </select>
                    </Field>

                    <Field label="Mock filename">
                      <input
                        value={document.filename}
                        onChange={(event) =>
                          updateDocument(index, "filename", event.target.value)
                        }
                        className={inputClassName}
                        placeholder="mock_document.pdf"
                      />
                    </Field>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeDocument(index)}
                        disabled={formState.documents.length === 1}
                        className="rounded-full border border-danger/20 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="mt-8 flex flex-col gap-4 border-t border-line pt-6">
            <Notice tone="warning">
              Mock documents are metadata-only. No real deed verification or binary
              file hashing happens in milestone `0.3`.
            </Notice>

            <div className="rounded-3xl border border-line bg-white/75 p-4 text-sm text-muted">
              <p className="soft-label">Input previews</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <p>
                  <span className="font-semibold text-foreground">Wei preview:</span>{" "}
                  <span className="mono">{marketValuePreview}</span>
                </p>
                <p>
                  <span className="font-semibold text-foreground">Coordinates:</span>{" "}
                  <span className="mono">{normalizedCoordinatePreview}</span>
                </p>
              </div>
            </div>

            {errorMessage ? (
              <div className="rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
                {errorMessage}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving draft..." : "Save property via server route"}
            </button>
          </div>
        </form>

        <div className="flex flex-col gap-6">
          <section className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
            <p className="soft-label">Pre-save deterministic preview</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">
              Data that will be referenced on-chain
            </h2>

            {intakePreview ? (
              <div className="mt-6 space-y-4">
                <article className="rounded-3xl border border-line bg-white/75 p-4">
                  <p className="soft-label">Draft local id</p>
                  <p className="mono mt-2 break-all text-sm leading-6 text-foreground">
                    {intakePreview.localPropertyId}
                  </p>
                  <div className="mt-4 grid gap-3 text-sm text-muted md:grid-cols-2">
                    <p>
                      <span className="font-semibold text-foreground">Address:</span>{" "}
                      {intakePreview.address.street}, {intakePreview.address.number},{" "}
                      {intakePreview.address.city}, {intakePreview.address.state}
                    </p>
                    <p>
                      <span className="font-semibold text-foreground">Location:</span>{" "}
                      <span className="mono">
                        {intakePreview.location.lat}, {intakePreview.location.lng}
                      </span>
                    </p>
                  </div>
                </article>

                <HashRow label="Property metadata hash" value={intakePreview.metadataHash} />
                <HashRow label="Location metadata hash" value={intakePreview.locationHash} />
                <HashRow label="Documents metadata hash" value={intakePreview.documentsHash} />

                <article className="rounded-3xl border border-line bg-white/75 p-4">
                  <p className="soft-label">Mock documents to be saved</p>
                  <div className="mt-3 space-y-2 text-sm text-muted">
                    {intakePreview.documents.map((document, index) => (
                      <p key={`${document.type}-${index}`}>
                        <span className="font-semibold text-foreground">
                          {formatDocumentType(document.type)}:
                        </span>{" "}
                        <span className="mono">{document.filename}</span>
                      </p>
                    ))}
                  </div>
                </article>
              </div>
            ) : (
              <p className="mt-6 text-sm leading-7 text-muted">
                Connect a wallet and keep all intake fields valid to preview the
                deterministic hash payloads before any server-side write.
              </p>
            )}
          </section>

          <section className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="soft-label">Fiat pricing preview</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">
                  House, offer, and unit values
                </h2>
              </div>
              <div className="rounded-full border border-line bg-white/70 px-4 py-2 text-sm font-medium text-muted">
                Total units: {formatDecimalForDisplay(TOTAL_VALUE_UNITS, 0)}
              </div>
            </div>

            {pricingPreview ? (
              <div className="mt-6 space-y-4">
                <PricingRow
                  label="House market value"
                  ethValue={pricingPreview.marketValueEth}
                  fiatRates={fiatRates}
                />
                <PricingRow
                  label={`Offer price (${formatDecimalForDisplay(
                    pricingPreview.listedUnits,
                    0,
                  )} units / ${pricingPreview.listedPercent}%)`}
                  ethValue={pricingPreview.offerPriceEth}
                  fiatRates={fiatRates}
                />
                <PricingRow
                  label="Value per unit"
                  ethValue={pricingPreview.unitPriceEth}
                  fiatRates={fiatRates}
                />
              </div>
            ) : (
              <p className="mt-6 text-sm leading-7 text-muted">
                Enter a valid ETH market value and positive listed units to
                preview USD and BRL equivalents.
              </p>
            )}
          </section>

          <section className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
            <p className="soft-label">Last saved hashes</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">
              Server-side persisted output
            </h2>

            {lastSaved ? (
              <div className="mt-6 space-y-4">
                <HashRow label="Property metadata hash" value={lastSaved.metadataHash} />
                <HashRow label="Location metadata hash" value={lastSaved.locationHash} />
                <HashRow label="Documents metadata hash" value={lastSaved.documentsHash} />
                {lastSaved.onchainRegistration ? (
                  <div className="rounded-3xl border border-line bg-white/75 p-4">
                    <p className="soft-label">On-chain registration</p>
                    <div className="mt-2 grid gap-3 text-sm text-muted md:grid-cols-2">
                      <p>
                        <span className="font-semibold text-foreground">Property id:</span>{" "}
                        <span className="mono">
                          {lastSaved.onchainRegistration.propertyId}
                        </span>
                      </p>
                      <p>
                        <span className="font-semibold text-foreground">Status:</span>{" "}
                        {lastSaved.onchainRegistration.status}
                      </p>
                      {lastSaved.onchainRegistration.verificationTxHash ? (
                        <p className="md:col-span-2">
                          <span className="font-semibold text-foreground">
                            Verification tx:
                          </span>{" "}
                          <span className="mono break-all">
                            {lastSaved.onchainRegistration.verificationTxHash}
                          </span>
                        </p>
                      ) : null}
                      {lastSaved.onchainRegistration.tokenizationTxHash ? (
                        <p className="md:col-span-2">
                          <span className="font-semibold text-foreground">
                            Tokenization tx:
                          </span>{" "}
                          <span className="mono break-all">
                            {lastSaved.onchainRegistration.tokenizationTxHash}
                          </span>
                        </p>
                      ) : null}
                      {lastSaved.onchainRegistration.valueTokenAddress ? (
                        <p className="md:col-span-2">
                          <span className="font-semibold text-foreground">
                            Value token:
                          </span>{" "}
                          <span className="mono break-all">
                            {lastSaved.onchainRegistration.valueTokenAddress}
                          </span>
                        </p>
                      ) : null}
                      {lastSaved.onchainRegistration.activeListingsCount ? (
                        <p>
                          <span className="font-semibold text-foreground">
                            Active listings:
                          </span>{" "}
                          {lastSaved.onchainRegistration.activeListingsCount}
                        </p>
                      ) : null}
                      {lastSaved.onchainRegistration.activeEscrowedAmount ? (
                        <p>
                          <span className="font-semibold text-foreground">
                            Escrowed units:
                          </span>{" "}
                          <span className="mono">
                            {lastSaved.onchainRegistration.activeEscrowedAmount}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-6 text-sm leading-7 text-muted">
                Save the first property draft to compare the pre-save preview with
                the persisted server-side record.
              </p>
            )}
          </section>

          <section className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="soft-label">lowdb volume data</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">
                  Off-chain drafts
                </h2>
              </div>
              <div className="rounded-full border border-line bg-white/70 px-4 py-2 text-sm font-medium text-muted">
                {properties.length} stored
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {properties.length ? (
                properties.map((property) => {
                  const marketValueEth = weiToEthDecimalString(
                    property.marketValueWei,
                    8,
                  );
                  const registration = property.onchainRegistration;
                  const isTokenized =
                    registration?.status === "Tokenized" ||
                    registration?.status === "ActiveSale" ||
                    registration?.status === "SoldOut";
                  const linkedValueUnits =
                    registration?.linkedValueUnits ??
                    Math.floor(
                      (Number(TOTAL_VALUE_UNITS) * property.linkedValueBps) / 10_000,
                    ).toString();
                  const freeValueUnits =
                    registration?.freeValueUnits ??
                    (Number(TOTAL_VALUE_UNITS) - Number(linkedValueUnits)).toString();
                  const linkedPercent = divideDecimalStrings(
                    multiplyDecimalStrings(linkedValueUnits, "100", 4),
                    TOTAL_VALUE_UNITS,
                    4,
                  );
                  const freePercent = divideDecimalStrings(
                    multiplyDecimalStrings(freeValueUnits, "100", 4),
                    TOTAL_VALUE_UNITS,
                    4,
                  );
                  const linkedValueEth = multiplyDecimalStrings(
                    marketValueEth,
                    divideDecimalStrings(linkedValueUnits, TOTAL_VALUE_UNITS, 8),
                    8,
                  );
                  const totalFreeValueSold =
                    registration?.totalFreeValueSold ?? "0";
                  const activeEscrowedAmount =
                    registration?.activeEscrowedAmount ?? "0";
                  const ownerRetainedFreeUnits = isTokenized
                    ? (
                        BigInt(freeValueUnits) - BigInt(totalFreeValueSold)
                      ).toString()
                    : "0";
                  const ownerFreeBalanceUnits = isTokenized
                    ? (
                        BigInt(ownerRetainedFreeUnits) - BigInt(activeEscrowedAmount)
                      ).toString()
                    : "0";
                  const ownerFreeBalanceEth = isTokenized
                    ? multiplyDecimalStrings(
                        marketValueEth,
                        divideDecimalStrings(ownerFreeBalanceUnits, TOTAL_VALUE_UNITS, 8),
                        8,
                      )
                    : "0";
                  const ownerTotalEconomicUnits = isTokenized
                    ? (
                        BigInt(linkedValueUnits) + BigInt(ownerRetainedFreeUnits)
                      ).toString()
                    : "0";
                  const ownerTotalEconomicPercent = isTokenized
                    ? divideDecimalStrings(
                        multiplyDecimalStrings(ownerTotalEconomicUnits, "100", 4),
                        TOTAL_VALUE_UNITS,
                        4,
                      )
                    : "0";
                  const ownerTotalEconomicEth = isTokenized
                    ? multiplyDecimalStrings(
                        marketValueEth,
                        divideDecimalStrings(
                          ownerTotalEconomicUnits,
                          TOTAL_VALUE_UNITS,
                          8,
                        ),
                        8,
                      )
                    : "0";
                  const activeListings =
                    registration?.primarySaleListings?.filter(
                      (listing) => listing.status === "Active",
                    ) ?? [];
                  const buyerBalances = registration?.buyerBalances ?? [];
                  const sellerReceivedEth = registration?.sellerReceivedWei
                    ? weiToEthDecimalString(registration.sellerReceivedWei, 8)
                    : "0";
                  const participantRows = [
                    {
                      wallet: property.ownerWallet,
                      usufruct: "Holder",
                      linkedUnits: linkedValueUnits,
                      freeUnits: ownerFreeBalanceUnits,
                    },
                    ...buyerBalances.map((buyerBalance) => ({
                      wallet: buyerBalance.buyerWallet,
                      usufruct: "No",
                      linkedUnits: "0",
                      freeUnits: buyerBalance.freeValueUnits,
                    })),
                  ];
                  const saleAmount =
                    saleAmountByLocalPropertyId[property.localPropertyId] ??
                    listedUnits;
                  const saleAmountIsValid = /^[1-9]\d*$/.test(saleAmount);
                  const saleListedPercent = saleAmountIsValid
                    ? divideDecimalStrings(
                        multiplyDecimalStrings(saleAmount, "100", 4),
                        TOTAL_VALUE_UNITS,
                        4,
                      )
                    : "0";
                  const salePriceEth = saleAmountIsValid
                    ? multiplyDecimalStrings(
                        marketValueEth,
                        divideDecimalStrings(saleAmount, TOTAL_VALUE_UNITS, 8),
                        8,
                      )
                    : "0";
                  const isCurrentListing =
                    listingLocalPropertyId === property.localPropertyId;
                  const isCurrentPurchaseProperty =
                    purchaseTarget?.localPropertyId === property.localPropertyId;
                  const isDraftOwner =
                    Boolean(address) &&
                    property.ownerWallet.toLowerCase() === address?.toLowerCase();
                  const isCurrentRegistration =
                    registeringLocalPropertyId === property.localPropertyId;
                  const isCurrentVerification =
                    verifyingLocalPropertyId === property.localPropertyId;
                  const isCurrentTokenization =
                    tokenizingLocalPropertyId === property.localPropertyId;
                  const registerButtonDisabled =
                    !isConnected ||
                    !isDraftOwner ||
                    chainId !== sepolia.id ||
                    !propertyRegistryAddress ||
                    Boolean(property.onchainRegistration) ||
                    isRegisteringOnchain ||
                    isConfirmingRegistration;
                  const registerButtonLabel = registration
                    ? "Registered on-chain"
                    : isCurrentRegistration && isRegisteringOnchain
                      ? "Submitting transaction..."
                    : isCurrentRegistration && isConfirmingRegistration
                        ? "Waiting for confirmation..."
                        : "Register on-chain";
                  const verifyButtonDisabled =
                    !isConnected ||
                    !isDraftOwner ||
                    chainId !== sepolia.id ||
                    !propertyRegistryAddress ||
                    !registration ||
                    registration.status !== "PendingMockVerification" ||
                    isSubmittingMockVerification ||
                    isConfirmingVerification;
                  const verifyButtonLabel =
                    registration?.status === "Tokenized" ||
                    registration?.status === "ActiveSale" ||
                    registration?.status === "SoldOut"
                      ? "Already tokenized"
                      : registration?.status === "MockVerified"
                        ? "Mock verified"
                      : isCurrentVerification && isSubmittingMockVerification
                        ? "Submitting verification..."
                        : isCurrentVerification && isConfirmingVerification
                          ? "Waiting for verification..."
                          : "Approve mock documents";
                  const tokenizeButtonDisabled =
                    !isConnected ||
                    !isDraftOwner ||
                    chainId !== sepolia.id ||
                    !propertyRegistryAddress ||
                    !registration ||
                    registration.status !== "MockVerified" ||
                    isSubmittingTokenization ||
                    isConfirmingTokenization;
                  const tokenizeButtonLabel =
                    registration?.status === "Tokenized" ||
                    registration?.status === "ActiveSale" ||
                    registration?.status === "SoldOut"
                      ? "Tokenized"
                      : isCurrentTokenization && isSubmittingTokenization
                        ? "Submitting tokenization..."
                        : isCurrentTokenization && isConfirmingTokenization
                          ? "Waiting for tokenization..."
                          : "Tokenize property";
                  const createListingButtonDisabled =
                    !isConnected ||
                    !isDraftOwner ||
                    chainId !== sepolia.id ||
                    !primaryValueSaleAddress ||
                    !registration ||
                    (registration.status !== "Tokenized" &&
                      registration.status !== "ActiveSale") ||
                    !saleAmountIsValid ||
                    BigInt(saleAmountIsValid ? saleAmount : "0") >
                      BigInt(ownerFreeBalanceUnits) ||
                    isSubmittingPrimarySaleListing ||
                    isConfirmingListing;
                  const createListingButtonLabel =
                    isCurrentListing && isSubmittingPrimarySaleListing
                      ? "Submitting listing..."
                      : isCurrentListing && isConfirmingListing
                        ? "Waiting for listing..."
                        : "Create primary sale offer";

                  return (
                    <article
                      key={property.localPropertyId}
                      className="rounded-3xl border border-line bg-white/75 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-foreground">
                            {property.description || "Unnamed property"}
                          </p>
                          <p className="mt-1 text-sm text-muted">
                            {property.address.street}, {property.address.number},{" "}
                            {property.address.city}
                          </p>
                        </div>
                        <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                          {scaleBpsToPercent(property.linkedValueBps)} linked
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm text-muted md:grid-cols-2">
                        <div>
                          <p className="soft-label">Local property id</p>
                          <p className="mono mt-1 break-all text-foreground">
                            {property.localPropertyId}
                          </p>
                        </div>
                        <div>
                          <p className="soft-label">Owner wallet</p>
                          <p className="mono mt-1 break-all text-foreground">
                            {property.ownerWallet}
                          </p>
                        </div>
                        <div>
                          <p className="soft-label">Market value</p>
                          <p className="mono mt-1 break-all text-foreground">
                            {formatEthLabel(marketValueEth)}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {renderFiatSummary(marketValueEth, fiatRates)}
                          </p>
                        </div>
                        <div>
                          <p className="soft-label">Coordinates</p>
                          <p className="mono mt-1 text-foreground">
                            {property.location.lat}, {property.location.lng}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2 text-sm text-muted">
                        <p className="soft-label">Stored mock documents</p>
                        {property.documents.map((document, index) => (
                          <p key={`${property.localPropertyId}-${index}`}>
                            <span className="font-semibold text-foreground">
                              {formatDocumentType(document.type)}:
                            </span>{" "}
                            <span className="mono">{document.filename}</span>
                          </p>
                        ))}
                      </div>

                      <div className="mt-4 rounded-3xl border border-line bg-white/80 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="soft-label">On-chain registration</p>
                            <p className="mt-2 text-sm text-muted">
                              Register the saved hashes and market value in `PropertyRegistry`.
                            </p>
                          </div>
                          {property.onchainRegistration ? (
                            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                              {property.onchainRegistration.status}
                            </span>
                          ) : null}
                        </div>

                        {property.onchainRegistration ? (
                          <div className="mt-4 grid gap-3 text-sm text-muted md:grid-cols-2">
                            <div>
                              <p className="soft-label">Property id</p>
                              <p className="mono mt-1 text-foreground">
                                {property.onchainRegistration.propertyId}
                              </p>
                            </div>
                            <div>
                              <p className="soft-label">Registration tx</p>
                              <p className="mono mt-1 break-all text-foreground">
                                {property.onchainRegistration.txHash}
                              </p>
                            </div>
                            {property.onchainRegistration.verificationTxHash ? (
                              <div className="md:col-span-2">
                                <p className="soft-label">Verification tx</p>
                                <p className="mono mt-1 break-all text-foreground">
                                  {property.onchainRegistration.verificationTxHash}
                                </p>
                              </div>
                            ) : null}
                            {property.onchainRegistration.tokenizationTxHash ? (
                              <div className="md:col-span-2">
                                <p className="soft-label">Tokenization tx</p>
                                <p className="mono mt-1 break-all text-foreground">
                                  {property.onchainRegistration.tokenizationTxHash}
                                </p>
                              </div>
                            ) : null}
                            {property.onchainRegistration.valueTokenAddress ? (
                              <div className="md:col-span-2">
                                <p className="soft-label">Value token address</p>
                                <p className="mono mt-1 break-all text-foreground">
                                  {property.onchainRegistration.valueTokenAddress}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <p className="mt-4 text-sm leading-7 text-muted">
                            Not registered yet. The owner wallet must be connected on Sepolia.
                          </p>
                        )}

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              void handleRegisterOnchain(property);
                            }}
                            disabled={registerButtonDisabled}
                            className="inline-flex items-center justify-center rounded-full bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {registerButtonLabel}
                          </button>

                          {!isDraftOwner ? (
                            <span className="text-sm text-muted">
                              Connect the matching owner wallet to register.
                            </span>
                          ) : null}

                          {chainId !== sepolia.id && isConnected ? (
                            <span className="text-sm text-muted">
                              Switch to Sepolia before sending the transaction.
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-4 rounded-3xl border border-dashed border-line bg-white/70 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="soft-label">Mock verification</p>
                              <p className="mt-2 text-sm text-muted">
                                Owner wallet can approve mock documents here. Verifier-role wallets
                                stay allowed on-chain, even if not exposed in this dashboard.
                              </p>
                            </div>
                            {property.onchainRegistration ? (
                              <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                                {property.onchainRegistration.status}
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                void handleMockVerification(property);
                              }}
                              disabled={verifyButtonDisabled}
                              className="inline-flex items-center justify-center rounded-full border border-accent/20 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent transition hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {verifyButtonLabel}
                            </button>

                            {!property.onchainRegistration ? (
                              <span className="text-sm text-muted">
                                Register first. Then approve mock documents.
                              </span>
                            ) : null}

                            {property.onchainRegistration?.status === "MockVerified" ? (
                              <span className="text-sm text-muted">
                                Mock verification already completed for this property.
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-4 rounded-3xl border border-dashed border-line bg-white/70 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="soft-label">Tokenization</p>
                              <p className="mt-2 text-sm text-muted">
                                Mint the usufruct NFT and the free-value ERC-20 after mock
                                verification completes.
                              </p>
                            </div>
                            {property.onchainRegistration ? (
                              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                                {property.onchainRegistration.status}
                              </span>
                            ) : null}
                          </div>

                          {isTokenized ? (
                            <div className="mt-4 grid gap-3 text-sm text-muted md:grid-cols-2">
                              <div>
                                <p className="soft-label">Usufruct token id</p>
                                <p className="mono mt-1 text-foreground">
                                  {registration?.usufructTokenId}
                                </p>
                              </div>
                              <div>
                                <p className="soft-label">Free value units</p>
                                <p className="mono mt-1 text-foreground">
                                  {formatDecimalForDisplay(
                                    registration?.freeValueUnits ?? "0",
                                    0,
                                  )}
                                </p>
                              </div>
                              <div>
                                <p className="soft-label">Linked value units</p>
                                <p className="mono mt-1 text-foreground">
                                  {formatDecimalForDisplay(
                                    registration?.linkedValueUnits ?? "0",
                                    0,
                                  )}
                                </p>
                              </div>
                              <div>
                                <p className="soft-label">Token decimals</p>
                                <p className="mono mt-1 text-foreground">0</p>
                              </div>
                            </div>
                          ) : null}

                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                void handleTokenization(property);
                              }}
                              disabled={tokenizeButtonDisabled}
                              className="inline-flex items-center justify-center rounded-full border border-emerald-600/20 bg-emerald-600/10 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-600/15 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {tokenizeButtonLabel}
                            </button>

                            {!property.onchainRegistration ? (
                              <span className="text-sm text-muted">
                                Register first. Then approve mock documents before tokenization.
                              </span>
                            ) : null}

                            {property.onchainRegistration?.status === "PendingMockVerification" ? (
                              <span className="text-sm text-muted">
                                Mock verification is still pending for this property.
                              </span>
                            ) : null}

                            {isTokenized ? (
                              <span className="text-sm text-muted">
                                Tokenization is complete. The owner now holds the usufruct NFT and
                                the free-value token supply.
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-4 rounded-3xl border border-line bg-stone-50/80 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="soft-label">Tokenized property dashboard</p>
                              <p className="mt-2 text-sm text-muted">
                                Separate the right of use from the transferable economic value.
                              </p>
                            </div>
                            <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-stone-50">
                              {registration?.status ?? "Draft"}
                            </span>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <DashboardMetric
                              label="Market value"
                              value={formatEthLabel(marketValueEth)}
                              detail={renderFiatSummary(marketValueEth, fiatRates)}
                            />
                            <DashboardMetric
                              label="Owner"
                              value={shorten(property.ownerWallet)}
                              detail={property.ownerWallet}
                              mono
                            />
                            <DashboardMetric
                              label="Off-chain address"
                              value={`${property.address.street}, ${property.address.number}`}
                              detail={`${property.address.city}, ${property.address.state}, ${property.address.country} ${property.address.postalCode}`}
                            />
                            <DashboardMetric
                              label="Off-chain location"
                              value={`${property.location.lat}, ${property.location.lng}`}
                              detail="Persisted from the intake metadata."
                              mono
                            />
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <HashRow label="Property metadata hash" value={property.metadataHash} />
                            <HashRow label="Documents metadata hash" value={property.documentsHash} />
                            <HashRow label="Location metadata hash" value={property.locationHash} />
                          </div>

                          <div className="mt-4 grid gap-4 xl:grid-cols-2">
                            <div className="rounded-3xl border border-line bg-white/80 p-4">
                              <p className="soft-label">Usufruct and linked value</p>
                              <h3 className="mt-2 text-lg font-semibold text-foreground">
                                Non-transferable right of use
                              </h3>
                              <div className="mt-4 grid gap-3 md:grid-cols-2">
                                <DashboardMetric
                                  label="Usufruct NFT"
                                  value={registration?.usufructTokenId ?? "Not minted yet"}
                                  detail={
                                    isTokenized
                                      ? `Token id matches property id ${registration?.propertyId}.`
                                      : "Minted after tokenization."
                                  }
                                  mono={Boolean(registration?.usufructTokenId)}
                                />
                                <DashboardMetric
                                  label="Usufruct holder"
                                  value={shorten(property.ownerWallet)}
                                  detail={property.ownerWallet}
                                  mono
                                />
                                <DashboardMetric
                                  label="Linked value units"
                                  value={formatDecimalForDisplay(linkedValueUnits, 0)}
                                  detail={`${linkedPercent}% of the total economic value`}
                                />
                                <DashboardMetric
                                  label="Linked value in ETH"
                                  value={formatEthLabel(linkedValueEth)}
                                  detail={renderFiatSummary(linkedValueEth, fiatRates)}
                                />
                              </div>
                            </div>

                            <div className="rounded-3xl border border-line bg-white/80 p-4">
                              <p className="soft-label">Free value token</p>
                              <h3 className="mt-2 text-lg font-semibold text-foreground">
                                Transferable economic exposure only
                              </h3>
                              <div className="mt-4 grid gap-3 md:grid-cols-2">
                                <DashboardMetric
                                  label="Value token"
                                  value={
                                    registration?.valueTokenAddress
                                      ? shorten(registration.valueTokenAddress)
                                      : "Not created yet"
                                  }
                                  detail={
                                    registration?.valueTokenAddress ??
                                    "Created at tokenization time."
                                  }
                                  mono={Boolean(registration?.valueTokenAddress)}
                                />
                                <DashboardMetric
                                  label="Token decimals"
                                  value="0"
                                  detail="Each unit is a whole-number economic slice."
                                />
                                <DashboardMetric
                                  label="Free supply"
                                  value={formatDecimalForDisplay(freeValueUnits, 0)}
                                  detail={`${freePercent}% of the total economic value`}
                                />
                                <DashboardMetric
                                  label="Owner free balance"
                                  value={formatDecimalForDisplay(ownerFreeBalanceUnits, 0)}
                                  detail={
                                    isTokenized
                                      ? `${formatEthLabel(ownerFreeBalanceEth)} • ${renderFiatSummary(ownerFreeBalanceEth, fiatRates)}`
                                      : "Will appear after tokenization."
                                  }
                                />
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                            <div className="rounded-3xl border border-line bg-white/80 p-4">
                              <p className="soft-label">Economic ownership</p>
                              <h3 className="mt-2 text-lg font-semibold text-foreground">
                                Current participant breakdown
                              </h3>
                              <div className="mt-4 grid gap-3 md:grid-cols-3">
                                <DashboardMetric
                                  label="Owner total units"
                                  value={formatDecimalForDisplay(ownerTotalEconomicUnits, 0)}
                                  detail={
                                    isTokenized
                                      ? `${ownerTotalEconomicPercent}% of the total economic value`
                                      : "Waiting for tokenization."
                                  }
                                />
                                <DashboardMetric
                                  label="Owner total in ETH"
                                  value={formatEthLabel(ownerTotalEconomicEth)}
                                  detail={renderFiatSummary(ownerTotalEconomicEth, fiatRates)}
                                />
                                <DashboardMetric
                                  label="Participants"
                                  value={participantRows.length.toString()}
                                  detail={
                                    buyerBalances.length
                                      ? "Owner and buyers are tracked after confirmed marketplace purchases."
                                      : "Only the owner participates before a purchase settles."
                                  }
                                />
                              </div>

                              <div className="mt-4 overflow-hidden rounded-3xl border border-line">
                                <div className="grid grid-cols-[1.1fr_0.8fr_0.8fr_0.8fr] gap-3 bg-stone-100 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                                  <p>Participant</p>
                                  <p>Usufruct</p>
                                  <p>Linked</p>
                                  <p>Free</p>
                                </div>
                                {participantRows.map((participant) => (
                                  <div
                                    key={`${property.localPropertyId}-${participant.wallet}`}
                                    className="grid grid-cols-[1.1fr_0.8fr_0.8fr_0.8fr] gap-3 border-t border-line px-4 py-4 text-sm text-muted first:border-t-0"
                                  >
                                    <p className="mono break-all text-foreground">
                                      {participant.wallet}
                                    </p>
                                    <p className="text-foreground">
                                      {participant.usufruct}
                                    </p>
                                    <p className="text-foreground">
                                      {formatDecimalForDisplay(participant.linkedUnits, 0)}
                                    </p>
                                    <p className="text-foreground">
                                      {formatDecimalForDisplay(participant.freeUnits, 0)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-3xl border border-line bg-white/80 p-4">
                              <p className="soft-label">Primary sale marketplace</p>
                              <h3 className="mt-2 text-lg font-semibold text-foreground">
                                Buyers, offers, and escrow
                              </h3>
                              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                                <DashboardMetric
                                  label="Buyer balances after sale"
                                  value={`${buyerBalances.length} buyers`}
                                  detail={
                                    buyerBalances.length
                                      ? "Confirmed buyers below now hold free-value ERC-20 units."
                                      : "No buyer balance recorded yet."
                                  }
                                />
                                <DashboardMetric
                                  label="Seller received in ETH"
                                  value={formatEthLabel(sellerReceivedEth)}
                                  detail={
                                    sellerReceivedEth === "0"
                                      ? "No confirmed primary sale payment yet."
                                      : renderFiatSummary(sellerReceivedEth, fiatRates)
                                  }
                                />
                                <DashboardMetric
                                  label="Active offers"
                                  value={`${activeListings.length} listings`}
                                  detail={
                                    activeListings.length
                                      ? "Offers below are live in the local marketplace view."
                                      : "No active offer yet."
                                  }
                                />
                                <DashboardMetric
                                  label="Tokens in active escrow"
                                  value={`${formatDecimalForDisplay(activeEscrowedAmount, 0)} units`}
                                  detail={
                                    activeEscrowedAmount === "0"
                                      ? "No free-value token is escrowed yet."
                                      : "Escrowed tokens are held by PrimaryValueSale until buy or cancel."
                                  }
                                />
                              </div>

                              <div className="mt-4 rounded-3xl border border-line bg-stone-100/80 p-4">
                                <p className="soft-label">Create primary sale offer</p>
                                <div className="mt-3 grid gap-4 md:grid-cols-2">
                                  <Field label="Free-value units to sell">
                                    <input
                                      value={saleAmount}
                                      onChange={(event) =>
                                        updateSaleAmount(
                                          property.localPropertyId,
                                          event.target.value.replace(/[^\d]/g, ""),
                                        )
                                      }
                                      className={inputClassName}
                                      inputMode="numeric"
                                      placeholder="300000"
                                    />
                                  </Field>
                                  <div className="rounded-3xl border border-line bg-white/80 p-4 text-sm text-muted">
                                    <p className="soft-label">Sale preview</p>
                                    {saleAmountIsValid ? (
                                      <div className="mt-3 space-y-2">
                                        <p>
                                          <span className="font-semibold text-foreground">
                                            Equivalent percentage:
                                          </span>{" "}
                                          {saleListedPercent}%
                                        </p>
                                        <p>
                                          <span className="font-semibold text-foreground">
                                            Calculated price:
                                          </span>{" "}
                                          {formatEthLabel(salePriceEth)}
                                        </p>
                                        <p>
                                          <span className="font-semibold text-foreground">
                                            Fiat equivalent:
                                          </span>{" "}
                                          {renderFiatSummary(salePriceEth, fiatRates)}
                                        </p>
                                      </div>
                                    ) : (
                                      <p className="mt-3">
                                        Enter a positive whole-number amount to preview the sale.
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="mt-4 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-7 text-amber-950">
                                  The usufruct NFT will not be transferred. The linked economic
                                  value will not be transferred. Only the selected free-value
                                  ERC-20 amount is escrowed for sale.
                                </div>

                                <div className="mt-4 flex flex-wrap items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void handleCreatePrimarySaleListing(
                                        property,
                                        saleAmount,
                                      );
                                    }}
                                    disabled={createListingButtonDisabled}
                                    className="inline-flex items-center justify-center rounded-full bg-stone-900 px-4 py-3 text-sm font-semibold text-stone-50 transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {createListingButtonLabel}
                                  </button>

                                  {!primaryValueSaleAddress ? (
                                    <span className="text-sm text-muted">
                                      Primary sale contract is not configured on the registry.
                                    </span>
                                  ) : null}

                                  {registration?.status === "MockVerified" ? (
                                    <span className="text-sm text-muted">
                                      Tokenize the property before creating a primary sale offer.
                                    </span>
                                  ) : null}

                                  {saleAmountIsValid &&
                                  BigInt(saleAmount) > BigInt(ownerFreeBalanceUnits) ? (
                                    <span className="text-sm text-muted">
                                      Requested amount exceeds the owner free-value balance available
                                      outside escrow.
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              <div className="mt-4 rounded-3xl border border-line bg-white/75 p-4">
                                <p className="soft-label">Marketplace listings</p>
                                {activeListings.length ? (
                                  <div className="mt-4 space-y-3">
                                    {activeListings.map((listing) => {
                                      const listingPriceEth = weiToEthDecimalString(
                                        listing.priceWei,
                                        8,
                                      );
                                      const listingPercent = divideDecimalStrings(
                                        multiplyDecimalStrings(listing.amount, "100", 4),
                                        TOTAL_VALUE_UNITS,
                                        4,
                                      );
                                      const isCurrentPurchase =
                                        purchaseTarget?.listingId === listing.listingId &&
                                        isCurrentPurchaseProperty;
                                      const buyButtonDisabled =
                                        !isConnected ||
                                        !primaryValueSaleAddress ||
                                        chainId !== sepolia.id ||
                                        isDraftOwner ||
                                        isSubmittingPrimarySalePurchase ||
                                        isConfirmingPurchase;
                                      const buyButtonLabel =
                                        isCurrentPurchase && isSubmittingPrimarySalePurchase
                                          ? "Submitting purchase..."
                                          : isCurrentPurchase && isConfirmingPurchase
                                            ? "Waiting for purchase..."
                                            : "Buy with ETH";

                                      return (
                                        <div
                                          key={`${property.localPropertyId}-${listing.listingId}`}
                                          className="rounded-3xl border border-line bg-stone-50/80 p-4"
                                        >
                                          <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                              <p className="text-sm font-semibold text-foreground">
                                                Listing #{listing.listingId}
                                              </p>
                                              <p className="mt-1 text-sm text-muted">
                                                {formatDecimalForDisplay(listing.amount, 0)} units •{" "}
                                                {listingPercent}% of the total economic value
                                              </p>
                                            </div>
                                            <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-stone-50">
                                              {listing.status}
                                            </span>
                                          </div>
                                          <div className="mt-3 grid gap-3 text-sm text-muted md:grid-cols-2">
                                            <p>
                                              <span className="font-semibold text-foreground">
                                                Price:
                                              </span>{" "}
                                              {formatEthLabel(listingPriceEth)}
                                            </p>
                                            <p>
                                              <span className="font-semibold text-foreground">
                                                Fiat:
                                              </span>{" "}
                                              {renderFiatSummary(listingPriceEth, fiatRates)}
                                            </p>
                                          </div>
                                          <div className="mt-4 flex flex-wrap items-center gap-3">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                void handleBuyPrimarySaleListing(
                                                  property,
                                                  listing.listingId,
                                                  listing.priceWei,
                                                );
                                              }}
                                              disabled={buyButtonDisabled}
                                              className="inline-flex items-center justify-center rounded-full border border-stone-900/15 bg-white px-4 py-3 text-sm font-semibold text-stone-900 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                              {buyButtonLabel}
                                            </button>

                                            {isDraftOwner ? (
                                              <span className="text-sm text-muted">
                                                The seller cannot buy this listing.
                                              </span>
                                            ) : null}

                                            {!isConnected ? (
                                              <span className="text-sm text-muted">
                                                Connect a buyer wallet to purchase this listing.
                                              </span>
                                            ) : null}

                                            {isConnected && chainId !== sepolia.id ? (
                                              <span className="text-sm text-muted">
                                                Switch to Sepolia before purchasing.
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="mt-4 text-sm leading-7 text-muted">
                                    No offer is live yet. The first confirmed listing will appear
                                    here as the local marketplace view.
                                  </p>
                                )}
                              </div>

                              <div className="mt-4 rounded-3xl border border-line bg-white/75 p-4">
                                <p className="soft-label">Buyer balances</p>
                                {buyerBalances.length ? (
                                  <div className="mt-4 space-y-3">
                                    {buyerBalances.map((buyerBalance) => {
                                      const buyerPercent = divideDecimalStrings(
                                        multiplyDecimalStrings(
                                          buyerBalance.freeValueUnits,
                                          "100",
                                          4,
                                        ),
                                        TOTAL_VALUE_UNITS,
                                        4,
                                      );
                                      const buyerValueEth = multiplyDecimalStrings(
                                        marketValueEth,
                                        divideDecimalStrings(
                                          buyerBalance.freeValueUnits,
                                          TOTAL_VALUE_UNITS,
                                          8,
                                        ),
                                        8,
                                      );

                                      return (
                                        <div
                                          key={`${property.localPropertyId}-${buyerBalance.buyerWallet}`}
                                          className="rounded-3xl border border-line bg-stone-50/80 p-4"
                                        >
                                          <p className="mono break-all text-sm text-foreground">
                                            {buyerBalance.buyerWallet}
                                          </p>
                                          <div className="mt-3 grid gap-3 text-sm text-muted md:grid-cols-2">
                                            <p>
                                              <span className="font-semibold text-foreground">
                                                Free-value units:
                                              </span>{" "}
                                              {formatDecimalForDisplay(
                                                buyerBalance.freeValueUnits,
                                                0,
                                              )}{" "}
                                              ({buyerPercent}%)
                                            </p>
                                            <p>
                                              <span className="font-semibold text-foreground">
                                                Economic value:
                                              </span>{" "}
                                              {formatEthLabel(buyerValueEth)}
                                            </p>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="mt-4 text-sm leading-7 text-muted">
                                    Buyer balances will appear here after the first confirmed
                                    marketplace purchase.
                                  </p>
                                )}
                              </div>

                              <div className="mt-4 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-7 text-amber-950">
                                Right of Free Value does not grant occupancy, residence, or use
                                rights. The usufruct NFT keeps the right of use and the linked
                                economic value together.
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="text-sm leading-7 text-muted">
                  No drafts stored yet. The first successful POST to
                  <span className="mono"> /api/properties</span> will append a
                  record to
                  <span className="mono"> offchain-db/db.json</span>.
                </p>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function Field({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="soft-label">{label}</span>
      {children}
    </label>
  );
}

function HashRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-line bg-white/75 p-4">
      <p className="soft-label">{label}</p>
      <p className="mono mt-2 break-all text-sm leading-6 text-foreground">
        {value}
      </p>
    </div>
  );
}

function Notice({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "danger" | "warning";
}) {
  const toneClassName =
    tone === "danger"
      ? "border-danger/20 bg-danger/5 text-danger"
      : "border-amber-500/25 bg-amber-500/10 text-amber-900";

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClassName}`}>
      {children}
    </div>
  );
}

function PricingRow({
  label,
  ethValue,
  fiatRates,
}: {
  label: string;
  ethValue: string;
  fiatRates: FiatRatesSuccessResponse | null;
}) {
  return (
    <div className="rounded-3xl border border-line bg-white/75 p-4">
      <p className="soft-label">{label}</p>
      <p className="mt-2 text-base font-semibold text-foreground">
        {formatEthLabel(ethValue)}
      </p>
      <p className="mt-2 text-sm leading-6 text-muted">
        {renderFiatSummary(ethValue, fiatRates)}
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-line bg-white/75 p-5">
      <p className="soft-label">{label}</p>
      <p className="mt-3 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function DashboardMetric({
  label,
  value,
  detail,
  mono = false,
}: {
  label: string;
  value: string;
  detail?: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-line bg-white/75 p-4">
      <p className="soft-label">{label}</p>
      <p
        className={`mt-2 text-base font-semibold text-foreground ${
          mono ? "mono break-all text-sm" : ""
        }`}
      >
        {value}
      </p>
      {detail ? (
        <p className="mt-2 text-sm leading-6 text-muted">{detail}</p>
      ) : null}
    </div>
  );
}

function formatEthLabel(value: string) {
  return `${formatDecimalForDisplay(value, 6)} ETH`;
}

function formatDocumentType(value: MockDocumentType) {
  switch (value) {
    case "mock_deed":
      return "Mock deed";
    case "mock_owner_id":
      return "Mock owner id";
    case "mock_tax_record":
      return "Mock tax record";
    default:
      return value;
  }
}

function getFiatRateLabel(
  currency: "usd" | "brl",
  fiatRates: FiatRatesSuccessResponse | null,
  isLoadingFiatRates: boolean,
) {
  if (isLoadingFiatRates) {
    return "Loading";
  }

  if (!fiatRates) {
    return "Unavailable";
  }

  if (currency === "brl" && !fiatRates.rates.brl) {
    return "BRL unavailable";
  }

  const rate = fiatRates.rates[currency];

  if (!rate) {
    return "Unavailable";
  }

  return formatFiatLabel(currency, rate);
}

function renderFiatSummary(
  ethValue: string,
  fiatRates: FiatRatesSuccessResponse | null,
) {
  if (!fiatRates) {
    return "Fiat rates unavailable.";
  }

  const usdRate = fiatRates.rates.usd;
  const brlRate = fiatRates.rates.brl;
  const summary = [];

  if (usdRate) {
    summary.push(formatFiatLabel("usd", multiplyDecimalStrings(ethValue, usdRate, 2)));
  }

  if (brlRate) {
    summary.push(formatFiatLabel("brl", multiplyDecimalStrings(ethValue, brlRate, 2)));
  } else {
    summary.push("BRL unavailable at the moment");
  }

  return summary.join(" • ");
}

function formatFiatLabel(currency: "usd" | "brl", value: string) {
  const formattedValue = formatDecimalForDisplay(value, 2);

  return currency === "usd"
    ? `$${formattedValue}`
    : `R$ ${formattedValue}`;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "unknown time";
  }

  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function shorten(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function shortenId(value: string) {
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function shortenHash(value: string) {
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

const inputClassName =
  "w-full rounded-2xl border border-line bg-white/85 px-4 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10";
