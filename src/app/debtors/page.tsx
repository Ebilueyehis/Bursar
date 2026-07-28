"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { termLabel } from "@/lib/domain/constants";
import {
  Card,
  EmptyState,
  Input,
  LoadingBlock,
  Money,
  StatusPill,
  cn,
} from "@/components/ui";
import { CheckIcon, ChevronRightIcon } from "@/components/icons";
import type { StudentAccount } from "@/lib/domain/types";

export default function DebtorsPage() {
  const { term } = useViewer();
  const { data, loading } = useAsync(() => repository.listDebtors(term), [term]);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((a) =>
      `${a.student.firstName} ${a.student.lastName} ${a.className} ${a.guardian.fullName}`
        .toLowerCase()
        .includes(q),
    );
  }, [data, query]);

  const totalOwing = filtered.reduce((s, a) => s + a.outstanding, 0);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Outstanding balances
        </h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          {termLabel(term)} · sorted oldest first, so you know who to follow up
          with first.
        </p>
      </div>

      {loading && !data ? (
        <LoadingBlock label="Finding outstanding balances…" />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<CheckIcon width={32} height={32} />}
          title="Every balance is cleared"
          description="No student owes for this term. Everything is accounted for."
        />
      ) : (
        <>
          <Card className="mb-4 flex items-center justify-between bg-primary text-on-primary">
            <div>
              <p className="text-sm text-on-primary/80">Total outstanding</p>
              <p className="tabular text-2xl font-bold">
                {new Intl.NumberFormat("en-NG", {
                  style: "currency",
                  currency: "NGN",
                  maximumFractionDigits: 0,
                }).format(totalOwing / 100)}
              </p>
            </div>
            <div className="text-right">
              <p className="tabular text-2xl font-bold">{filtered.length}</p>
              <p className="text-sm text-on-primary/80">
                {filtered.length === 1 ? "student" : "students"}
              </p>
            </div>
          </Card>

          <Input
            type="search"
            placeholder="Search student, class or guardian…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mb-3"
          />

          <ul className="space-y-2.5">
            {filtered.map((account) => (
              <DebtorRow key={account.student.id} account={account} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function DebtorRow({ account }: { account: StudentAccount }) {
  const { student, className, outstanding, status } = account;
  const days = daysSince(account.bill.createdOn);

  return (
    <li>
      <Link
        href={`/students/${student.id}`}
        className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3.5 transition hover:bg-surface-sunken"
      >
        <Avatar first={student.firstName} last={student.lastName} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">
            {student.firstName} {student.lastName}
          </p>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
            <span>{className}</span>
            <span aria-hidden>·</span>
            <span className={cn(days >= 30 && "font-semibold text-danger")}>
              {days} {days === 1 ? "day" : "days"} owing
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Money kobo={outstanding} tone={status === "partial" ? "warning" : "danger"} />
          <StatusPill tone={status === "partial" ? "partial" : "unpaid"}>
            {status === "partial" ? "Part-paid" : "Not paid"}
          </StatusPill>
        </div>
        <ChevronRightIcon width={18} height={18} className="text-ink-faint" />
      </Link>
    </li>
  );
}

export function Avatar({ first, last }: { first: string; last: string }) {
  const initials = `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-sm font-bold text-primary">
      {initials}
    </span>
  );
}

function daysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - then) / 86_400_000));
}
