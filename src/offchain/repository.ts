import "server-only";

import { getDb } from "@/offchain/db";
import { buildSavedPropertyRecord } from "@/offchain/property-draft";
import type {
  FiatRatesSnapshot,
  PropertyDraftInput,
  PropertyPrimarySaleCancellationInput,
  PropertyPrimarySaleListingInput,
  PropertyPrimarySalePurchaseInput,
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

export async function savePropertyPrimarySaleListing(
  input: PropertyPrimarySaleListingInput,
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

  if (
    property.onchainRegistration.status !== "Tokenized" &&
    property.onchainRegistration.status !== "ActiveSale"
  ) {
    throw new Error("Property draft must be tokenized before primary sale.");
  }

  const existingListings = property.onchainRegistration.primarySaleListings ?? [];
  if (
    existingListings.some((listing) => listing.listingId === input.listingId)
  ) {
    throw new Error("Primary sale listing already saved locally.");
  }

  const activeEscrowedAmount =
    BigInt(property.onchainRegistration.activeEscrowedAmount ?? "0") +
    BigInt(input.amount);
  const activeListingsCount =
    BigInt(property.onchainRegistration.activeListingsCount ?? "0") + BigInt(1);

  property.onchainRegistration.status = "ActiveSale";
  property.onchainRegistration.activeEscrowedAmount =
    activeEscrowedAmount.toString();
  property.onchainRegistration.activeListingsCount =
    activeListingsCount.toString();
  property.onchainRegistration.totalFreeValueSold ??= "0";
  property.onchainRegistration.primarySaleListings = [
    {
      listingId: input.listingId,
      amount: input.amount,
      priceWei: input.priceWei,
      txHash: input.txHash,
      status: "Active",
      listedAt: new Date().toISOString(),
    },
    ...existingListings,
  ];

  await db.write();

  return property;
}

export async function savePropertyPrimarySalePurchase(
  input: PropertyPrimarySalePurchaseInput,
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

  const listings = property.onchainRegistration.primarySaleListings;
  if (!listings?.length) {
    throw new Error("Primary sale listing is not saved locally.");
  }

  const listingIndex = listings.findIndex(
    (listing) => listing.listingId === input.listingId,
  );
  if (listingIndex === -1) {
    throw new Error("Primary sale listing is not saved locally.");
  }

  const existingListing = listings[listingIndex];
  if (existingListing.status !== "Active") {
    throw new Error("Primary sale listing is not active locally.");
  }
  if (
    existingListing.amount !== input.amount ||
    existingListing.priceWei !== input.priceWei
  ) {
    throw new Error("Primary sale purchase does not match the saved listing.");
  }

  const updatedListings = [...listings];
  updatedListings[listingIndex] = {
    ...existingListing,
    status: "Filled",
    buyerWallet: input.buyerWallet,
    purchaseTxHash: input.txHash,
    purchasedAt: new Date().toISOString(),
  };

  const activeEscrowedAmount = (
    BigInt(property.onchainRegistration.activeEscrowedAmount ?? "0") -
    BigInt(input.amount)
  ).toString();
  const activeListingsCount = (
    BigInt(property.onchainRegistration.activeListingsCount ?? "0") - BigInt(1)
  ).toString();
  const totalFreeValueSold = (
    BigInt(property.onchainRegistration.totalFreeValueSold ?? "0") +
    BigInt(input.amount)
  ).toString();
  const freeValueUnits = BigInt(property.onchainRegistration.freeValueUnits ?? "0");
  const nextStatus =
    totalFreeValueSold === freeValueUnits.toString()
      ? "SoldOut"
      : activeListingsCount !== "0"
        ? "ActiveSale"
        : "Tokenized";

  const existingBuyerBalances = property.onchainRegistration.buyerBalances ?? [];
  const buyerBalanceIndex = existingBuyerBalances.findIndex(
    (entry) => entry.buyerWallet.toLowerCase() === input.buyerWallet.toLowerCase(),
  );
  const nextBuyerBalance = {
    buyerWallet: input.buyerWallet,
    freeValueUnits: input.amount,
    totalPaidWei: input.priceWei,
    lastPurchaseTxHash: input.txHash,
    acquiredAt: new Date().toISOString(),
  };
  const buyerBalances =
    buyerBalanceIndex === -1
      ? [nextBuyerBalance, ...existingBuyerBalances]
      : existingBuyerBalances.map((entry, index) =>
          index === buyerBalanceIndex
            ? {
                ...entry,
                freeValueUnits: (
                  BigInt(entry.freeValueUnits) + BigInt(input.amount)
                ).toString(),
                totalPaidWei: (
                  BigInt(entry.totalPaidWei) + BigInt(input.priceWei)
                ).toString(),
                lastPurchaseTxHash: input.txHash,
                acquiredAt: new Date().toISOString(),
              }
            : entry,
        );

  property.onchainRegistration.status = nextStatus;
  property.onchainRegistration.activeEscrowedAmount = activeEscrowedAmount;
  property.onchainRegistration.activeListingsCount = activeListingsCount;
  property.onchainRegistration.totalFreeValueSold = totalFreeValueSold;
  property.onchainRegistration.sellerReceivedWei = (
    BigInt(property.onchainRegistration.sellerReceivedWei ?? "0") +
    BigInt(input.priceWei)
  ).toString();
  property.onchainRegistration.buyerBalances = buyerBalances;
  property.onchainRegistration.primarySaleListings = updatedListings;

  await db.write();

  return property;
}

export async function savePropertyPrimarySaleCancellation(
  input: PropertyPrimarySaleCancellationInput,
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

  const listings = property.onchainRegistration.primarySaleListings;
  if (!listings?.length) {
    throw new Error("Primary sale listing is not saved locally.");
  }

  const listingIndex = listings.findIndex(
    (listing) => listing.listingId === input.listingId,
  );
  if (listingIndex === -1) {
    throw new Error("Primary sale listing is not saved locally.");
  }

  const existingListing = listings[listingIndex];
  if (existingListing.status !== "Active") {
    throw new Error("Primary sale listing is not active locally.");
  }
  if (existingListing.amount !== input.amount) {
    throw new Error("Primary sale cancellation does not match the saved listing.");
  }

  const updatedListings = [...listings];
  updatedListings[listingIndex] = {
    ...existingListing,
    status: "Cancelled",
  };

  const activeEscrowedAmount = (
    BigInt(property.onchainRegistration.activeEscrowedAmount ?? "0") -
    BigInt(input.amount)
  ).toString();
  const activeListingsCount = (
    BigInt(property.onchainRegistration.activeListingsCount ?? "0") - BigInt(1)
  ).toString();
  const nextStatus = activeListingsCount !== "0" ? "ActiveSale" : "Tokenized";

  property.onchainRegistration.status = nextStatus;
  property.onchainRegistration.activeEscrowedAmount = activeEscrowedAmount;
  property.onchainRegistration.activeListingsCount = activeListingsCount;
  property.onchainRegistration.totalFreeValueSold ??= "0";
  property.onchainRegistration.primarySaleListings = updatedListings;

  await db.write();

  return property;
}
