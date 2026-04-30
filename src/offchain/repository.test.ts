import os from "node:os";
import path from "node:path";
import { mkdir, rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildPropertyDraftPreview } from "@/offchain/property-draft";
import { resetDbForTests } from "@/offchain/db";
import {
  createPropertyDraft,
  listPropertyDrafts,
  savePropertyMockVerification,
  saveOnchainPropertyRegistration,
} from "@/offchain/repository";
import { hashStableJson } from "@/offchain/hash";
import type { PropertyDraftInput } from "@/offchain/schemas";

const originalEnv = { ...process.env };

describe("property drafts", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(
      os.tmpdir(),
      `hacknation-u-estate-drafts-${crypto.randomUUID()}`,
    );

    await mkdir(tempDir, { recursive: true });
    process.env.LOCAL_DB_PATH = path.join(tempDir, "db.json");
    resetDbForTests();
  });

  afterEach(async () => {
    resetDbForTests();

    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }

    Object.assign(process.env, originalEnv);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("builds deterministic preview hashes from the PRD hash payloads", () => {
    const input = createInput();

    const preview = buildPropertyDraftPreview(input, {
      localPropertyId: "4bbf258c-d4d7-40dd-a16d-ee5320cd3f95",
    });

    expect(preview.location).toEqual({
      lat: "-23.550500",
      lng: "-46.633300",
    });
    expect(preview.metadataForHash.address.city).toBe("Sao Paulo");
    expect(preview.documentsForHash.documents).toEqual([
      {
        type: "mock_deed",
        filename: "mock_matricula.pdf",
        mock: true,
      },
      {
        type: "mock_owner_id",
        filename: "mock_owner_id.pdf",
        mock: true,
      },
    ]);
    expect(preview.documentsHash).toBe(hashStableJson(preview.documentsForHash));
    expect(preview.locationHash).toBe(hashStableJson(preview.locationForHash));
    expect(preview.metadataHash).toBe(hashStableJson(preview.metadataForHash));
  });

  it("saves the property draft server-side with uploadedAt outside documentsHash", async () => {
    const input = createInput();

    const record = await createPropertyDraft({
      ...input,
      localPropertyId: "4bbf258c-d4d7-40dd-a16d-ee5320cd3f95",
    });

    expect(record.address.street).toBe("Rua Exemplo");
    expect(record.location.lat).toBe("-23.550500");
    expect(record.documents[0].uploadedAt).toBe(record.createdAt);
    expect(record.documentsHash).toBe(
      hashStableJson({
        version: "1.0",
        propertyLocalId: record.localPropertyId,
        documents: record.documents.map(({ filename, mock, type }) => ({
          type,
          filename,
          mock,
        })),
      }),
    );

    const drafts = await listPropertyDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].localPropertyId).toBe(record.localPropertyId);
  });

  it("persists the on-chain property id after registration confirmation", async () => {
    const record = await createPropertyDraft(createInput());

    const updatedRecord = await saveOnchainPropertyRegistration({
      kind: "registration",
      localPropertyId: record.localPropertyId,
      propertyId: "1",
      txHash:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
    });

    expect(updatedRecord.onchainRegistration).toMatchObject({
      propertyId: "1",
      txHash:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
      status: "PendingMockVerification",
    });
    expect(updatedRecord.onchainRegistration?.registeredAt).toBeTruthy();

    const drafts = await listPropertyDrafts();
    expect(drafts[0].onchainRegistration?.propertyId).toBe("1");
  });

  it("persists mock verification after on-chain approval", async () => {
    const record = await createPropertyDraft(createInput());

    await saveOnchainPropertyRegistration({
      kind: "registration",
      localPropertyId: record.localPropertyId,
      propertyId: "1",
      txHash:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
    });

    const updatedRecord = await savePropertyMockVerification({
      kind: "mockVerification",
      localPropertyId: record.localPropertyId,
      propertyId: "1",
      txHash:
        "0x2222222222222222222222222222222222222222222222222222222222222222",
    });

    expect(updatedRecord.onchainRegistration).toMatchObject({
      propertyId: "1",
      status: "MockVerified",
      verificationTxHash:
        "0x2222222222222222222222222222222222222222222222222222222222222222",
    });
    expect(updatedRecord.onchainRegistration?.verifiedAt).toBeTruthy();
  });
});

function createInput(): PropertyDraftInput {
  return {
    localPropertyId: "4bbf258c-d4d7-40dd-a16d-ee5320cd3f95",
    ownerWallet: "0x000000000000000000000000000000000000dEaD",
    marketValueEth: "10",
    linkedValueBps: 2000,
    description: "Sample property",
    street: "Rua Exemplo",
    number: "123",
    city: "Sao Paulo",
    state: "SP",
    country: "BR",
    postalCode: "00000-000",
    lat: "-23.5505",
    lng: "-46.6333",
    documents: [
      {
        type: "mock_deed",
        filename: "mock_matricula.pdf",
      },
      {
        type: "mock_owner_id",
        filename: "mock_owner_id.pdf",
      },
    ],
  };
}
