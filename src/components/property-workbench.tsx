"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { parseEventLogs, type Hex } from "viem";
import { sepolia } from "wagmi/chains";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { WalletPanel } from "@/components/wallet-panel";
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
  const [draftLocalId, setDraftLocalId] = useState(() => crypto.randomUUID());
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [listedUnits] = useState("300000");
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

  const registeredPropertiesCount = properties.filter(
    (property) => property.onchainRegistration,
  ).length;
  const mockVerifiedPropertiesCount = properties.filter(
    (property) => property.onchainRegistration?.status === "MockVerified",
  ).length;
  const activeRegistrationErrorMessage =
    registrationReceiptError?.message ?? registrationErrorMessage;
  const activeVerificationErrorMessage =
    verificationReceiptError?.message ?? verificationErrorMessage;

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

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <section className="glass-panel overflow-hidden rounded-[2rem]">
        <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10 lg:py-10">
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="soft-label">Milestone 0.5</p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
                Approve mock documents after the property is registered.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted sm:text-lg">
                The flow now carries property drafts from registration into mock
                verification, with owner or verifier-role approval on Sepolia.
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
                registration from the dashboard.
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
                  const isDraftOwner =
                    Boolean(address) &&
                    property.ownerWallet.toLowerCase() === address?.toLowerCase();
                  const isCurrentRegistration =
                    registeringLocalPropertyId === property.localPropertyId;
                  const isCurrentVerification =
                    verifyingLocalPropertyId === property.localPropertyId;
                  const registerButtonDisabled =
                    !isConnected ||
                    !isDraftOwner ||
                    chainId !== sepolia.id ||
                    !propertyRegistryAddress ||
                    Boolean(property.onchainRegistration) ||
                    isRegisteringOnchain ||
                    isConfirmingRegistration;
                  const registerButtonLabel = property.onchainRegistration
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
                    !property.onchainRegistration ||
                    property.onchainRegistration.status !== "PendingMockVerification" ||
                    isSubmittingMockVerification ||
                    isConfirmingVerification;
                  const verifyButtonLabel =
                    property.onchainRegistration?.status === "MockVerified"
                      ? "Mock verified"
                      : isCurrentVerification && isSubmittingMockVerification
                        ? "Submitting verification..."
                        : isCurrentVerification && isConfirmingVerification
                          ? "Waiting for verification..."
                          : "Approve mock documents";

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
