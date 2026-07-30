"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { useOnline } from "@/lib/useOnline";
import { termLabel } from "@/lib/domain/constants";
import { formatNaira, parseNairaToKobo } from "@/lib/money";
import type {
  Payment,
  PaymentMethod,
  StudentAccount,
} from "@/lib/domain/types";
import {
  Button,
  Card,
  Field,
  Input,
  LoadingBlock,
  Money,
  NairaInput,
  Select,
  StatusPill,
  TextArea,
  cn,
} from "@/components/ui";
import { AlertIcon, CheckIcon, PrintIcon } from "@/components/icons";
import { Avatar } from "@/app/debtors/page";

export default function RecordPaymentPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <RecordPaymentInner />
    </Suspense>
  );
}

function RecordPaymentInner() {
  const params = useSearchParams();
  const preselected = params.get("student");
  const [studentId, setStudentId] = useState<string | null>(preselected);
  const [receipt, setReceipt] = useState<{ payment: Payment; account: StudentAccount } | null>(null);

  if (receipt) {
    return <PaymentSuccess payment={receipt.payment} account={receipt.account} onDone={() => { setReceipt(null); setStudentId(null); }} />;
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-ink">
        Record payment
      </h1>
      <p className="mb-5 text-sm text-ink-muted">
        Enter a payment received. A receipt is generated automatically.
      </p>

      {studentId ? (
        <PaymentForm
          studentId={studentId}
          onBack={() => setStudentId(null)}
          onRecorded={(payment, account) => setReceipt({ payment, account })}
        />
      ) : (
        <StudentPicker onPick={setStudentId} />
      )}
    </div>
  );
}

// --- Step 1: pick a student --------------------------------------------------

function StudentPicker({ onPick }: { onPick: (id: string) => void }) {
  const { term } = useViewer();
  const { data, loading } = useAsync(
    () => repository.listStudentAccounts(term),
    [term],
  );
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const list = q
      ? data.filter((a) =>
          `${a.student.firstName} ${a.student.lastName} ${a.className} ${a.student.admissionNo}`
            .toLowerCase()
            .includes(q),
        )
      : data;
    // Show those owing first — most payments clear a balance.
    return [...list].sort((a, b) => b.outstanding - a.outstanding);
  }, [data, query]);

  if (loading && !data) return <LoadingBlock label="Loading students…" />;

  return (
    <div>
      <Input
        type="search"
        placeholder="Search student by name or admission no…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-3"
        autoFocus
      />
      <ul className="space-y-2.5">
        {filtered.map((a) => (
          <li key={a.student.id}>
            <button
              onClick={() => onPick(a.student.id)}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-3.5 text-left transition hover:bg-surface-sunken"
            >
              <Avatar first={a.student.firstName} last={a.student.lastName} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">
                  {a.student.firstName} {a.student.lastName}
                </p>
                <p className="text-xs text-ink-muted">{a.className}</p>
              </div>
              {a.outstanding > 0 ? (
                <Money kobo={a.outstanding} tone="danger" className="text-sm" />
              ) : (
                <StatusPill tone="paid">Paid</StatusPill>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- Step 2: enter the payment ----------------------------------------------

function PaymentForm({
  studentId,
  onBack,
  onRecorded,
}: {
  studentId: string;
  onBack: () => void;
  onRecorded: (payment: Payment, account: StudentAccount) => void;
}) {
  const { term, actorName } = useViewer();
  const online = useOnline();
  const { data: account, loading } = useAsync(
    () => repository.getStudentAccount(studentId, term),
    [studentId, term],
  );

  const [amountText, setAmountText] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading && !account) return <LoadingBlock label="Loading student…" />;
  if (!account)
    return (
      <Card>
        <p className="text-ink">This student has no bill for {termLabel(term)}.</p>
      </Card>
    );

  const amountKobo = parseNairaToKobo(amountText);
  const wouldOverpay = amountKobo !== null && amountKobo > account.outstanding && account.outstanding > 0;

  async function submit() {
    setError(null);
    if (!online) {
      setError("You're offline. Bursar records payments only when connected, so no receipt is ever lost. Reconnect and try again.");
      return;
    }
    if (amountKobo === null || amountKobo <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setSubmitting(true);
    try {
      const payment = await repository.recordPayment({
        studentId,
        term,
        amount: amountKobo,
        method,
        note: note.trim() || undefined,
        recordedByName: actorName,
      });
      const refreshed = await repository.getStudentAccount(studentId, term);
      onRecorded(payment, refreshed ?? account!);
    } catch (e) {
      setError(e instanceof Error ? e.message : "This payment couldn't be recorded. No money has been affected. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Student + balance summary */}
      <Card>
        <div className="flex items-center gap-3">
          <Avatar first={account.student.firstName} last={account.student.lastName} />
          <div className="flex-1">
            <p className="font-semibold text-ink">
              {account.student.firstName} {account.student.lastName}
            </p>
            <p className="text-xs text-ink-muted">
              {account.className} · {account.student.admissionNo}
            </p>
          </div>
          <button onClick={onBack} className="text-sm font-semibold text-primary">
            Change
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm text-ink-muted">Outstanding balance</span>
          <Money
            kobo={account.outstanding}
            tone={account.outstanding > 0 ? "danger" : "success"}
            className="text-lg"
          />
        </div>
      </Card>

      {!online && (
        <div className="flex items-start gap-2.5 rounded-lg bg-warning-tint p-3.5 text-sm text-warning">
          <AlertIcon width={20} height={20} className="mt-0.5 shrink-0" />
          <p>
            You&apos;re offline. You can view records, but recording a payment
            needs a connection so no receipt is ever lost.
          </p>
        </div>
      )}

      <Field label="Amount received" error={error ?? undefined}>
        <NairaInput
          placeholder="e.g. 45,000"
          value={amountText}
          onValueChange={setAmountText}
          className="text-lg"
        />
      </Field>

      {account.outstanding > 0 && (
        <button
          onClick={() => setAmountText(String(account.outstanding / 100))}
          className="text-sm font-semibold text-primary"
        >
          Pay full outstanding ({formatNaira(account.outstanding)})
        </button>
      )}

      {wouldOverpay && (
        <p className="text-sm text-warning">
          This is more than the {formatNaira(account.outstanding)} outstanding.
          The extra will show as credit.
        </p>
      )}

      <Field label="Payment method">
        <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
          <option value="cash">Cash</option>
          <option value="transfer">Bank transfer</option>
          <option value="pos">POS / card</option>
        </Select>
      </Field>

      <Field label="Note (optional)" hint="e.g. part-payment, paid by uncle">
        <TextArea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note for your records"
        />
      </Field>

      {amountKobo !== null && amountKobo > 0 && (
        <Card className="bg-surface-sunken">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-muted">New balance after this payment</span>
            <Money
              kobo={Math.max(0, account.outstanding - amountKobo)}
              tone={account.outstanding - amountKobo <= 0 ? "success" : "warning"}
            />
          </div>
        </Card>
      )}

      <Button
        onClick={submit}
        disabled={submitting || !online}
        className="w-full"
      >
        {submitting ? "Recording…" : "Record payment"}
      </Button>
    </div>
  );
}

// --- Step 3: success + receipt ----------------------------------------------

function PaymentSuccess({
  payment,
  account,
  onDone,
}: {
  payment: Payment;
  account: StudentAccount;
  onDone: () => void;
}) {
  const cleared = account.outstanding <= 0;
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center pt-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-success-tint text-success">
          <CheckIcon width={34} height={34} />
        </span>
        <h1 className="mt-4 text-xl font-bold text-ink">Payment received</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {formatNaira(payment.amount)} from{" "}
          {account.student.firstName} {account.student.lastName}&apos;s{" "}
          {account.guardian.relationship?.toLowerCase() ?? "guardian"}. Receipt{" "}
          {payment.receiptNo} generated.
        </p>
      </div>

      <Card>
        <Row label="Receipt no." value={payment.receiptNo} mono />
        <Row label="Student" value={`${account.student.firstName} ${account.student.lastName}`} />
        <Row label="Class" value={account.className} />
        <Row label="Amount" valueNode={<Money kobo={payment.amount} tone="success" />} />
        <Row label="Method" value={methodLabel(payment.method)} />
        <Row
          label="New balance"
          valueNode={
            cleared ? (
              <StatusPill tone="paid">Fully paid</StatusPill>
            ) : (
              <Money kobo={account.outstanding} tone="warning" />
            )
          }
        />
        <Row label="Recorded by" value={payment.recordedByName} />
      </Card>

      {cleared && (
        <p className="rounded-lg bg-success-tint px-4 py-3 text-center text-sm font-medium text-success">
          This student&apos;s fees are fully paid for the term. Everything is
          accounted for.
        </p>
      )}

      <div className="grid grid-cols-3 gap-3 no-print">
        <Button variant="secondary" onClick={onDone}>
          Record another
        </Button>
        <Button variant="ghost" onClick={() => window.print()}>
          <PrintIcon width={18} height={18} />
          Print
        </Button>
        <Link href={`/students/${account.student.id}`} className="contents">
          <Button variant="primary" className="w-full">
            View student
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueNode,
  mono,
}: {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
      <span className="text-sm text-ink-muted">{label}</span>
      {valueNode ?? (
        <span className={cn("text-sm font-semibold text-ink", mono && "tabular")}>
          {value}
        </span>
      )}
    </div>
  );
}

function methodLabel(m: PaymentMethod): string {
  return { cash: "Cash", transfer: "Bank transfer", pos: "POS / card", online: "Online" }[m];
}
