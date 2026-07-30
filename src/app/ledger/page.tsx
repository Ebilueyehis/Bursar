"use client";

import { useState } from "react";
import Link from "next/link";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { can } from "@/lib/domain/constants";
import { formatDayLong } from "@/lib/dates";
import type { LedgerDay } from "@/lib/domain/types";
import {
  Card,
  EmptyState,
  LoadingBlock,
  Money,
  PageHeader,
} from "@/components/ui";
import { ExpenseIcon, LedgerIcon, StaffIcon } from "@/components/icons";

type RangeKey = "30d" | "term" | "all";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "30d", label: "Last 30 days" },
  { key: "term", label: "This term" },
  { key: "all", label: "Everything" },
];

export default function LedgerPage() {
  const { role, session } = useViewer();
  const [range, setRange] = useState<RangeKey>("30d");

  const filter = (() => {
    if (range === "all") return undefined;
    if (range === "term") return session?.startDate ? { from: session.startDate } : undefined;
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from: from.toISOString().slice(0, 10) };
  })();

  const { data, loading } = useAsync(() => repository.getLedger(filter), [range, session?.startDate]);

  if (!can(role, "view_ledger")) {
    return (
      <EmptyState
        title="The ledger is for the Proprietor and Bursar"
        description="Ask an administrator if you need to see the school's cashbook."
      />
    );
  }

  const days = data ?? [];
  const totalIn = days.reduce((s, d) => s + d.totalIn, 0);
  const totalOut = days.reduce((s, d) => s + d.totalOut, 0);
  const net = totalIn - totalOut;

  return (
    <div>
      <PageHeader
        title="Daily ledger"
        subtitle="Every payment in and every expense out, day by day."
      />

      {/* Money-out shortcuts (these aren't on the mobile bottom bar). */}
      <div className="mb-4 flex flex-wrap gap-2 md:hidden">
        <Link href="/expenses" className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-ink">
          <ExpenseIcon width={16} height={16} /> Expenses
        </Link>
        <Link href="/staff" className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-ink">
          <StaffIcon width={16} height={16} /> Staff & payroll
        </Link>
      </div>

      {/* Range selector */}
      <div className="mb-4 flex rounded-lg bg-surface-sunken p-0.5">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={
              "flex-1 rounded-md px-2 py-1.5 text-sm font-semibold transition " +
              (range === r.key ? "bg-surface-raised text-ink shadow-sm" : "text-ink-muted")
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Period summary */}
      <div className="mb-5 grid grid-cols-3 gap-2.5">
        <SummaryTile label="Money in" kobo={totalIn} tone="success" />
        <SummaryTile label="Money out" kobo={totalOut} tone="danger" />
        <SummaryTile label="Net" kobo={net} tone={net >= 0 ? "success" : "danger"} signed />
      </div>

      {loading && !data ? (
        <LoadingBlock label="Loading the ledger…" />
      ) : days.length === 0 ? (
        <EmptyState
          icon={<LedgerIcon width={28} height={28} />}
          title="Nothing recorded in this period"
          description="Payments you record and expenses you add will appear here, grouped by day."
        />
      ) : (
        <div className="space-y-5">
          {days.map((day) => <DayBlock key={day.date} day={day} />)}
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  kobo,
  tone,
  signed,
}: {
  label: string;
  kobo: number;
  tone: "success" | "danger";
  signed?: boolean;
}) {
  return (
    <Card className="px-3 py-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1">
        {signed && kobo < 0 && <span className="money font-semibold text-danger">−</span>}
        <Money kobo={Math.abs(kobo)} tone={tone} className="text-base" />
      </p>
    </Card>
  );
}

function DayBlock({ day }: { day: LedgerDay }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-ink">{formatDayLong(day.date)}</h2>
        <span className="font-mono text-xs text-ink-faint">
          Net {day.net < 0 ? "−" : ""}
          {formatShort(Math.abs(day.net))}
        </span>
      </div>

      <Card className="divide-y divide-border p-0">
        {day.entries.map((e) => (
          <div key={`${e.kind}-${e.id}`} className="flex items-center gap-3 px-4 py-3">
            <span
              className={
                "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold " +
                (e.direction === "in" ? "bg-success-tint text-success" : "bg-danger-tint text-danger")
              }
              aria-hidden
            >
              {e.direction === "in" ? "+" : "−"}
            </span>
            <div className="min-w-0 flex-1">
              {e.kind === "payment" ? (
                <Link href={`/students/${e.reference}`} className="truncate font-semibold text-ink hover:text-primary">
                  {e.title}
                </Link>
              ) : (
                <p className="truncate font-semibold text-ink">{e.title}</p>
              )}
              <p className="truncate text-xs text-ink-muted">{e.subtitle}</p>
            </div>
            <Money
              kobo={e.amount}
              tone={e.direction === "in" ? "success" : "danger"}
              className="shrink-0 text-sm"
            />
          </div>
        ))}
      </Card>

      <div className="mt-1.5 flex justify-end gap-4 px-1 text-xs text-ink-faint">
        <span>In <span className="money text-success">{formatShort(day.totalIn)}</span></span>
        <span>Out <span className="money text-danger">{formatShort(day.totalOut)}</span></span>
      </div>
    </div>
  );
}

function formatShort(kobo: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(kobo / 100);
}
