import "server-only";

import Decimal from "decimal.js";
import {
  multiplyDecimalStrings,
  normalizeDecimalString,
} from "@/lib/safe-decimal";
import {
  readFiatRatesCache,
  writeFiatRatesCache,
} from "@/offchain/repository";
import type {
  FiatCurrency,
  FiatRatesErrorResponse,
  FiatRatesSnapshot,
  FiatRatesSuccessResponse,
} from "@/offchain/schemas";

type FetchLike = typeof fetch;

type GetFiatRatesOptions = {
  fetchImpl?: FetchLike;
  now?: Date;
};

type FiatConfig = {
  provider: "okx";
  apiBaseUrl: string;
  ethUsdcInstId: string;
  usdcBrlInstId: string;
  optionalCurrencies: Array<"eur" | "jpy">;
  optionalInstIds: Partial<Record<"eur" | "jpy", string>>;
  requestTimeoutMs: number;
  cacheTtlSeconds: number;
  maxStalenessSeconds: number;
};

const RATE_SCALE = 8;
const SUCCESS_STATUS = 200;
const ERROR_STATUS = 503;
const FIAT_RATES_ERROR_MESSAGE =
  "Could not fetch ETH fiat rates from OKX and no cached rates are available within max staleness.";

export async function getFiatRates(
  options: GetFiatRatesOptions = {},
): Promise<{
  body: FiatRatesSuccessResponse | FiatRatesErrorResponse;
  status: number;
}> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const config = loadFiatConfig();
  const cache = await readFiatRatesCache();
  const cacheAgeSeconds = getCacheAgeSeconds(cache.updatedAt, now);

  if (cache.updatedAt && cacheAgeSeconds !== null && cacheAgeSeconds <= config.cacheTtlSeconds) {
    return {
      body: {
        ok: true,
        cached: true,
        ...cache,
      },
      status: SUCCESS_STATUS,
    };
  }

  try {
    const snapshot = await buildLiveSnapshot(config, fetchImpl, now);
    await writeFiatRatesCache(snapshot);

    return {
      body: {
        ok: true,
        cached: false,
        warning:
          snapshot.unavailable.includes("brl") ? "BRL_ROUTE_UNAVAILABLE" : undefined,
        ...snapshot,
      },
      status: SUCCESS_STATUS,
    };
  } catch {
    if (
      cache.updatedAt &&
      cacheAgeSeconds !== null &&
      cacheAgeSeconds <= config.maxStalenessSeconds
    ) {
      return {
        body: {
          ok: true,
          cached: true,
          warning: "USING_LAST_KNOWN_RATES",
          ...cache,
        },
        status: SUCCESS_STATUS,
      };
    }

    return {
      body: {
        ok: false,
        code: "FIAT_RATES_UNAVAILABLE",
        message: FIAT_RATES_ERROR_MESSAGE,
        provider: config.provider,
      },
      status: ERROR_STATUS,
    };
  }
}

async function buildLiveSnapshot(
  config: FiatConfig,
  fetchImpl: FetchLike,
  now: Date,
): Promise<FiatRatesSnapshot> {
  const ethUsdRate = await fetchOkxTickerLast(
    config.ethUsdcInstId,
    config,
    fetchImpl,
  );
  const routes: Partial<Record<FiatCurrency, string>> = {
    usd: config.ethUsdcInstId,
  };
  const rates: Partial<Record<FiatCurrency, string>> = {
    usd: ethUsdRate,
  };
  const unavailable: FiatCurrency[] = [];
  const optionalRates: FiatRatesSnapshot["optionalRates"] = {
    eur: null,
    jpy: null,
  };

  try {
    const usdcBrlRate = await fetchOkxTickerLast(
      config.usdcBrlInstId,
      config,
      fetchImpl,
    );

    routes.brl = `${config.ethUsdcInstId} * ${config.usdcBrlInstId}`;
    rates.brl = multiplyDecimalStrings(ethUsdRate, usdcBrlRate, RATE_SCALE);
  } catch {
    unavailable.push("brl");
  }

  for (const currency of config.optionalCurrencies) {
    const instId = config.optionalInstIds[currency];

    if (!instId) {
      continue;
    }

    try {
      const crossRate = await fetchOkxTickerLast(instId, config, fetchImpl);

      routes[currency] = `${config.ethUsdcInstId} * ${instId}`;
      optionalRates[currency] = multiplyDecimalStrings(
        ethUsdRate,
        crossRate,
        RATE_SCALE,
      );
      rates[currency] = optionalRates[currency] ?? undefined;
    } catch {
      optionalRates[currency] = null;
    }
  }

  return {
    provider: config.provider,
    base: "ETH",
    routes,
    rates,
    unavailable,
    optionalRates,
    updatedAt: now.toISOString(),
  };
}

async function fetchOkxTickerLast(
  instId: string,
  config: FiatConfig,
  fetchImpl: FetchLike,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    const response = await fetchImpl(
      `${config.apiBaseUrl}/api/v5/market/ticker?instId=${encodeURIComponent(instId)}`,
      {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error("OKX ticker request failed.");
    }

    const payload = (await response.json()) as {
      code?: string;
      data?: Array<{ last?: string }>;
    };
    const last = payload.data?.[0]?.last;

    if (payload.code !== "0" || !last) {
      throw new Error("OKX ticker payload is invalid.");
    }

    const decimalValue = new Decimal(last);

    if (!decimalValue.isFinite() || decimalValue.lte(0)) {
      throw new Error("OKX ticker last price must be greater than zero.");
    }

    return normalizeDecimalString(decimalValue, RATE_SCALE);
  } finally {
    clearTimeout(timeout);
  }
}

function loadFiatConfig(): FiatConfig {
  return {
    provider: "okx",
    apiBaseUrl: process.env.OKX_API_BASE_URL ?? "https://www.okx.com",
    ethUsdcInstId: process.env.OKX_ETH_USDC_INST_ID ?? "ETH-USDC",
    usdcBrlInstId: process.env.OKX_USDC_BRL_INST_ID ?? "USDC-BRL",
    optionalCurrencies: parseOptionalCurrencies(
      process.env.FIAT_OPTIONAL_CURRENCIES,
    ),
    optionalInstIds: {
      eur: process.env.OKX_USDC_EUR_INST_ID || undefined,
      jpy: process.env.OKX_USDC_JPY_INST_ID || undefined,
    },
    requestTimeoutMs: parsePositiveInteger(process.env.FIAT_REQUEST_TIMEOUT_MS, 3000),
    cacheTtlSeconds: parsePositiveInteger(process.env.FIAT_CACHE_TTL_SECONDS, 60),
    maxStalenessSeconds: parsePositiveInteger(
      process.env.FIAT_MAX_STALENESS_SECONDS,
      3600,
    ),
  };
}

function getCacheAgeSeconds(updatedAt: string | null, now: Date) {
  if (!updatedAt) {
    return null;
  }

  const updatedAtMs = Date.parse(updatedAt);

  if (Number.isNaN(updatedAtMs)) {
    return null;
  }

  return Math.max(0, Math.floor((now.getTime() - updatedAtMs) / 1000));
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsedValue = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
}

function parseOptionalCurrencies(value: string | undefined) {
  const currencies = (value ?? "eur,jpy")
    .split(",")
    .map((currency) => currency.trim().toLowerCase())
    .filter((currency): currency is "eur" | "jpy" =>
      currency === "eur" || currency === "jpy",
    );

  return currencies.length ? currencies : [];
}
