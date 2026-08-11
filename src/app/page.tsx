"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { can, termLabel } from "@/lib/domain/constants";
import { classLevel } from "@/lib/classes";
import { exportToXlsx } from "@/lib/export";
import { formatNaira } from "@/lib/money";
import type { StudentAccount } from "@/lib/domain/types";
import { Card, LoadingBlock, Select, cn } from "@/components/ui";
import { SetupCard } from "@/components/SetupCard";
import { Avatar } from "@/app/debtors/page";
import {
  ArrowDownIcon,
  ChevronRightIcon,
  FeesIcon,
  MoneyIcon,
  PlusIcon,
  ReportIcon,
  StudentsIcon,
} from "@/components/icons";

type LevelFilter = "all" | "Primary" | "Secondary";
type SortKey = "oldest" | "recent" | "high" | "low";

export default function DashboardPage() {
  const { term, role } = useViewer();
  const { data: stats, loading } = useAsync(
    () => repository.getDashboardStats(term),
    [term],
  );
  const { data: debtors } = useAsync(() => repository.listDebtors(term), [term]);

  if (loading && !stats) {
    return <LoadingBlock label="Loading this term's figures…" />;
  }
  if (!stats) return null;

  const pct =
    stats.totalBilled > 0
      ? Math.min(100, (stats.totalCollected / stats.totalBilled) * 100)
      : 100;

  return (
    <div className="space-y-4">
      <SetupCard />
      {/* Hero + reconciliation */}
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <Link
          href="/debtors"
          className="group relative overflow-hidden rounded-xl border p-6 text-white"
          style={{ background: "var(--hero-grad)", borderColor: "var(--hero-border)" }}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-white/60">
              Outstanding balance · this {termLabel(term).toLowerCase()}
            </p>
            <ChevronRightIcon
              width={20}
              height={20}
              className="opacity-70 transition group-hover:translate-x-0.5"
            />
          </div>
          <p className="money mt-2 text-4xl font-extrabold tracking-tight">
            {formatNaira(stats.totalOutstanding)}
          </p>
          <div className="mt-3 flex items-center gap-2 text-sm text-white/70">
            <span
              className={cn(
                "size-2 rounded-full",
                stats.debtorCount > 0 ? "bg-warning" : "bg-success",
              )}
            />
            {stats.debtorCount === 0
              ? "Every balance is cleared."
              : `${stats.debtorCount} ${stats.debtorCount === 1 ? "student" : "students"} to follow up`}
          </div>
        </Link>

        <Card className="flex flex-col justify-center">
          <div className="flex items-baseline justify-between">
            <span className="money text-2xl font-extrabold text-primary">
              {pct.toFixed(1)}%
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              Accounted for
            </span>
          </div>
          <div className="my-3 h-2.5 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-ink-muted">
            <span>
              Received{" "}
              <b className="money text-ink">{formatNaira(stats.totalCollected)}</b>
            </span>
            <span>
              Expected{" "}
              <b className="money text-ink">{formatNaira(stats.totalBilled)}</b>
            </span>
          </div>
        </Card>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          tone="success"
          icon={<ArrowDownIcon width={15} height={15} />}
          label="Received this term"
          value={formatNaira(stats.totalCollected)}
          sub={`${pct.toFixed(1)}% of expected`}
        />
        <StatCard
          tone="slate"
          icon={<MoneyIcon width={15} height={15} />}
          label="Expected this term"
          value={formatNaira(stats.totalBilled)}
          sub={`${stats.studentCount} ${stats.studentCount === 1 ? "student" : "students"} enrolled`}
        />
        <StatCard
          tone="slate"
          icon={<StudentsIcon width={15} height={15} />}
          label="Student records"
          value={String(stats.studentCount)}
          sub="active this session"
          href="/students"
        />
        <StatCard
          tone="warning"
          icon={<ReportIcon width={15} height={15} />}
          label="Receipts issued"
          value={String(stats.receiptCount)}
          sub="every one accounted for"
          href="/payments?tab=income"
        />
      </div>

      {/* Outstanding payments */}
      <OutstandingPayments debtors={debtors ?? []} />

      {/* Quick actions */}
      <div>
        <p className="mb-2 mt-6 text-sm font-semibold text-ink">Quick actions</p>
        <div className="flex flex-wrap gap-3">
          {can(role, "record_payment") && (
            <QuickAction href="/pay" primary label="Record a payment" icon={<PlusIcon width={18} height={18} />} />
          )}
          {can(role, "manage_students") && (
            <QuickAction href="/students/new" label="Add a student" icon={<StudentsIcon width={18} height={18} />} />
          )}
          {can(role, "edit_fees") && (
            <QuickAction href="/profile" label="Set class fees" icon={<FeesIcon width={18} height={18} />} />
          )}
        </div>
      </div>
    </div>
  );
}

// --- Stat card ---------------------------------------------------------------

const CHIP_TONES = {
  success: "bg-success-tint text-success",
  slate: "bg-slate-tint text-slate",
  warning: "bg-warning-tint text-warning",
} as const;

function StatCard({
  tone,
  icon,
  label,
  value,
  sub,
  href,
}: {
  tone: keyof typeof CHIP_TONES;
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  /** When set, the whole card is a link — the card stays static without it. */
  href?: string;
}) {
  const content = (
    <>
      <p className="flex items-center gap-2 text-xs font-medium text-ink-muted">
        <span className={cn("grid size-6 place-items-center rounded-md", CHIP_TONES[tone])}>
          {icon}
        </span>
        {label}
      </p>
      <p className="money text-xl font-bold text-ink">{value}</p>
      <p className="text-xs text-ink-faint">{sub}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-4 transition hover:border-primary hover:bg-surface-sunken"
      >
        {content}
      </Link>
    );
  }

  return <Card className="flex flex-col gap-1.5">{content}</Card>;
}

// --- Outstanding payments table ---------------------------------------------

function OutstandingPayments({ debtors }: { debtors: StudentAccount[] }) {
  const [level, setLevel] = useState<LevelFilter>("all");
  const [sort, setSort] = useState<SortKey>("oldest");

  const rows = useMemo(() => {
    const filtered = debtors.filter(
      (a) => level === "all" || classLevel(a.className) === level,
    );
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sort) {
        case "recent":
          return b.bill.createdOn.localeCompare(a.bill.createdOn);
        case "high":
          return b.outstanding - a.outstanding;
        case "low":
          return a.outstanding - b.outstanding;
        default:
          return a.bill.createdOn.localeCompare(b.bill.createdOn);
      }
    });
    return sorted;
  }, [debtors, level, sort]);

  function onExport() {
    exportToXlsx(
      "Outstanding payments",
      ["Class", "Student", "Guardian", "Weeks owed", "Balance"],
      rows.map((a) => [
        a.className,
        `${a.student.firstName} ${a.student.lastName}`,
        a.guardian.fullName,
        weeksOwed(a.bill.createdOn),
        a.outstanding / 100,
      ]),
    );
  }

  return (
    <div>
      <div className="mb-3 mt-6 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-ink">Outstanding payments</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={level}
            onChange={(e) => setLevel(e.target.value as LevelFilter)}
            className="w-auto py-2 text-sm"
          >
            <option value="all">All levels</option>
            <option value="Secondary">Secondary</option>
            <option value="Primary">Primary</option>
          </Select>
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="w-auto py-2 text-sm"
          >
            <option value="oldest">Oldest first</option>
            <option value="recent">Most recent first</option>
            <option value="high">Highest balance</option>
            <option value="low">Lowest balance</option>
          </Select>
          <button
            type="button"
            onClick={onExport}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm font-semibold text-ink transition hover:border-primary disabled:opacity-40"
          >
            <ExportIcon />
            Export to Excel
          </button>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-ink-muted">
            No outstanding balances for this filter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-border-strong">
                  <Th>Class</Th>
                  <Th>Student</Th>
                  <Th>Guardian</Th>
                  <Th>Owed for</Th>
                  <Th>Balance</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const weeks = weeksOwed(a.bill.createdOn);
                  return (
                    <tr
                      key={a.student.id}
                      className="border-b border-border last:border-0 hover:bg-surface-raised"
                    >
                      <td className="px-4 py-2.5 text-sm text-ink">{a.className}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar first={a.student.firstName} last={a.student.lastName} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">
                              {a.student.firstName} {a.student.lastName}
                            </p>
                            <p className="truncate text-xs text-ink-faint">
                              {a.student.admissionNo}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-ink">
                        {a.guardian.fullName}
                      </td>
                      <td className="px-4 py-2.5">
                        <WeeksPill weeks={weeks} />
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="money text-sm font-semibold text-danger">
                          {formatNaira(a.outstanding)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/students/${a.student.id}`}
                          className="text-sm font-semibold text-primary hover:underline"
                        >
                          Open record
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/** Whole weeks since the bill was raised. Minimum of 1 once a balance exists. */
function weeksOwed(createdOn: string): number {
  const ms = Date.now() - new Date(createdOn).getTime();
  return Math.max(1, Math.floor(ms / (7 * 24 * 60 * 60 * 1000)));
}

function WeeksPill({ weeks }: { weeks: number }) {
  const tone =
    weeks >= 6
      ? "bg-danger-tint text-danger"
      : weeks >= 3
        ? "bg-warning-tint text-warning"
        : "bg-slate-tint text-slate";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tone,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {weeks} {weeks === 1 ? "week" : "weeks"}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-xs font-bold text-ink-faint">{children}</th>
  );
}

function QuickAction({
  href,
  label,
  icon,
  primary,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition",
        primary
          ? "bg-primary text-on-primary hover:bg-primary-hover"
          : "border border-border bg-surface-raised text-ink hover:border-primary",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

function ExportIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="text-success"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" />
    </svg>
  );
}
