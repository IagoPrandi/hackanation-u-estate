export type PropertyStatus =
  | "Draft"
  | "PendingMockVerification"
  | "MockVerified"
  | "Tokenized"
  | "ActiveSale"
  | "SoldOut";

export type DocumentType = "mock_deed" | "mock_owner_id" | "mock_tax_record";

export type PropertyDocument = {
  type: DocumentType;
  filename: string;
};

export type Property = {
  id: string;
  propertyId: string;
  title: string;
  street: string;
  number: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  lat: string;
  lng: string;
  description: string;
  marketValueEth: string;
  linkedValueBps: number;
  totalValueUnits: number;
  linkedValueUnits: number;
  freeValueUnits: number;
  soldFreeValueUnits: number;
  activeListings: number;
  status: PropertyStatus;
  thumbVariant: ThumbVariant;
  documents: PropertyDocument[];
  metadataHash: string;
  documentsHash: string;
  locationHash: string;
  valueTokenAddress?: string;
  usufructTokenId?: string;
  ownerWallet?: string;
  createdAt: string;
};

export type Listing = {
  listingId: string;
  propertyId: string;
  amount: number;
  priceWei: string;
  seller: string;
  status: "Active" | "Filled" | "Cancelled";
  listedAt: string;
  txHash: string;
};

export type Transaction = {
  id: string;
  type: string;
  propertyTitle: string;
  valueEth: string | null;
  status: "Confirmado" | "Pendente" | "Falhou";
  date: string;
  txHash: string;
};

export type User = {
  wallet: string;
  ensName: string;
  role: "owner" | "buyer";
  network: string;
};

export type Role = "owner" | "buyer";

export type ThumbVariant = "mix" | "orange" | "charcoal" | "cream" | "soft" | "deep";

export type RouteName =
  | "landing"
  | "dashboard"
  | "properties"
  | "property-new"
  | "property"
  | "property-publish"
  | "marketplace"
  | "listing"
  | "portfolio"
  | "transactions"
  | "learn"
  | "settings";

export type Route = {
  name: RouteName;
  params: { id?: string };
};

export type Navigate = (name: RouteName, params?: { id?: string }) => void;

export type TxStep = "sign" | "sent" | "confirming" | "done";
