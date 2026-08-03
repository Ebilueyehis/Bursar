import type { LedgerDay, LedgerEntry } from "@/lib/domain/types";

/**
 * Group flat ledger entries into days (newest first) with per-day totals.
 * Shared by every Repository implementation so the daily cashbook math — In,
 * Out, and Net — is defined in exactly one place.
 */
export function groupLedger(entries: LedgerEntry[]): LedgerDay[] {
  const byDay = new Map<string, LedgerEntry[]>();
  for (const e of entries) {
    const list = byDay.get(e.date) ?? [];
    list.push(e);
    byDay.set(e.date, list);
  }
  return [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, dayEntries]) => {
      const totalIn = dayEntries
        .filter((e) => e.direction === "in")
        .reduce((s, e) => s + e.amount, 0);
      const totalOut = dayEntries
        .filter((e) => e.direction === "out")
        .reduce((s, e) => s + e.amount, 0);
      return {
        date,
        entries: dayEntries.sort((a, b) => a.title.localeCompare(b.title)),
        totalIn,
        totalOut,
        net: totalIn - totalOut,
      };
    });
}
