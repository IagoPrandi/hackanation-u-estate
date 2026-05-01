"use client";

export const primaryValueSaleAbi = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "createPrimarySaleListing",
    inputs: [
      { name: "propertyId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "listingId", type: "uint256" }],
  },
  {
    type: "event",
    anonymous: false,
    name: "PrimarySaleListed",
    inputs: [
      { indexed: true, name: "listingId", type: "uint256" },
      { indexed: true, name: "propertyId", type: "uint256" },
      { indexed: true, name: "seller", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "priceWei", type: "uint256" },
    ],
  },
  {
    type: "event",
    anonymous: false,
    name: "TokensEscrowed",
    inputs: [
      { indexed: true, name: "listingId", type: "uint256" },
      { indexed: true, name: "seller", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
  },
] as const;
