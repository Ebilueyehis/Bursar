/** Small date helpers. Bursar shows dates the way a Nigerian bursar reads them. */

/** "30 Jul 2026" from an ISO date string. */
export function formatDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "Wednesday, 30 July 2026" — used as a ledger day heading. */
export function formatDayLong(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Today as an ISO date (YYYY-MM-DD), local time. */
export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Current month as 'YYYY-MM'. */
export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

/** "July 2026" from a 'YYYY-MM' period. */
export function formatPeriod(period: string): string {
  const d = new Date(period + "-01T00:00:00");
  if (isNaN(d.getTime())) return period;
  return d.toLocaleDateString("en-NG", { month: "long", year: "numeric" });
}
