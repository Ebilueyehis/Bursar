"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { can } from "@/lib/domain/constants";
import { formatDay } from "@/lib/dates";
import { formatNaira } from "@/lib/money";
import { exportToXlsx } from "@/lib/export";
import type { LedgerEntry } from "@/lib/domain/types";
import {
  Card,
  EmptyState,
  LoadingBlock,
  Money,
  Select,
  cn,
} from "@/components/ui";
import { ArrowDownIcon, ArrowUpIcon, LedgerIcon } from "@/components/icons";

type RangeKey = "30d" | "term" | "all";
type TypeFilter = "all" | "credit" | "debit";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "30d", label: "Last 30 days" },
  { key: "term", label: "This term" },
  { key: "all", label: "Everything" },
];

const PAGE_SIZES = [10, 20, 50, 100];

/** A ledger entry with its running balance resolved (opening 0 for the period). */
interface Row {
  entry: LedgerEntry;
  balance: number;
  no: number;
}

export default function LedgerPage() {
  const { role, session } = useViewer();
  const [range, setRange] = useState<RangeKey>("30d");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);

  const filter = (() => {
    if (range === "all") return undefined;
    if (range === "term") return session?.startDate ? { from: session.startDate } : undefined;
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from: from.toISOString().slice(0, 10) };
  })();

  const { data, loading } = useAsync(
    () => repository.getLedger(filter),
    [range, session?.startDate],
  );

  // Flatten to entries, oldest first, and resolve a running balance from 0.
  const allRows = useMemo<Row[]>(() => {
    const days = data ?? [];
    const entries = days
      .flatMap((d) => d.entries)
      .sort((a, b) => a.date.localeCompare(b.date));
    let balance = 0;
    const withBalance = entries.map((entry) => {
      balance += entry.direction === "in" ? entry.amount : -entry.amount;
      return { entry, balance };
    });
    // Newest first for display; number 1 = most recent.
    return withBalance
      .reverse()
      .map((r, i) => ({ ...r, no: withBalance.length - i }));
  }, [data]);

  const totalIn = (data ?? []).reduce((s, d) => s + d.totalIn, 0);
  const totalOut = (data ?? []).reduce((s, d) => s + d.totalOut, 0);
  const opening = 0;
  const closing = opening + totalIn - totalOut;

  const rows = useMemo(
    () =>
      typeFilter === "all"
        ? allRows
        : allRows.filter((r) =>
            typeFilter === "credit"
              ? r.entry.direction === "in"
              : r.entry.direction === "out",
          ),
    [allRows, typeFilter],
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  if (!can(role, "view_ledger")) {
    return (
      <EmptyState
        title="The ledger is for the Proprietor and Bursar"
        description="Ask an administrator if you need to see the school's cashbook."
      />
    );
  }

  function onExport() {
    exportToXlsx(
      "Ledger",
      ["No", "Type", "Amount", "Balance", "Date", "Statement"],
      rows.map((r) => [
        r.no,
        r.entry.direction === "in" ? "Credit" : "Debit",
        (r.entry.direction === "in" ? 1 : -1) * (r.entry.amount / 100),
        r.balance / 100,
        formatDay(r.entry.date),
        `${r.entry.title}: ${r.entry.subtitle}`,
      ]),
    );
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-surface-sunken p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => {
                setRange(r.key);
                setPage(1);
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-semibold transition",
                range === r.key
                  ? "bg-surface-raised text-ink shadow-sm"
                  : "text-ink-muted",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <Select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value as TypeFilter);
            setPage(1);
          }}
          className="w-auto"
        >
          <option value="all">All types</option>
          <option value="credit">Credit (money in)</option>
          <option value="debit">Debit (money out)</option>
        </Select>
        <button
          onClick={onExport}
          disabled={rows.length === 0}
          className="ml-auto flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3.5 py-2 text-sm font-semibold text-ink-muted transition enabled:hover:border-primary enabled:hover:text-primary disabled:opacity-40"
        >
          <ExportIcon />
          Export
        </button>
      </div>

      {/* Twin balance cards */}
      <div className="grid grid-cols-2 gap-4">
        <BalanceCard label="Opening balance" kobo={opening} />
        <BalanceCard label="Closing balance" kobo={closing} accent />
      </div>

      {loading && !data ? (
        <LoadingBlock label="Loading the ledger…" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<LedgerIcon width={28} height={28} />}
          title="Nothing recorded in this period"
          description="Payments you record and expenses you add appear here as credits and debits."
        />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-border-strong">
                  <Th>No</Th>
                  <Th>Type</Th>
                  <Th>Amount</Th>
                  <Th>Balance</Th>
                  <Th>Date</Th>
                  <Th>Statement</Th>
                  <Th>Attachment</Th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <LedgerRow key={`${r.entry.kind}-${r.entry.id}`} row={r} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-ink-muted">
            <div className="flex items-center gap-4">
              <span>
                Showing{" "}
                <b className="tabular text-ink">
                  {start + 1}
                  {"–"}
                  {Math.min(start + pageSize, rows.length)}
                </b>{" "}
                of <b className="tabular text-ink">{rows.length}</b>
              </span>
              <label className="flex items-center gap-2 text-xs">
                Rows per page
                <Select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="w-auto py-1.5"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            <div className="flex items-center gap-1">
              <PagerButton disabled={current <= 1} onClick={() => setPage(current - 1)}>
                Prev
              </PagerButton>
              <span className="px-2 text-xs">
                Page <b className="tabular text-ink">{current}</b> of{" "}
                <b className="tabular text-ink">{totalPages}</b>
              </span>
              <PagerButton
                disabled={current >= totalPages}
                onClick={() => setPage(current + 1)}
              >
                Next
              </PagerButton>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function LedgerRow({ row }: { row: Row }) {
  const { entry, balance, no } = row;
  const isIn = entry.direction === "in";
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-2.5 text-sm tabular text-ink-faint">{no}</td>
      <td className="px-4 py-2.5">
        <span
          className={cn(
            "text-sm font-semibold",
            isIn ? "text-success" : "text-danger",
          )}
        >
          {isIn ? "Credit" : "Debit"}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-bold tabular",
            isIn ? "bg-success-tint text-success" : "bg-danger-tint text-danger",
          )}
        >
          {isIn ? (
            <ArrowDownIcon width={13} height={13} />
          ) : (
            <ArrowUpIcon width={13} height={13} />
          )}
          {formatNaira(entry.amount)}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <Money kobo={balance} tone="ink" className="text-sm" />
      </td>
      <td className="px-4 py-2.5 text-sm tabular text-ink-muted">
        {formatDay(entry.date)}
      </td>
      <td className="px-4 py-2.5 text-sm text-ink">
        {entry.kind === "payment" ? (
          <Link
            href={`/students/${entry.reference}`}
            className="font-medium hover:text-primary"
          >
            {entry.title}
          </Link>
        ) : (
          <span className="font-medium">{entry.title}</span>
        )}
        <span className="text-ink-faint">: {entry.subtitle}</span>
      </td>
      <td className="px-4 py-2.5 text-sm text-ink-faint">-</td>
    </tr>
  );
}

function BalanceCard({
  label,
  kobo,
  accent,
}: {
  label: string;
  kobo: number;
  accent?: boolean;
}) {
  return (
    <Card
      className={cn(
        "flex flex-col items-center py-6 text-center",
        accent && "bg-surface-sunken",
      )}
    >
      <p className="text-sm text-ink-faint">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-bold tabular text-ink md:text-3xl">
        {formatNaira(kobo)}
      </p>
      <p className="mt-1 text-xs uppercase tracking-wide text-ink-faint">NGN</p>
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-xs font-bold text-ink-faint">{children}</th>;
}

function PagerButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-xs font-semibold text-ink-muted transition enabled:hover:border-primary enabled:hover:text-primary disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ExportIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" />
    </svg>
  );
}
