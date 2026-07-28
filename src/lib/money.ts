/**
 * Money in Bursar is always stored and passed around as an integer number of
 * kobo (1 naira = 100 kobo). We never use floating-point naira for storage or
 * arithmetic — that is how rounding errors slip into a ledger, and "no ambiguity
 * around money, ever" is a rule, not a preference.
 */

export type Kobo = number;

/** Format kobo as a Naira string, e.g. 4500000 -> "₦45,000.00". */
export function formatNaira(
  kobo: Kobo,
  opts: { kobo_decimals?: boolean } = {},
): string {
  const showDecimals = opts.kobo_decimals ?? true;
  const naira = kobo / 100;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(naira);
}

/** Format kobo without decimals when it lands on a whole naira, else with. */
export function formatNairaSmart(kobo: Kobo): string {
  return formatNaira(kobo, { kobo_decimals: kobo % 100 !== 0 });
}

/** Convert a naira amount typed by a user into kobo, rounded to the nearest kobo. */
export function nairaToKobo(naira: number): Kobo {
  return Math.round(naira * 100);
}

/**
 * Parse a free-text naira amount ("45,000", "₦45000.50", "45k") into kobo.
 * Returns null when the text can't be read as a positive amount.
 */
export function parseNairaToKobo(text: string): Kobo | null {
  if (!text) return null;
  let cleaned = text.trim().toLowerCase().replace(/[₦,\s]/g, "");
  let multiplier = 1;
  if (cleaned.endsWith("k")) {
    multiplier = 1000;
    cleaned = cleaned.slice(0, -1);
  } else if (cleaned.endsWith("m")) {
    multiplier = 1_000_000;
    cleaned = cleaned.slice(0, -1);
  }
  if (cleaned === "" || !/^\d*\.?\d*$/.test(cleaned)) return null;
  const naira = parseFloat(cleaned) * multiplier;
  if (!isFinite(naira) || naira < 0) return null;
  return nairaToKobo(naira);
}
