"use client";

import { useMemo, useState } from "react";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { formatNaira } from "@/lib/money";
import { formatDay } from "@/lib/dates";
import { exportToXlsx } from "@/lib/export";
import type { AuditEntry } from "@/lib/domain/types";
import { Card, EmptyState, LoadingBlock, Select, cn } from "@/components/ui";

type EntityFilter = "all" | "payment" | "expense" | "income";

const ACTION_TONE: Record<AuditEntry["action"], string> = {
  created: "text-success",
  edited: "text-warning",
  deleted: "text-danger",
};

export function AuditView() {
  const { data, loading } = useAsync(() => repository.listAuditLog(), []);
  const [entity, setEntity] = useState<EntityFilter>("all");

  const rows = useMemo(
    () => (data ?? []).filter((a) => entity === "all" || a.entity === entity),
    [data, entity],
  );

  function onExport() {
    exportToXlsx(
      "Audit trail",
      ["When", "Who", "Action", "Entity", "Summary", "Amount"],
      rows.map((a) => [
        a.createdAt.slice(0, 16).replace("T", " "),
        a.actorName,
        a.action,
        a.entity,
        a.summary,
        a.amount == null ? "" : a.amount / 100,
      ]),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-ink-muted">
          Every money entry recorded, edited, or removed, and who did it.
        </p>
        <Select
          value={entity}
          onChange={(e) => setEntity(e.target.value as EntityFilter)}
          className="ml-auto w-auto"
        >
          <option value="all">All types</option>
          <option value="payment">Fee payments</option>
          <option value="income">Other income</option>
          <option value="expense">Expenses</option>
        </Select>
        <button
          onClick={onExport}
          disabled={rows.length === 0}
          className="rounded-lg border border-border bg-surface-raised px-3.5 py-2 text-sm font-semibold text-ink-muted transition enabled:hover:border-primary enabled:hover:text-primary disabled:opacity-40"
        >
          Export
        </button>
      </div>

      {loading && !data ? (
        <LoadingBlock label="Loading the audit trail…" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          description="As payments, income, and expenses are recorded or changed, they appear here."
        />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-border-strong">
                  <Th>When</Th><Th>Who</Th><Th>Action</Th><Th>Entity</Th><Th>Summary</Th><Th>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-sm tabular text-ink-muted">
                      {formatDay(a.createdAt.slice(0, 10))}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-ink">{a.actorName}</td>
                    <td className={cn("px-4 py-2.5 text-sm font-semibold capitalize", ACTION_TONE[a.action])}>
                      {a.action}
                    </td>
                    <td className="px-4 py-2.5 text-sm capitalize text-ink-muted">{a.entity}</td>
                    <td className="px-4 py-2.5 text-sm text-ink">{a.summary}</td>
                    <td className="px-4 py-2.5 text-sm tabular text-ink">
                      {a.amount == null ? "-" : formatNaira(a.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-xs font-bold text-ink-faint">{children}</th>;
}
