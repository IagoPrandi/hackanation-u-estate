"use client";

import {
  startTransition,
  type FormEvent,
  type ReactNode,
  useMemo,
  useState,
} from "react";
import { sepolia } from "wagmi/chains";
import { useAccount } from "wagmi";
import type {
  PropertyDraftInput,
  SavedPropertyRecord,
} from "@/offchain/schemas";
import { parseDecimalToUnits, scaleBpsToPercent } from "@/lib/safe-decimal";
import { WalletPanel } from "@/components/wallet-panel";

type PropertyWorkbenchProps = {
  initialProperties: SavedPropertyRecord[];
};

type FormState = Omit<PropertyDraftInput, "ownerWallet">;

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
  const [properties, setProperties] =
    useState<SavedPropertyRecord[]>(initialProperties);
  const [lastSaved, setLastSaved] = useState<SavedPropertyRecord | null>(
    initialProperties[0] ?? null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

    startTransition(async () => {
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
          error instanceof Error
            ? error.message
            : "Unexpected save failure.",
        );
      } finally {
        setIsSaving(false);
      }
    });
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <section className="glass-panel overflow-hidden rounded-[2rem]">
        <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10 lg:py-10">
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="soft-label">Milestone 0.1</p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
                Local Docker-ready setup for a usufruct-backed property MVP.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted sm:text-lg">
                This workspace already wires Sepolia, deterministic hashing,
                wallet connection, and server-side lowdb persistence inside the
                same Next.js runtime expected by the PRD.
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
                label="Drafts saved"
                value={properties.length.toString()}
              />
              <StatCard
                label="Market value preview"
                value={marketValuePreview}
              />
              <StatCard
                label="Normalized coordinates"
                value={normalizedCoordinatePreview}
              />
            </div>
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
          </div>

          <div className="mt-8 flex flex-col gap-4 border-t border-line pt-6">
            <div className="rounded-3xl border border-dashed border-line bg-white/55 p-4 text-sm leading-7 text-muted">
              Mock documents are attached automatically for this milestone:
              <span className="mono block text-foreground">
                mock-deed.pdf, mock-owner-id.pdf, mock-tax-record.pdf
              </span>
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
                properties.map((property) => (
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
                        <p className="soft-label">Market value (wei)</p>
                        <p className="mono mt-1 break-all text-foreground">
                          {property.metadata.marketValueWei}
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
                ))
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-line bg-white/75 p-5">
      <p className="soft-label">{label}</p>
      <p className="mt-3 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function shorten(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

const inputClassName =
  "w-full rounded-2xl border border-line bg-white/85 px-4 py-3 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10";
