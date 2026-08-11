/**
 * The four sections of the Payments group. Shared so the sidebar dropdown, the
 * mobile sheet, and the Payments screen itself can never drift apart. Navigation
 * is by query string (`/payments?tab=income`) so a section is linkable and the
 * back button behaves.
 */
export type PaymentsTabId = "ledger" | "income" | "expense" | "audit";

export interface PaymentsSection {
  id: PaymentsTabId;
  label: string;
}

export const PAYMENTS_SECTIONS: PaymentsSection[] = [
  { id: "ledger", label: "Ledger" },
  { id: "income", label: "Income" },
  { id: "expense", label: "Expense" },
  { id: "audit", label: "Audit trail" },
];

const IDS: readonly string[] = PAYMENTS_SECTIONS.map((s) => s.id);

export function isPaymentsTab(value: string | null): value is PaymentsTabId {
  return !!value && IDS.includes(value);
}

/** Falls back to the ledger, which is the whole picture, when nothing is asked for. */
export function paymentsTabFrom(value: string | null): PaymentsTabId {
  return isPaymentsTab(value) ? value : "ledger";
}

export function paymentsHref(id: PaymentsTabId): string {
  return `/payments?tab=${id}`;
}
