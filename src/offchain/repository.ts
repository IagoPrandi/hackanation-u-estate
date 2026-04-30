import "server-only";

import { getDb } from "@/offchain/db";
import { buildSavedPropertyRecord } from "@/offchain/property-draft";
import type {
  FiatRatesSnapshot,
  PropertyDraftInput,
  PropertyMockVerificationInput,
  PropertyOnchainRegistrationInput,
  PropertyTokenizationInput,
  SavedPropertyRecord,
} from "@/offchain/schemas";

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
  const record = buildSavedPropertyRecord(input);

  db.data.properties.unshift(record);
  await db.write();

  return record;
}

export async function saveOnchainPropertyRegistration(
  input: PropertyOnchainRegistrationInput,
) {
  const db = await getDb();
  const property = db.data.properties.find(
    (record) => record.localPropertyId === input.localPropertyId,
  );

  if (!property) {
    throw new Error("Property draft not found.");
  }

  if (property.onchainRegistration) {
    throw new Error("Property draft already linked to an on-chain property.");
  }

  property.onchainRegistration = {
    propertyId: input.propertyId,
    txHash: input.txHash,
    status: "PendingMockVerification",
    registeredAt: new Date().toISOString(),
  };

  await db.write();

  return property;
}

export async function savePropertyMockVerification(
  input: PropertyMockVerificationInput,
) {
  const db = await getDb();
  const property = db.data.properties.find(
    (record) => record.localPropertyId === input.localPropertyId,
  );

  if (!property) {
    throw new Error("Property draft not found.");
  }

  if (!property.onchainRegistration) {
    throw new Error("Property draft is not registered on-chain.");
  }

  if (property.onchainRegistration.propertyId !== input.propertyId) {
    throw new Error("On-chain property id does not match the saved draft.");
  }

  if (property.onchainRegistration.status === "MockVerified") {
    throw new Error("Property draft is already mock-verified.");
  }

  property.onchainRegistration.status = "MockVerified";
  property.onchainRegistration.verificationTxHash = input.txHash;
  property.onchainRegistration.verifiedAt = new Date().toISOString();

  await db.write();

  return property;
}

export async function savePropertyTokenization(
  input: PropertyTokenizationInput,
) {
  const db = await getDb();
  const property = db.data.properties.find(
    (record) => record.localPropertyId === input.localPropertyId,
  );

  if (!property) {
    throw new Error("Property draft not found.");
  }

  if (!property.onchainRegistration) {
    throw new Error("Property draft is not registered on-chain.");
  }

  if (property.onchainRegistration.propertyId !== input.propertyId) {
    throw new Error("On-chain property id does not match the saved draft.");
  }

  if (property.onchainRegistration.status === "PendingMockVerification") {
    throw new Error("Property draft must be mock-verified before tokenization.");
  }

  if (property.onchainRegistration.status === "Tokenized") {
    throw new Error("Property draft is already tokenized.");
  }

  property.onchainRegistration.status = "Tokenized";
  property.onchainRegistration.tokenizationTxHash = input.txHash;
  property.onchainRegistration.tokenizedAt = new Date().toISOString();
  property.onchainRegistration.valueTokenAddress = input.valueTokenAddress;
  property.onchainRegistration.usufructTokenId = input.usufructTokenId;
  property.onchainRegistration.linkedValueUnits = input.linkedValueUnits;
  property.onchainRegistration.freeValueUnits = input.freeValueUnits;

  await db.write();

  return property;
}
