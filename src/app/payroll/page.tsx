"use client";

import { useState } from "react";
import Link from "next/link";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { useOnline } from "@/lib/useOnline";
import { repository } from "@/lib/data/repository";
import type { PayrollResult } from "@/lib/data/repository";
import { can } from "@/lib/domain/constants";
import { currentPeriod, formatPeriod } from "@/lib/dates";
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  Money,
  PageHeader,
  StatusPill,
} from "@/components/ui";
import { CheckIcon } from "@/components/icons";

export default function PayrollPage() {
  const { role, actorName } = useViewer();
  const online = useOnline();
  const [period, setPeriod] = useState(currentPeriod());
  const { data: preview, loading, reload } = useAsync(
    () => repository.previewPayroll(period),
    [period],
  );
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PayrollResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!can(role, "manage_staff")) {
    return (
      <EmptyState
        title="Payroll is for the Proprietor and Bursar"
        description="Ask an administrator if you need to run salary payments."
      />
    );
  }

  async function run() {
    setError(null);
    if (!online) {
      setError("You're offline. Reconnect to run payroll.");
      return;
    }
    setRunning(true);
    try {
      const r = await repository.runPayroll(period, actorName);
      setResult(r);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payroll couldn't be completed. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  const rows = preview?.rows ?? [];
  const toPay = rows.filter((r) => !r.alreadyPaid && r.staff.monthlySalary > 0);

  return (
    <div>
      <PageHeader
        title="Run payroll"
        subtitle="Pay every active staff member their monthly salary in one step."
        action={
          <Link href="/staff" className="contents">
            <Button variant="ghost">Staff register</Button>
          </Link>
        }
      />

      <Card className="mb-4">
        <Field label="Pay for the month of">
          <Input
            type="month"
            value={period}
            max={currentPeriod()}
            onChange={(e) => { setPeriod(e.target.value); setResult(null); }}
          />
        </Field>
      </Card>

      {error && <div className="mb-4"><Banner tone="error">{error}</Banner></div>}

      {result && (
        <div className="mb-4">
          <Banner tone="success" title={`Payroll run for ${formatPeriod(period)}`}>
            {result.created > 0
              ? `Paid ${result.created} ${result.created === 1 ? "person" : "people"}, total ${nairaFromKobo(result.totalPaidKobo)}.`
              : "Everyone was already paid for this month, nothing was charged twice."}
            {result.skipped > 0 && ` ${result.skipped} skipped (already paid or no salary set).`}
          </Banner>
        </div>
      )}

      {loading && !preview ? (
        <LoadingBlock label="Checking who's due…" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No active staff to pay"
          description="Add staff and set their monthly salary first."
        />
      ) : (
        <>
          <Card className="mb-3 flex items-center justify-between bg-surface-sunken">
            <span className="text-sm text-ink-muted">
              {toPay.length} to pay for {formatPeriod(period)}
            </span>
            <span className="text-sm text-ink-muted">
              Total <Money kobo={preview?.totalToPayKobo ?? 0} />
            </span>
          </Card>

          <ul className="space-y-2.5">
            {rows.map(({ staff, alreadyPaid }) => (
              <li
                key={staff.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{staff.fullName}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {staff.assignment || (staff.employmentType === "teaching" ? "Teaching" : "Non-teaching")}
                  </p>
                </div>
                {alreadyPaid ? (
                  <StatusPill tone="paid">
                    <CheckIcon width={12} height={12} /> Paid
                  </StatusPill>
                ) : staff.monthlySalary <= 0 ? (
                  <StatusPill tone="neutral">No salary set</StatusPill>
                ) : (
                  <Money kobo={staff.monthlySalary} className="text-sm" />
                )}
              </li>
            ))}
          </ul>

          <div className="sticky bottom-24 mt-5 md:bottom-4">
            <Button
              onClick={run}
              disabled={running || !online || toPay.length === 0}
              className="w-full shadow-lg"
            >
              {running
                ? "Running payroll…"
                : toPay.length === 0
                  ? "Everyone is paid for this month"
                  : `Pay ${toPay.length} · ${nairaFromKobo(preview?.totalToPayKobo ?? 0)}`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function nairaFromKobo(kobo: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(kobo / 100);
}
