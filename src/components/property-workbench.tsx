"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { sepolia } from "wagmi/chains";
import { useAccount } from "wagmi";
import { WalletPanel } from "@/components/wallet-panel";
import {
  divideDecimalStrings,
  formatDecimalForDisplay,
  multiplyDecimalStrings,
  parseDecimalToUnits,
  scaleBpsToPercent,
  weiToEthDecimalString,
} from "@/lib/safe-decimal";
import type {
  FiatRatesResponse,
  FiatRatesSuccessResponse,
  PropertyDraftInput,
  SavedPropertyRecord,
} from "@/offchain/schemas";

type PropertyWorkbenchProps = {
  initialProperties: SavedPropertyRecord[];
};

type FormState = Omit<PropertyDraftInput, "ownerWallet">;

type PricingPreview = {
  marketValueEth: string;
  listedUnits: string;
  listedPercent: string;
  offerPriceEth: string;
  unitPriceEth: string;
};

const TOTAL_VALUE_UNITS = "1000000";
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
};

export function PropertyWorkbench({
  initialProperties,
}: PropertyWorkbenchProps) {
  const { address, chainId, isConnected } = useAccount();
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [listedUnits, setListedUnits] = useState("300000");
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

  const updateField = <Key extends keyof FormState>(
    field: Key,
    value: FormState[Key],
  ) => {
    setFormState((current) => ({ ...current, [field]: value }));
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
          ...formState,
          ownerWallet: address,
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
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unexpected save failure.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <section className="glass-panel overflow-hidden rounded-[2rem]">
        <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10 lg:py-10">
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="soft-label">Milestone 0.2</p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
                Fiat pricing through OKX, cached server-side for the MVP flow.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted sm:text-lg">
                The frontend consumes a local pricing route, while ETH settlement
                stays untouched. USD is primary, BRL is runtime-validated, and
                cached fallback remains visible to the operator.
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
                label="USD per ETH"
                value={getFiatRateLabel("usd", fiatRates, isLoadingFiatRates)}
              />
              <StatCard
                label="BRL per ETH"
                value={getFiatRateLabel("brl", fiatRates, isLoadingFiatRates)}
              />
              <StatCard
                label="Drafts saved"
                value={properties.length.toString()}
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

            {fiatRates?.warning === "BRL_ROUTE_UNAVAILABLE" ? (
              <Notice tone="warning">BRL unavailable at the moment.</Notice>
            ) : null}
          </div>

          <WalletPanel />
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <form
          onSubmit={handleSubmit}
          className="glass-panel rounded-[1.75rem] p-6 sm:p-8"
        >
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <p className="soft-label">Server-side intake</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">
                Save an off-chain property draft
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

            <div className="grid gap-5 md:grid-cols-3">
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

              <Field label="Listed free value units">
                <input
                  value={listedUnits}
                  onChange={(event) => setListedUnits(event.target.value)}
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
          </div>

          <div className="mt-8 flex flex-col gap-4 border-t border-line pt-6">
            <div className="rounded-3xl border border-dashed border-line bg-white/55 p-4 text-sm leading-7 text-muted">
              Mock documents are attached automatically for this milestone:
              <span className="mono block text-foreground">
                mock-deed.pdf, mock-owner-id.pdf, mock-tax-record.pdf
              </span>
            </div>

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
              Deterministic output preview
            </h2>

            {lastSaved ? (
              <div className="mt-6 space-y-4">
                <HashRow label="Property metadata" value={lastSaved.metadataHash} />
                <HashRow label="Location metadata" value={lastSaved.locationHash} />
                <HashRow label="Documents metadata" value={lastSaved.documentsHash} />
              </div>
            ) : (
              <p className="mt-6 text-sm leading-7 text-muted">
                Save the first property draft to inspect deterministic hashes and
                the normalized coordinate payload.
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
                    property.metadata.marketValueWei,
                    8,
                  );

                  return (
                    <article
                      key={property.localPropertyId}
                      className="rounded-3xl border border-line bg-white/75 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-foreground">
                            {property.metadata.description || "Unnamed property"}
                          </p>
                          <p className="mt-1 text-sm text-muted">
                            {property.location.address.street},{" "}
                            {property.location.address.number},{" "}
                            {property.location.address.city}
                          </p>
                        </div>
                        <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                          {scaleBpsToPercent(property.metadata.linkedValueBps)} linked
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
                            {property.metadata.ownerWallet}
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
                            {property.location.location.lat},{" "}
                            {property.location.location.lng}
                          </p>
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

const inputClassName =
  "w-full rounded-2xl border border-line bg-white/85 px-4 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10";
