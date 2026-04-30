import { isAddress } from "viem";
import { z } from "zod";
import { parseDecimalToUnits } from "@/lib/safe-decimal";

const coordinateSchema = z
  .string()
  .trim()
  .refine((value) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue);
  }, "Coordinate must be a valid number.");

const marketValueSchema = z
  .string()
  .trim()
  .min(1, "Market value is required.")
  .refine((value) => {
    try {
      parseDecimalToUnits(value, 18);
      return true;
    } catch {
      return false;
    }
  }, "Market value must be a valid ETH amount.");

export const propertyIntakeSchema = z.object({
  ownerWallet: z
    .string()
    .trim()
    .refine((value) => isAddress(value), "Owner wallet must be a valid address."),
  marketValueEth: marketValueSchema,
  linkedValueBps: z.coerce
    .number()
    .int()
    .gt(0, "Linked value bps must be greater than zero.")
    .lt(10_000, "Linked value bps must stay below 10,000."),
  description: z
    .string()
    .trim()
    .max(500, "Description must stay under 500 characters.")
    .optional()
    .transform((value) => value || undefined),
  street: z.string().trim().min(1, "Street is required."),
  number: z.string().trim().min(1, "Number is required."),
  city: z.string().trim().min(1, "City is required."),
  state: z.string().trim().min(1, "State is required."),
  country: z.string().trim().min(1, "Country is required."),
  postalCode: z.string().trim().min(1, "Postal code is required."),
  lat: coordinateSchema,
  lng: coordinateSchema,
});

export type PropertyDraftInput = z.infer<typeof propertyIntakeSchema>;

export type PropertyMetadataV1 = {
  version: "1.0";
  localPropertyId: string;
  ownerWallet: string;
  marketValueWei: string;
  linkedValueBps: number;
  description?: string;
  createdAt: string;
};

export type LocationMetadataV1 = {
  version: "1.0";
  localPropertyId: string;
  address: {
    street: string;
    number: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  location: {
    lat: string;
    lng: string;
  };
};

export type DocumentsMetadataV1 = {
  version: "1.0";
  localPropertyId: string;
  documents: {
    type: "mock_deed" | "mock_owner_id" | "mock_tax_record";
    filename: string;
    mock: true;
    uploadedAt: string;
  }[];
};

export type SavedPropertyRecord = {
  localPropertyId: string;
  createdAt: string;
  metadata: PropertyMetadataV1;
  location: LocationMetadataV1;
  documents: DocumentsMetadataV1;
  metadataHash: string;
  locationHash: string;
  documentsHash: string;
};

export type OffchainDatabase = {
  properties: SavedPropertyRecord[];
};

export function normalizeCoordinate(value: string) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    throw new Error("Coordinate could not be normalized.");
  }

  return numericValue.toFixed(6);
}
