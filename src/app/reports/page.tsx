"use client";

import { useMemo } from "react";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { termLabel } from "@/lib/domain/constants";
import { Card, LoadingBlock, Money, cn } from "@/components/ui";
import type { StudentAccount } from "@/lib/domain/types";

export default function ReportsPage() {
  const { term } = useViewer();
  const { data, loading } = useAsync(
    () => repository.listStudentAccounts(term),
    [term],
  );

  const byClass = useMemo(() => groupByClass(data ?? []), [data]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-ink">Reports</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Fees collection for {termLabel(term)}, by class.
      </p>

      {loading && !data ? (
        <LoadingBlock label="Preparing report…" />
      ) : (
        <div className="space-y-3">
          {byClass.map((group) => {
            const collected = group.accounts.reduce((s, a) => s + a.paid, 0);
            const billed = group.accounts.reduce((s, a) => s + a.billTotal, 0);
            const outstanding = group.accounts.reduce((s, a) => s + a.outstanding, 0);
            const pct = billed > 0 ? Math.round((collected / billed) * 100) : 0;
            return (
              <Card key={group.className}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-ink">{group.className}</p>
                  <span className="tabular text-sm font-semibold text-ink-muted">
                    {pct}% collected
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunken">
                  <div
                    className={cn("h-full", pct >= 100 ? "bg-success" : "bg-primary")}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <Stat label="Collected" node={<Money kobo={collected} tone="success" />} />
                  <Stat label="Outstanding" node={<Money kobo={outstanding} tone={outstanding > 0 ? "danger" : "muted"} />} />
                  <Stat label="Students" node={<span className="tabular font-semibold text-ink">{group.accounts.length}</span>} />
                </div>
              </Card>
            );
          })}

          <p className="pt-2 text-center text-xs text-ink-faint">
            Full export to PDF and Excel will appear here as reporting grows.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, node }: { label: string; node: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-ink-muted">{label}</p>
      <div className="mt-0.5">{node}</div>
    </div>
  );
}

function groupByClass(accounts: StudentAccount[]) {
  const map = new Map<string, StudentAccount[]>();
  for (const a of accounts) {
    const list = map.get(a.className) ?? [];
    list.push(a);
    map.set(a.className, list);
  }
  return [...map.entries()]
    .map(([className, accts]) => ({ className, accounts: accts }))
    .sort((a, b) => a.className.localeCompare(b.className));
}
