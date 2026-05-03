"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SavedPropertyRecord } from "@/offchain/schemas";
import { ethToWei, useUEstateActions, type NewPropertyForm } from "./actions";
import { DashboardPage } from "./dashboard";
import {
  formatBrl,
  formatUsd,
  initialListings,
  initialProperties,
  initialTransactions,
  initialUser,
  shortHash,
} from "./data";
import { LandingPage } from "./landing";
import { ListingDetailPage, MarketplacePage } from "./marketplace";
import {
  fetchProperties,
  recordsToListings,
  recordsToTransactions,
  recordToProperty,
} from "./onchain";
import {
  LearnPage,
  PortfolioPage,
  SettingsPage,
  TransactionsPage,
} from "./portfolio";
import { PropertiesPage, PropertyNewPage } from "./properties";
import {
  PropertyDetailPage,
  PropertyPublishPage,
} from "./property-detail";
import { Sidebar, Topbar } from "./ui";
import type {
  Listing,
  Navigate,
  Property,
  Role,
  Route,
  RouteName,
  Transaction,
  TxStep,
  User,
} from "./types";
import { useWallet } from "./wallet";

export type StepCb = (step: TxStep) => void;

export type AppActions = {
  ready: boolean;
  /** Single submit handler. In chain mode persists draft + registers; in mock mode just appends a property. */
  submitProperty: (form: NewPropertyForm, onStep: StepCb) => Promise<Property>;
  verifyProperty: (
    localId: string,
    onchainId: string | undefined,
    onStep: StepCb,
  ) => Promise<void>;
  tokenizeProperty: (
    localId: string,
    onchainId: string | undefined,
    onStep: StepCb,
  ) => Promise<void>;
  publishListing: (
    localId: string,
    onchainId: string | undefined,
    units: number,
    onStep: StepCb,
  ) => Promise<Listing>;
  buyListing: (
    localId: string,
    listingId: string,
    units: number,
    totalPriceEth: string,
    onStep: StepCb,
  ) => Promise<void>;
  cancelListing: (
    localId: string,
    listingId: string,
    onStep: StepCb,
  ) => Promise<void>;
};

const TOTAL_VALUE_UNITS = 1_000_000;

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mockTxFlow(onStep: StepCb) {
  onStep("sign");
  await delay(700);
  onStep("sent");
  await delay(700);
  onStep("confirming");
  await delay(900);
  onStep("done");
}

export function UEstateApp() {
  const wallet = useWallet();
  const actions = useUEstateActions(wallet);

  const [route, setRoute] = useState<Route>({ name: "landing", params: {} });
  const [properties, setProperties] = useState<Property[]>(initialProperties);
  const [listings, setListings] = useState<Listing[]>(initialListings);
  const [transactions, setTransactions] =
    useState<Transaction[]>(initialTransactions);
  const [userBase, setUser] = useState<User>(initialUser);
  const [role, setRole] = useState<Role>("owner");
  const user = useMemo<User>(
    () =>
      wallet.address ? { ...userBase, wallet: wallet.address } : userBase,
    [userBase, wallet.address],
  );
  const [chainMode, setChainMode] = useState(false);

  const navigate: Navigate = useCallback((name: RouteName, params = {}) => {
    setRoute({ name, params });
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, []);

  const applyRecord = useCallback((record: SavedPropertyRecord) => {
    const p = recordToProperty(record);
    setProperties((prev) => {
      const idx = prev.findIndex((x) => x.id === p.id);
      if (idx === -1) return [p, ...prev];
      const next = [...prev];
      next[idx] = p;
      return next;
    });
  }, []);

  const refreshFromApi = useCallback(async () => {
    try {
      const records = await fetchProperties();
      if (records.length === 0) return false;
      setProperties(records.map(recordToProperty));
      setListings(recordsToListings(records));
      setTransactions(recordsToTransactions(records));
      setChainMode(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    // Initial offchain DB snapshot load. setState fires inside the async fetch
    // callback (an external boundary), which is the right pattern here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshFromApi();
  }, [refreshFromApi]);

  const submitProperty = useCallback<AppActions["submitProperty"]>(
    async (form, onStep) => {
      if (actions.ready) {
        const record = await actions.submitProperty(form, onStep);
        applyRecord(record);
        await refreshFromApi();
        return recordToProperty(record);
      }

      // Mock fallback
      await mockTxFlow(onStep);
      const linkedValueBps = Math.round(form.reservedPct * 100);
      const linkedUnits = Math.round(
        TOTAL_VALUE_UNITS * (form.reservedPct / 100),
      );
      const id = "prop-" + Date.now();
      const property: Property = {
        id,
        propertyId: String(Math.floor(Math.random() * 1000) + 10),
        title:
          form.street && form.number
            ? `${form.street}, ${form.number}`
            : form.street || `Imóvel ${id.slice(-4)}`,
        street: form.street,
        number: form.number,
        city: form.city,
        state: form.state,
        country: form.country,
        postalCode: form.postalCode,
        lat: form.lat || "-23.55",
        lng: form.lng || "-46.63",
        description: form.description,
        marketValueEth: form.marketValueEth,
        linkedValueBps,
        totalValueUnits: TOTAL_VALUE_UNITS,
        linkedValueUnits: linkedUnits,
        freeValueUnits: TOTAL_VALUE_UNITS - linkedUnits,
        soldFreeValueUnits: 0,
        activeListings: 0,
        status: "PendingMockVerification",
        thumbVariant: "mix",
        documents: form.documents,
        metadataHash: shortHash(),
        documentsHash: shortHash(),
        locationHash: shortHash(),
        createdAt: new Date().toISOString(),
      };
      setProperties((prev) => [property, ...prev]);
      setTransactions((prev) => [
        {
          id: "tx-" + Date.now(),
          type: "Cadastro",
          propertyTitle: property.title,
          valueEth: null,
          status: "Confirmado",
          date: new Date().toISOString(),
          txHash: shortHash(),
        },
        ...prev,
      ]);
      return property;
    },
    [actions, applyRecord, refreshFromApi],
  );

  const verifyProperty = useCallback<AppActions["verifyProperty"]>(
    async (localId, onchainId, onStep) => {
      if (actions.ready && onchainId && onchainId !== "0") {
        const record = await actions.mockVerify(localId, onchainId, onStep);
        applyRecord(record);
        await refreshFromApi();
        return;
      }
      await mockTxFlow(onStep);
      setProperties((prev) =>
        prev.map((p) =>
          p.id === localId ? { ...p, status: "MockVerified" } : p,
        ),
      );
      const target = properties.find((p) => p.id === localId);
      setTransactions((prev) => [
        {
          id: "tx-" + Date.now(),
          type: "Análise concluída",
          propertyTitle: target?.title ?? "—",
          valueEth: null,
          status: "Confirmado",
          date: new Date().toISOString(),
          txHash: shortHash(),
        },
        ...prev,
      ]);
    },
    [actions, applyRecord, properties, refreshFromApi],
  );

  const tokenizeProperty = useCallback<AppActions["tokenizeProperty"]>(
    async (localId, onchainId, onStep) => {
      if (actions.ready && onchainId && onchainId !== "0") {
        const record = await actions.tokenize(localId, onchainId, onStep);
        applyRecord(record);
        await refreshFromApi();
        return;
      }
      await mockTxFlow(onStep);
      setProperties((prev) =>
        prev.map((p) =>
          p.id === localId
            ? {
                ...p,
                status: "Tokenized",
                valueTokenAddress: p.valueTokenAddress ?? shortHash(),
                usufructTokenId: p.usufructTokenId ?? p.propertyId,
              }
            : p,
        ),
      );
      const target = properties.find((p) => p.id === localId);
      setTransactions((prev) => [
        {
          id: "tx-" + Date.now(),
          type: "Pronto pra publicar",
          propertyTitle: target?.title ?? "—",
          valueEth: null,
          status: "Confirmado",
          date: new Date().toISOString(),
          txHash: shortHash(),
        },
        ...prev,
      ]);
    },
    [actions, applyRecord, properties, refreshFromApi],
  );

  const publishListing = useCallback<AppActions["publishListing"]>(
    async (localId, onchainId, units, onStep) => {
      if (actions.ready && onchainId && onchainId !== "0") {
        const record = await actions.publishListing(
          localId,
          onchainId,
          units,
          onStep,
        );
        applyRecord(record);
        await refreshFromApi();
        const created = recordsToListings([record]).find(
          (l) => Number(l.amount) === units,
        );
        if (!created) throw new Error("Listing não encontrado após sync.");
        return created;
      }
      await mockTxFlow(onStep);
      const target = properties.find((p) => p.id === localId);
      if (!target) throw new Error("Imóvel não encontrado.");
      const priceEth =
        Number(target.marketValueEth) * (units / target.totalValueUnits);
      const listing: Listing = {
        listingId: String(Math.floor(Math.random() * 9999)),
        propertyId: target.propertyId,
        amount: units,
        priceWei: priceEth.toFixed(6),
        seller: user.wallet,
        status: "Active",
        listedAt: new Date().toISOString(),
        txHash: shortHash(),
      };
      setListings((prev) => [listing, ...prev]);
      setProperties((prev) =>
        prev.map((p) =>
          p.id === localId
            ? {
                ...p,
                status: "ActiveSale",
                activeListings: (p.activeListings || 0) + 1,
                valueTokenAddress: p.valueTokenAddress ?? shortHash(),
              }
            : p,
        ),
      );
      setTransactions((prev) => [
        {
          id: "tx-" + Date.now(),
          type: "Oferta publicada",
          propertyTitle: target.title,
          valueEth: priceEth.toFixed(6),
          status: "Confirmado",
          date: new Date().toISOString(),
          txHash: listing.txHash,
        },
        ...prev,
      ]);
      return listing;
    },
    [actions, applyRecord, properties, refreshFromApi, user.wallet],
  );

  const buyListing = useCallback<AppActions["buyListing"]>(
    async (localId, listingId, units, totalPriceEth, onStep) => {
      const listing = listings.find((l) => l.listingId === listingId);
      if (!listing) throw new Error("Oferta não encontrada.");

      if (actions.ready && localId !== listing.propertyId) {
        const priceWei = ethToWei(totalPriceEth);
        const record = await actions.buyListing(
          localId,
          listingId,
          priceWei,
          onStep,
        );
        applyRecord(record);
        await refreshFromApi();
        return;
      }

      await mockTxFlow(onStep);
      const newAmount = listing.amount - units;
      setListings((prev) =>
        prev.map((l) =>
          l.listingId === listingId
            ? {
                ...l,
                amount: newAmount,
                status: newAmount === 0 ? "Filled" : "Active",
              }
            : l,
        ),
      );
      const prop = properties.find(
        (p) => p.propertyId === listing.propertyId,
      );
      if (prop) {
        setProperties((prev) =>
          prev.map((p) =>
            p.id === prop.id
              ? {
                  ...p,
                  soldFreeValueUnits: p.soldFreeValueUnits + units,
                }
              : p,
          ),
        );
      }
      setTransactions((prev) => [
        {
          id: "tx-" + Date.now(),
          type: "Investimento",
          propertyTitle: prop?.title ?? "—",
          valueEth: totalPriceEth,
          status: "Confirmado",
          date: new Date().toISOString(),
          txHash: shortHash(),
        },
        ...prev,
      ]);
    },
    [actions, applyRecord, listings, properties, refreshFromApi],
  );

  const cancelListing = useCallback<AppActions["cancelListing"]>(
    async (localId, listingId, onStep) => {
      if (actions.ready) {
        const record = await actions.cancelListing(
          localId,
          listingId,
          onStep,
        );
        applyRecord(record);
        await refreshFromApi();
        return;
      }
      await mockTxFlow(onStep);
      setListings((prev) =>
        prev.map((l) =>
          l.listingId === listingId ? { ...l, status: "Cancelled" } : l,
        ),
      );
    },
    [actions, applyRecord, refreshFromApi],
  );

  const appActions: AppActions = useMemo(
    () => ({
      ready: actions.ready,
      submitProperty,
      verifyProperty,
      tokenizeProperty,
      publishListing,
      buyListing,
      cancelListing,
    }),
    [
      actions.ready,
      submitProperty,
      verifyProperty,
      tokenizeProperty,
      publishListing,
      buyListing,
      cancelListing,
    ],
  );

  // Avoid unused warning while still allowing callers to surface fiat helpers
  void formatBrl;
  void formatUsd;

  const findProp = () => properties.find((p) => p.id === route.params.id);
  const findListing = () =>
    listings.find((l) => l.listingId === route.params.id);

  if (route.name === "landing") {
    return <LandingPage navigate={navigate} setRole={setRole} />;
  }

  const renderPage = () => {
    switch (route.name) {
      case "dashboard":
        return (
          <DashboardPage
            properties={properties}
            listings={listings}
            transactions={transactions}
            navigate={navigate}
            role={role}
          />
        );
      case "properties":
        return (
          <PropertiesPage properties={properties} navigate={navigate} />
        );
      case "property-new":
        return (
          <PropertyNewPage navigate={navigate} actions={appActions} />
        );
      case "property":
        return (
          <PropertyDetailPage
            property={findProp()}
            navigate={navigate}
            listings={listings}
            actions={appActions}
            wallet={wallet}
            chainMode={chainMode}
          />
        );
      case "property-publish":
        return (
          <PropertyPublishPage
            property={findProp()}
            navigate={navigate}
            actions={appActions}
          />
        );
      case "marketplace":
        return (
          <MarketplacePage
            properties={properties}
            listings={listings}
            navigate={navigate}
          />
        );
      case "listing": {
        const l = findListing();
        const p = l
          ? properties.find((pp) => pp.propertyId === l.propertyId)
          : undefined;
        return (
          <ListingDetailPage
            listing={l}
            property={p}
            navigate={navigate}
            actions={appActions}
          />
        );
      }
      case "portfolio":
        return (
          <PortfolioPage
            properties={properties}
            listings={listings}
            transactions={transactions}
            user={user}
            navigate={navigate}
            role={role}
          />
        );
      case "transactions":
        return <TransactionsPage transactions={transactions} />;
      case "learn":
        return <LearnPage role={role} navigate={navigate} />;
      case "settings":
        return <SettingsPage user={user} setUser={setUser} />;
      default:
        return (
          <div className="page">
            <h2>Página não encontrada</h2>
          </div>
        );
    }
  };

  return (
    <div className="app-shell">
      <Sidebar route={route} navigate={navigate} role={role} />
      <div className="main">
        <Topbar
          user={user}
          role={role}
          setRole={setRole}
          navigate={navigate}
          route={route}
          wallet={wallet}
        />
        {renderPage()}
      </div>
    </div>
  );
}
