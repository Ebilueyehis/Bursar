"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useViewer } from "@/lib/viewer";
import { can } from "@/lib/domain/constants";
import { EmptyState, cn } from "@/components/ui";
import { ChevronRightIcon } from "@/components/icons";
import { LedgerView } from "@/components/payments/LedgerView";
import { IncomeView } from "@/components/payments/IncomeView";
import { ExpenseView } from "@/components/payments/ExpenseView";
import { AuditView } from "@/components/payments/AuditView";

type TabId = "ledger" | "income" | "expense" | "audit";

const TABS: { id: TabId; label: string }[] = [
  { id: "ledger", label: "Ledger" },
  { id: "income", label: "Income" },
  { id: "expense", label: "Expense" },
  { id: "audit", label: "Audit trail" },
];

const TAB_IDS: readonly TabId[] = TABS.map((t) => t.id);

function isTabId(value: string | null): value is TabId {
  return !!value && (TAB_IDS as readonly string[]).includes(value);
}

export default function PaymentsPage() {
  const { role } = useViewer();
  const params = useSearchParams();
  const initialTab = params.get("tab");
  const [tab, setTab] = useState<TabId>(isTabId(initialTab) ? initialTab : "ledger");

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
        {tab === "income" && <IncomeView />}
        {tab === "expense" && <ExpenseView />}
        {tab === "audit" && <AuditView />}
      </div>
    </div>
  );
}
