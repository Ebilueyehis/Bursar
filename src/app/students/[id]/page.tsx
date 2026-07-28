"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { can, termLabel } from "@/lib/domain/constants";
import { messaging } from "@/lib/messaging/mock";
import { templates, type Channel } from "@/lib/messaging/provider";
import {
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  Money,
  StatusPill,
  cn,
} from "@/components/ui";
import {
  ArrowLeftIcon,
  CheckIcon,
  PhoneIcon,
  PlusIcon,
  SendIcon,
} from "@/components/icons";
import { Avatar } from "@/app/debtors/page";
import type { PaymentMethod } from "@/lib/domain/types";

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const { term, role, school } = useViewer();
  const { data: account, loading } = useAsync(
    () => repository.getStudentAccount(params.id, term),
    [params.id, term],
  );

  if (loading && !account) return <LoadingBlock label="Loading student…" />;
  if (!account)
    return (
      <div>
        <BackLink />
        <EmptyState title="Student not found" description="This record may have been removed." />
      </div>
    );

  const { student, guardian, className, status, outstanding } = account;
  const statusPill =
    status === "paid" ? "paid" : status === "partial" ? "partial" : "unpaid";

  return (
    <div className="space-y-4">
      <BackLink />

      <div className="flex items-center gap-3">
        <Avatar first={student.firstName} last={student.lastName} />
        <div className="flex-1">
          <h1 className="text-xl font-bold text-ink">
            {student.firstName} {student.lastName}
          </h1>
          <p className="text-sm text-ink-muted">
            {className} · {student.admissionNo}
          </p>
        </div>
        <StatusPill tone={statusPill}>
          {status === "paid" ? "Paid" : status === "partial" ? "Part-paid" : "Not paid"}
        </StatusPill>
      </div>

      {/* Balance */}
      <Card>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-ink-muted">
              Outstanding · {termLabel(term)}
            </p>
            <Money
              kobo={outstanding}
              tone={outstanding > 0 ? "danger" : "success"}
              className="text-2xl"
            />
          </div>
          {can(role, "record_payment") && (
            <Link href={`/pay?student=${student.id}`}>
              <Button className="min-h-11 px-4 text-sm">
                <PlusIcon width={18} height={18} />
                Record payment
              </Button>
            </Link>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-muted">Billed</span>
            <Money kobo={account.billTotal} tone="ink" className="font-medium" />
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted">Paid</span>
            <Money kobo={account.paid} tone="success" className="font-medium" />
          </div>
        </div>
      </Card>

      {/* Reminder */}
      {outstanding > 0 && can(role, "send_reminders") && school && (
        <ReminderCard
          phone={guardian.phone}
          message={templates.feeReminder(account, school.name)}
        />
      )}

      {/* Guardian */}
      <Card>
        <p className="mb-2 text-sm font-semibold text-ink">Guardian</p>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-ink">{guardian.fullName}</p>
            <p className="text-xs text-ink-muted">
              {guardian.relationship ?? "Guardian"}
            </p>
          </div>
          <a
            href={`tel:${guardian.phone}`}
            className="flex items-center gap-2 rounded-lg bg-primary-tint px-3.5 py-2 text-sm font-semibold text-primary"
          >
            <PhoneIcon width={18} height={18} />
            {guardian.phone}
          </a>
        </div>
      </Card>

      {/* Bill breakdown */}
      <Card>
        <p className="mb-2 text-sm font-semibold text-ink">
          Bill · {termLabel(term)}
        </p>
        <ul>
          {account.bill.lines.map((line) => (
            <li
              key={line.name}
              className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0"
            >
              <span className="text-ink-muted">{line.name}</span>
              <Money kobo={line.amount} tone="ink" className="font-medium" />
            </li>
          ))}
          {account.bill.discount > 0 && (
            <li className="flex items-center justify-between border-b border-border py-2 text-sm">
              <span className="text-ink-muted">Discount</span>
              <Money kobo={-account.bill.discount} tone="success" className="font-medium" />
            </li>
          )}
          <li className="flex items-center justify-between pt-2.5 text-sm">
            <span className="font-semibold text-ink">Total</span>
            <Money kobo={account.billTotal} tone="ink" className="text-base" />
          </li>
        </ul>
      </Card>

      {/* Receipts */}
      <div>
        <p className="mb-2 text-sm font-semibold text-ink">
          Receipts ({account.payments.length})
        </p>
        {account.payments.length === 0 ? (
          <EmptyState title="No payments yet" description="Recorded payments and their receipts appear here." />
        ) : (
          <ul className="space-y-2.5">
            {[...account.payments].reverse().map((p) => (
              <Card key={p.id} className="flex items-center justify-between">
                <div>
                  <p className="tabular text-sm font-semibold text-ink">
                    {p.receiptNo}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {formatDate(p.paidOn)} · {methodLabel(p.method)}
                  </p>
                </div>
                <Money kobo={p.amount} tone="success" />
              </Card>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ReminderCard({ phone, message }: { phone: string; message: string }) {
  const [channel, setChannel] = useState<Channel>("sms");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<null | { ok: boolean; error?: string }>(null);

  async function send() {
    setSending(true);
    setSent(null);
    const result = await messaging.send({ to: phone, channel, body: message });
    setSent({ ok: result.ok, error: result.error });
    setSending(false);
  }

  if (sent?.ok) {
    return (
      <Card className="flex items-center gap-3 bg-success-tint">
        <span className="flex size-9 items-center justify-center rounded-full bg-success text-white">
          <CheckIcon width={20} height={20} />
        </span>
        <div>
          <p className="text-sm font-semibold text-success">Reminder sent</p>
          <p className="text-xs text-success/80">
            Sent to {phone} by {channel === "sms" ? "SMS" : "WhatsApp"}.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <p className="mb-2 text-sm font-semibold text-ink">Send fee reminder</p>
      <p className="mb-3 rounded-md bg-surface-sunken p-3 text-sm text-ink-muted">
        “{message}”
      </p>
      <div className="mb-3 flex gap-2">
        {(["sms", "whatsapp"] as Channel[]).map((c) => (
          <button
            key={c}
            onClick={() => setChannel(c)}
            className={cn(
              "flex-1 rounded-lg border px-3 py-2 text-sm font-semibold",
              channel === c
                ? "border-primary bg-primary-tint text-primary"
                : "border-border text-ink-muted",
            )}
          >
            {c === "sms" ? "SMS" : "WhatsApp"}
          </button>
        ))}
      </div>
      {sent && !sent.ok && (
        <p className="mb-2 text-sm text-danger">
          Couldn&apos;t send: {sent.error ?? "please try again."} No charge was made.
        </p>
      )}
      <Button onClick={send} disabled={sending} className="w-full">
        <SendIcon width={18} height={18} />
        {sending ? "Sending…" : `Send to ${phone}`}
      </Button>
    </Card>
  );
}

function BackLink() {
  return (
    <Link
      href="/students"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted"
    >
      <ArrowLeftIcon width={18} height={18} />
      Students
    </Link>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function methodLabel(m: PaymentMethod): string {
  return { cash: "Cash", transfer: "Bank transfer", pos: "POS / card", online: "Online" }[m];
}
