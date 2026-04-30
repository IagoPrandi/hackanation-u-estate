import "server-only";

import { getDb } from "@/offchain/db";
import { parseDecimalToUnits } from "@/lib/safe-decimal";
import { hashStableJson } from "@/offchain/hash";
import {
  type FiatRatesSnapshot,
  normalizeCoordinate,
  type DocumentsMetadataV1,
  type LocationMetadataV1,
  type PropertyDraftInput,
  type PropertyMetadataV1,
  type SavedPropertyRecord,
} from "@/offchain/schemas";

const mockDocumentBlueprint = [
  {
    type: "mock_deed" as const,
    filename: "mock-deed.pdf",
  },
  {
    type: "mock_owner_id" as const,
    filename: "mock-owner-id.pdf",
  },
  {
    type: "mock_tax_record" as const,
    filename: "mock-tax-record.pdf",
  },
];

export async function listPropertyDrafts() {
  const db = await getDb();

  return [...db.data.properties].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

export async function readFiatRatesCache() {
  const db = await getDb();

  return db.data.fiatRatesCache;
}

export async function writeFiatRatesCache(snapshot: FiatRatesSnapshot) {
  const db = await getDb();

  db.data.fiatRatesCache = snapshot;
  await db.write();

  return snapshot;
}

export async function createPropertyDraft(
  input: PropertyDraftInput,
): Promise<SavedPropertyRecord> {
  const db = await getDb();
  const createdAt = new Date().toISOString();
  const localPropertyId = crypto.randomUUID();

  const metadata: PropertyMetadataV1 = {
    version: "1.0",
    localPropertyId,
    ownerWallet: input.ownerWallet,
    marketValueWei: parseDecimalToUnits(input.marketValueEth, 18).toString(),
    linkedValueBps: input.linkedValueBps,
    description: input.description,
    createdAt,
  };

  const location: LocationMetadataV1 = {
    version: "1.0",
    localPropertyId,
    address: {
      street: input.street,
      number: input.number,
      city: input.city,
      state: input.state,
      country: input.country,
      postalCode: input.postalCode,
    },
    location: {
      lat: normalizeCoordinate(input.lat),
      lng: normalizeCoordinate(input.lng),
    },
  };

  const documents: DocumentsMetadataV1 = {
    version: "1.0",
    localPropertyId,
    documents: mockDocumentBlueprint.map((document) => ({
      ...document,
      mock: true,
      uploadedAt: createdAt,
    })),
  };

  const record: SavedPropertyRecord = {
    localPropertyId,
    createdAt,
    metadata,
    location,
    documents,
    metadataHash: hashStableJson(metadata),
    locationHash: hashStableJson(location),
    documentsHash: hashStableJson(documents),
  };

  db.data.properties.unshift(record);
  await db.write();

  return record;
}
