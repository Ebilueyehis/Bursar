"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useViewer } from "@/lib/viewer";
import { can } from "@/lib/domain/constants";
import { EmptyState, cn } from "@/components/ui";
import { LedgerView } from "@/components/payments/LedgerView";
import { IncomeView } from "@/components/payments/IncomeView";
import { ExpenseView } from "@/components/payments/ExpenseView";
import { AuditView } from "@/components/payments/AuditView";
import {
  PAYMENTS_SECTIONS,
  paymentsHref,
  paymentsTabFrom,
} from "@/components/payments/sections";

export default function PaymentsPage() {
  const { role } = useViewer();
  const params = useSearchParams();
  // The section lives in the URL, so the sidebar dropdown, the mobile sheet, and
  // this strip all drive the same state and a section stays linkable.
  const tab = paymentsTabFrom(params.get("tab"));
  const label = PAYMENTS_SECTIONS.find((s) => s.id === tab)?.label ?? "Ledger";

  if (!can(role, "view_ledger")) {
    return (
      <EmptyState
        title="Payments are for the Proprietor and Bursar"
        description="Ask an administrator if you need to see the school's money."
      />
    );
  }

  return (
    <div className="grid gap-4">
      {/* Mobile keeps a strip; on desktop the sidebar carries these sections. */}
      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1.5 md:hidden">
        {PAYMENTS_SECTIONS.map((s) => (
          <Link
            key={s.id}
            href={paymentsHref(s.id)}
            scroll={false}
            className={cn(
              "shrink-0 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition",
              tab === s.id
                ? "bg-primary-tint text-primary"
                : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
            )}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      <h2 className="hidden font-display text-lg font-bold text-ink md:block">
        {label}
      </h2>

      <div className="min-w-0">
        {tab === "ledger" && <LedgerView />}
        {tab === "income" && <IncomeView />}
        {tab === "expense" && <ExpenseView />}
        {tab === "audit" && <AuditView />}
      </div>
    </div>
  );
}
