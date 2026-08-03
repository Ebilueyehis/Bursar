"use client";

import Link from "next/link";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { can, termLabel } from "@/lib/domain/constants";
import { Card, LoadingBlock, Money, cn } from "@/components/ui";
import {
  ChevronRightIcon,
  DebtorsIcon,
  PlusIcon,
  SendIcon,
  UploadIcon,
} from "@/components/icons";

export default function DashboardPage() {
  const { term, role, actorName } = useViewer();
  const { data: stats, loading } = useAsync(
    () => repository.getDashboardStats(term),
    [term],
  );

  const firstName = actorName.split(" ").slice(-1)[0];

  return (
    <div>
      <div className="mb-5">
        <p className="text-sm text-ink-muted">Welcome back, {firstName}.</p>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Dashboard</h1>
      </div>

      {loading && !stats ? (
        <LoadingBlock label="Loading this term's figures…" />
      ) : stats ? (
        <div className="space-y-4">
          {/* The priority: who owes, and how much. */}
          <Link href="/debtors" className="block">
            <div className="rounded-lg border border-ink bg-ink p-5 text-white">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white/70">
                  Outstanding this {termLabel(term).toLowerCase()}
                </p>
                <ChevronRightIcon width={20} height={20} className="opacity-80" />
              </div>
              <p className="money mt-1 text-4xl font-bold">
                {formatBig(stats.totalOutstanding)}
              </p>
              <p className="mt-1 text-sm text-white/70">
                {stats.debtorCount === 0
                  ? "Every balance is cleared. Everything is accounted for."
                  : `${stats.debtorCount} ${
                      stats.debtorCount === 1 ? "student" : "students"
                    } owing, oldest first`}
              </p>
            </div>
          </Link>

          {/* Collected vs students */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <p className="text-sm text-ink-muted">Collected</p>
              <Money
                kobo={stats.totalCollected}
                tone="success"
                className="mt-1 block text-xl"
              />
              <p className="mt-1 text-xs text-ink-faint">
                of {formatBig(stats.totalBilled)} billed
              </p>
            </Card>
            <Card>
              <p className="text-sm text-ink-muted">Students</p>
              <p className="tabular mt-1 text-xl font-semibold text-ink">
                {stats.studentCount}
              </p>
              <p className="mt-1 text-xs text-ink-faint">active this session</p>
            </Card>
          </div>

          {/* Payment status split */}
          <Card>
            <p className="mb-3 text-sm font-semibold text-ink">Fees status</p>
            <StatusBar
              paid={stats.fullyPaidCount}
              partial={stats.partialCount}
              unpaid={stats.unpaidCount}
            />
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Legend tone="paid" label="Paid" value={stats.fullyPaidCount} />
              <Legend tone="partial" label="Part-paid" value={stats.partialCount} />
              <Legend tone="unpaid" label="Not paid" value={stats.unpaidCount} />
            </div>
          </Card>

          {/* Quick actions, role-aware */}
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Quick actions</p>
            <div className="grid grid-cols-2 gap-3">
              {can(role, "record_payment") && (
                <QuickAction href="/pay" label="Record payment" icon={<PlusIcon width={20} height={20} />} />
              )}
              <QuickAction href="/debtors" label="See who's owing" icon={<DebtorsIcon width={20} height={20} />} />
              {can(role, "import_students") && (
                <QuickAction href="/students/import" label="Import students" icon={<UploadIcon width={20} height={20} />} />
              )}
              {can(role, "send_reminders") && (
                <QuickAction href="/debtors" label="Send reminders" icon={<SendIcon width={20} height={20} />} />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatBig(kobo: number): string {
  const naira = kobo / 100;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(naira);
}

function StatusBar({
  paid,
  partial,
  unpaid,
}: {
  paid: number;
  partial: number;
  unpaid: number;
}) {
  const total = Math.max(1, paid + partial + unpaid);
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="flex h-3 overflow-hidden rounded-full bg-surface-sunken">
      <div className="bg-success" style={{ width: seg(paid) }} />
      <div className="bg-warning" style={{ width: seg(partial) }} />
      <div className="bg-danger" style={{ width: seg(unpaid) }} />
    </div>
  );
}

function Legend({
  tone,
  label,
  value,
}: {
  tone: "paid" | "partial" | "unpaid";
  label: string;
  value: number;
}) {
  const dot = { paid: "bg-success", partial: "bg-warning", unpaid: "bg-danger" }[
    tone
  ];
  return (
    <div>
      <div className="flex items-center justify-center gap-1.5">
        <span className={cn("size-2 rounded-full", dot)} />
        <span className="tabular text-lg font-semibold text-ink">{value}</span>
      </div>
      <p className="text-xs text-ink-muted">{label}</p>
    </div>
  );
}

function QuickAction({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3.5 text-sm font-semibold text-ink transition hover:bg-surface-sunken"
    >
      <span className="text-primary">{icon}</span>
      {label}
    </Link>
  );
}
