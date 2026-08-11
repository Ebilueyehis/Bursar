"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { useOnline } from "@/lib/useOnline";
import { repository } from "@/lib/data/repository";
import {
  PAY_METHODS,
  can,
  termLabel,
} from "@/lib/domain/constants";
import { formatNaira, parseNairaToKobo } from "@/lib/money";
import type {
  Payment,
  PaymentMethod,
  StudentAccount,
} from "@/lib/domain/types";
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  LoadingBlock,
  Money,
  NairaInput,
  Receipt,
  ReceiptLine,
  Select,
  TextArea,
} from "@/components/ui";
import { CheckIcon, PrintIcon } from "@/components/icons";
import { formatDay } from "@/lib/dates";

/** Class ordering, Creche (low) to SSS 3 (high). */
function classRank(label: string): number {
  const s = (label || "").toLowerCase();
  const n = parseInt((s.match(/\d+/) ?? ["0"])[0], 10) || 0;
  if (s.includes("creche")) return 0;
  if (s.includes("nursery")) return 1 + n;
  if (s.includes("kg") || s.includes("recept")) return 5 + n;
  if (s.includes("basic") || s.includes("primary")) return 10 + n;
  if (s.includes("jss")) return 20 + n;
  if (s.includes("sss") || s.includes("ss")) return 30 + n;
  return 99;
}

export default function EntryPage() {
  const { role } = useViewer();

  if (!can(role, "record_payment")) {
    return (
      <EmptyState
        title="New entries are for the Proprietor and Bursar"
        description="Ask an administrator if you need to record payments."
      />
    );
  }

  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-sm text-ink-muted">
        Record a fee payment. A receipt is issued and it posts to the ledger. To
        log an expense or other income, use Payments.
      </p>
      <PaymentEntry />
    </div>
  );
}

// --- Payment (money in) ------------------------------------------------------

function PaymentEntry() {
  const { term, actorName } = useViewer();
  const online = useOnline();
  const { data, loading } = useAsync(
    () => repository.listStudentAccounts(term),
    [term],
  );

  const [className, setClassName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [amountText, setAmountText] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ payment: Payment; account: StudentAccount } | null>(null);

  const accounts = useMemo(() => data ?? [], [data]);
  const classes = useMemo(() => {
    const names = Array.from(new Set(accounts.map((a) => a.className)));
    return names.sort((a, b) => classRank(a) - classRank(b));
  }, [accounts]);
  const inClass = useMemo(
    () => accounts.filter((a) => a.className === className),
    [accounts, className],
  );
  const account = accounts.find((a) => a.student.id === studentId) ?? null;
  const amountKobo = parseNairaToKobo(amountText);

  if (done) {
    return (
      <PaymentSuccess
        payment={done.payment}
        account={done.account}
        onAnother={() => {
          setDone(null);
          setStudentId("");
          setAmountText("");
          setNote("");
        }}
      />
    );
  }

  if (loading && !data) return <LoadingBlock label="Loading students…" />;

  async function submit() {
    setError(null);
    if (!online) {
      setError("You're offline. Bursar records payments only when connected, so no receipt is ever lost. Reconnect and try again.");
      return;
    }
    if (!account) {
      setError("Choose a class and a student first.");
      return;
    }
    if (amountKobo === null || amountKobo <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setSubmitting(true);
    try {
      const payment = await repository.recordPayment({
        studentId: account.student.id,
        term,
        amount: amountKobo,
        method,
        note: note.trim() || undefined,
        recordedByName: actorName,
      });
      const refreshed = await repository.getStudentAccount(account.student.id, term);
      setDone({ payment, account: refreshed?.kind === "account" ? refreshed.account : account });
    } catch (e) {
      setError(e instanceof Error ? e.message : "This payment couldn't be recorded. No money has been affected. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_360px]">
      <Card className="space-y-4">
        {error && <Banner tone="error">{error}</Banner>}

        <Field label="Class">
          <Select
            value={className}
            onChange={(e) => {
              setClassName(e.target.value);
              setStudentId("");
            }}
          >
            <option value="" disabled>
              Select a class
            </option>
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Student"
          hint={className ? undefined : "Choose a class first"}
        >
          <Select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            disabled={!className}
          >
            <option value="" disabled>
              {className ? "Select a student" : "Choose a class first"}
            </option>
            {inClass.map((a) => (
              <option key={a.student.id} value={a.student.id}>
                {a.student.firstName} {a.student.lastName}
              </option>
            ))}
          </Select>
        </Field>

        {account && (
          <div className="flex items-center justify-between rounded-lg bg-surface-sunken px-3.5 py-2.5">
            <span className="text-sm text-ink-muted">Outstanding balance</span>
            <Money
              kobo={account.outstanding}
              tone={account.outstanding > 0 ? "danger" : "success"}
            />
          </div>
        )}

        <Field label="Amount received">
          <NairaInput
            placeholder="e.g. 45,000"
            value={amountText}
            onValueChange={setAmountText}
            className="text-lg"
          />
        </Field>

        {account && account.outstanding > 0 && (
          <button
            type="button"
            onClick={() => setAmountText(String(account.outstanding / 100))}
            className="text-sm font-semibold text-primary"
          >
            Pay full outstanding ({formatNaira(account.outstanding)})
          </button>
        )}

        <Field label="Payment method">
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAY_METHODS.filter((m) => m.value !== "online").map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Note (optional)" hint="e.g. part-payment, paid by uncle">
          <TextArea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note for your records"
          />
        </Field>

        <Button onClick={submit} disabled={submitting || !online} className="w-full">
          {submitting ? "Recording…" : "Record payment"}
        </Button>
      </Card>

      {/* Live receipt preview */}
      <div className="md:sticky md:top-24 md:self-start">
        <Receipt
          receiptNo="Preview"
          date={termLabel(term)}
        >
          <ReceiptLine
            label={account ? `${account.student.firstName} ${account.student.lastName}` : "Student"}
            sub={account ? account.className : "No student chosen yet"}
          />
          <ReceiptLine label="Method" sub={methodLabel(method)} />
          <div className="mt-3 border-t border-dashed border-border pt-3">
            <ReceiptLine
              label="Amount received"
              amount={formatNaira(amountKobo && amountKobo > 0 ? amountKobo : 0)}
            />
            {account && (
              <ReceiptLine
                label="Balance after"
                amount={formatNaira(
                  Math.max(0, account.outstanding - (amountKobo ?? 0)),
                )}
              />
            )}
          </div>
        </Receipt>
      </div>
    </div>
  );
}

function PaymentSuccess({
  payment,
  account,
  onAnother,
}: {
  payment: Payment;
  account: StudentAccount;
  onAnother: () => void;
}) {
  const cleared = account.outstanding <= 0;
  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="flex flex-col items-center pt-4 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-success-tint text-success">
          <CheckIcon width={34} height={34} />
        </span>
        <h2 className="mt-4 font-display text-xl font-bold text-ink">Payment received</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {formatNaira(payment.amount)} from {account.student.firstName}{" "}
          {account.student.lastName}&apos;s{" "}
          {account.guardian.relationship?.toLowerCase() ?? "guardian"}. Receipt{" "}
          {payment.receiptNo} generated.
        </p>
      </div>

      <Receipt receiptNo={payment.receiptNo} date={formatDay(payment.paidOn)}>
        <ReceiptLine
          label={`${account.student.firstName} ${account.student.lastName}`}
          sub={account.className}
        />
        <ReceiptLine label="Method" sub={methodLabel(payment.method)} />
        <ReceiptLine label="Recorded by" sub={payment.recordedByName} />
        <div className="mt-3 border-t border-dashed border-border pt-3">
          <ReceiptLine label="Amount received" amount={formatNaira(payment.amount)} />
          <ReceiptLine
            label="New balance"
            amount={
              cleared ? "Fully paid" : formatNaira(account.outstanding)
            }
          />
        </div>
      </Receipt>

      <div className="grid grid-cols-3 gap-3 no-print">
        <Button variant="secondary" onClick={onAnother}>
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

function methodLabel(m: PaymentMethod): string {
  return PAY_METHODS.find((x) => x.value === m)?.label ?? m;
}
