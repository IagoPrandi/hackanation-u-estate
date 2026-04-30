const decimalPattern = /^\d+(\.\d+)?$/;
const BIGINT_ZERO = BigInt(0);
const BIGINT_TEN = BigInt(10);

export function parseDecimalToUnits(value: string, decimals: number) {
  const normalizedValue = value.trim();

  if (!decimalPattern.test(normalizedValue)) {
    throw new Error("Invalid decimal string.");
  }

  const [wholePart, fractionPart = ""] = normalizedValue.split(".");

  if (fractionPart.length > decimals) {
    throw new Error("Decimal precision exceeds supported scale.");
  }

  const paddedFraction = fractionPart.padEnd(decimals, "0");
  const base = BIGINT_TEN ** BigInt(decimals);

  return BigInt(wholePart) * base + BigInt(paddedFraction || "0");
}

export function formatUnitsSafe(
  value: bigint | number,
  decimals: number,
  precision = decimals,
) {
  const bigintValue = typeof value === "bigint" ? value : BigInt(value);
  const isNegative = bigintValue < BIGINT_ZERO;
  const absoluteValue = isNegative ? -bigintValue : bigintValue;
  const base = BIGINT_TEN ** BigInt(decimals);
  const wholePart = absoluteValue / base;
  const fractionPart = absoluteValue % base;

  if (decimals === 0 || precision === 0) {
    return `${isNegative ? "-" : ""}${wholePart.toString()}`;
  }

  const trimmedPrecision = Math.min(decimals, precision);
  const rawFraction = fractionPart.toString().padStart(decimals, "0");
  const visibleFraction = rawFraction.slice(0, trimmedPrecision).replace(/0+$/, "");

  if (!visibleFraction) {
    return `${isNegative ? "-" : ""}${wholePart.toString()}`;
  }

  return `${isNegative ? "-" : ""}${wholePart.toString()}.${visibleFraction}`;
}

export function scaleBpsToPercent(bps: number) {
  return `${formatUnitsSafe(BigInt(bps), 2, 2)}%`;
}
