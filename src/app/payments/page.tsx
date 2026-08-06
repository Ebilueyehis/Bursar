"use client";

import { useState } from "react";
import { useViewer } from "@/lib/viewer";
import { can } from "@/lib/domain/constants";
import { EmptyState, cn } from "@/components/ui";
import { ChevronRightIcon } from "@/components/icons";
import { LedgerView } from "@/components/payments/LedgerView";

type TabId = "ledger" | "income" | "expense" | "audit";

const TABS: { id: TabId; label: string }[] = [
  { id: "ledger", label: "Ledger" },
  { id: "income", label: "Income" },
  { id: "expense", label: "Expense" },
  { id: "audit", label: "Audit trail" },
];

export default function PaymentsPage() {
  const { role } = useViewer();
  const [tab, setTab] = useState<TabId>("ledger");

  if (!can(role, "view_ledger")) {
    return (
      <EmptyState
        title="Payments are for the Proprietor and Bursar"
        description="Ask an administrator if you need to see the school's money."
      />
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-[200px_1fr]">
      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1.5 md:flex-col md:gap-0.5 md:self-start">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex shrink-0 items-center justify-between gap-2 rounded-lg px-3.5 py-2.5 text-left text-sm font-semibold transition md:w-full",
              tab === t.id
                ? "bg-primary-tint text-primary"
                : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
            )}
          >
            {t.label}
            <ChevronRightIcon
              width={16}
              height={16}
              className={cn("hidden md:block", tab === t.id ? "opacity-100" : "opacity-30")}
            />
          </button>
        ))}
      </nav>

      <div className="min-w-0">
        {tab === "ledger" && <LedgerView />}
        {tab === "income" && <IncomePlaceholder />}
        {tab === "expense" && <ExpensePlaceholder />}
        {tab === "audit" && <AuditPlaceholder />}
      </div>
    </div>
  );
}

// Replaced in Tasks 5-7.
function IncomePlaceholder() {
  return <p className="text-sm text-ink-muted">Income view arrives in Task 5.</p>;
}
function ExpensePlaceholder() {
  return <p className="text-sm text-ink-muted">Expense view arrives in Task 6.</p>;
}
function AuditPlaceholder() {
  return <p className="text-sm text-ink-muted">Audit trail arrives in Task 7.</p>;
}
