"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { can, termLabel } from "@/lib/domain/constants";
import { formatNaira } from "@/lib/money";
import { messaging } from "@/lib/messaging/mock";
import { templates, type Channel } from "@/lib/messaging/provider";
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  Money,
  NairaInput,
  StatusPill,
  cn,
} from "@/components/ui";
import { parseNairaToKobo } from "@/lib/money";
import { BillPicker } from "@/components/BillPicker";
import {
  type BillDraft,
  checkedLines,
  validateBillDraft,
} from "@/lib/fees/billMath";
import {
  ArrowLeftIcon,
  CheckIcon,
  PhoneIcon,
  PlusIcon,
  PrintIcon,
  SendIcon,
} from "@/components/icons";
import { Avatar } from "@/app/debtors/page";
import type { Payment, PaymentMethod, StudentAccount, TermName } from "@/lib/domain/types";

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const { term, role, school } = useViewer();
  const { data: result, loading, reload } = useAsync(
    () => repository.getStudentAccount(params.id, term),
    [params.id, term],
  );

  if (loading && !result) return <LoadingBlock label="Loading student…" />;
  if (!result)
    return (
      <div>
        <BackLink />
        <EmptyState title="Student not found" description="This record may have been removed." />
      </div>
    );

  if (result.kind === "billless") {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="flex items-center gap-3">
          <Avatar first={result.student.firstName} last={result.student.lastName} />
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold text-ink">
              {result.student.firstName} {result.student.lastName}
            </h1>
            <p className="text-sm text-ink-muted">
              {result.className} · {result.student.admissionNo}
            </p>
          </div>
        </div>
        <EmptyState
          title="No bill for this term yet"
          description={`${result.guardian.fullName} · ${result.guardian.phone}`}
        />
        {can(role, "manage_students") && (
          <GenerateBillCard studentId={result.student.id} term={term} onGenerated={reload} />
        )}
      </div>
    );
  }

  const { student, guardian, className, status, outstanding } = result.account;
  const account = result.account;
  const statusPill =
    status === "paid" ? "paid" : status === "partial" ? "partial" : "unpaid";

  return (
    <div className="space-y-4">
      <BackLink />

      <div className="flex items-center gap-3">
        <Avatar first={student.firstName} last={student.lastName} />
        <div className="flex-1">
          <h1 className="font-display text-xl font-bold text-ink">
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

      <RecordTabs
        account={account}
        canEditFees={can(role, "edit_fees")}
        canRemind={can(role, "send_reminders")}
        schoolName={school?.name}
        term={term}
        onReload={reload}
      />
    </div>
  );
}

// --- Details / Payments / Receipts tabs -------------------------------------

type RecordTab = "details" | "bill" | "payments" | "receipts";

function RecordTabs({
  account,
  canEditFees,
  canRemind,
  schoolName,
  term,
  onReload,
}: {
  account: StudentAccount;
  canEditFees: boolean;
  canRemind: boolean;
  schoolName?: string;
  term: TermName;
  onReload: () => void;
}) {
  const [tab, setTab] = useState<RecordTab>("details");
  const { student, guardian, outstanding } = account;
  const tabs: { id: RecordTab; label: string }[] = [
    { id: "details", label: "Details" },
    ...(canEditFees && account.bill.id
      ? [{ id: "bill" as const, label: "Bill" }]
      : []),
    { id: "payments", label: "Payments" },
    { id: "receipts", label: "Receipts" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition",
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "details" && (
        <div className="space-y-4">
          {outstanding > 0 && canRemind && schoolName && (
            <ReminderCard
              phone={guardian.phone}
              message={templates.feeReminder(account, schoolName)}
            />
          )}

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
                  <span className="text-ink-muted">
                    Discount
                    {account.bill.discountReason && (
                      <span className="ml-1.5 text-xs text-ink-faint">
                        ({account.bill.discountReason})
                      </span>
                    )}
                  </span>
                  <Money kobo={-account.bill.discount} tone="success" className="font-medium" />
                </li>
              )}
              <li className="flex items-center justify-between pt-2.5 text-sm">
                <span className="font-semibold text-ink">Total</span>
                <Money kobo={account.billTotal} tone="ink" className="text-base" />
              </li>
            </ul>

            {canEditFees && account.bill.id && (
              <DiscountEditor
                studentId={student.id}
                term={term}
                currentKobo={account.bill.discount}
                currentReason={account.bill.discountReason}
                onSaved={onReload}
              />
            )}
          </Card>
        </div>
      )}

      {tab === "bill" && (
        <Card>
          <p className="mb-1 text-sm font-semibold text-ink">
            Edit bill · {termLabel(term)}
          </p>
          <p className="mb-3 text-sm text-ink-muted">
            Untick items that do not apply, adjust amounts, or add a line. A
            discount with a reason shows under Fees as a scholarship.
          </p>
          <BillEditor account={account} term={term} onSaved={onReload} />
        </Card>
      )}

      {tab === "payments" && (
        <Card className="p-0">
          {account.payments.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No payments yet"
                description="Recorded payments appear here."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr className="border-b-2 border-border-strong">
                    <th className="px-4 py-3 text-xs font-bold text-ink-faint">Date</th>
                    <th className="px-4 py-3 text-xs font-bold text-ink-faint">Method</th>
                    <th className="px-4 py-3 text-xs font-bold text-ink-faint">Recorded by</th>
                    <th className="px-4 py-3 text-xs font-bold text-ink-faint">Amount</th>
                    <th className="px-4 py-3 text-xs font-bold text-ink-faint">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {[...account.payments].reverse().map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 text-sm tabular text-ink">
                        {formatDate(p.paidOn)}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-ink">{methodLabel(p.method)}</td>
                      <td className="px-4 py-2.5 text-sm text-ink">{p.recordedByName}</td>
                      <td className="px-4 py-2.5">
                        <Money kobo={p.amount} tone="success" className="text-sm" />
                      </td>
                      <td className="px-4 py-2.5 text-sm tabular text-ink-muted">
                        {p.receiptNo}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "receipts" && (
        <div>
          {account.payments.length === 0 ? (
            <EmptyState
              title="No receipts yet"
              description="Each recorded payment gets a printable receipt here."
            />
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
                  <div className="flex items-center gap-3">
                    <Money kobo={p.amount} tone="success" />
                    <button
                      onClick={() => printReceipt(p, account)}
                      className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:border-primary hover:text-primary"
                      aria-label="Print receipt"
                    >
                      <PrintIcon width={15} height={15} />
                      Print receipt
                    </button>
                  </div>
                </Card>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function GenerateBillCard({
  studentId,
  term,
  onGenerated,
}: {
  studentId: string;
  term: TermName;
  onGenerated: () => void;
}) {
  const [draft, setDraft] = useState<BillDraft>({
    lines: [{ name: "", amountKobo: 0, checked: true }],
    discountKobo: 0,
    discountReason: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function generateFromStructure() {
    setError(null);
    setSaving(true);
    try {
      await repository.generateBill(studentId, term);
      onGenerated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate the bill.");
    } finally {
      setSaving(false);
    }
  }

  async function saveManualBill() {
    setError(null);
    const lines = checkedLines(draft);
    if (lines.length === 0) return setError("Add at least one item to the bill.");
    setSaving(true);
    try {
      await repository.createBillForTerm(
        studentId,
        term,
        lines.map((l) => ({ name: l.name, amountKobo: l.amountKobo })),
        draft.discountKobo,
        draft.discountReason.trim() || undefined,
      );
      onGenerated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the bill.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-3">
      <p className="text-sm font-semibold text-ink">Generate Bill</p>
      <p className="text-sm text-ink-muted">
        Use the class fee structure if one is set, or type the bill by hand.
      </p>
      {error && <Banner tone="error">{error}</Banner>}
      <Button onClick={generateFromStructure} disabled={saving} className="w-full">
        {saving ? "Generating…" : "Generate from class fee structure"}
      </Button>
      <div className="border-t border-border pt-3">
        <p className="mb-2 text-sm font-semibold text-ink">Or enter manually</p>
        <BillPicker value={draft} onChange={setDraft} />
        <Button onClick={saveManualBill} disabled={saving} className="mt-3 w-full">
          {saving ? "Saving…" : "Save bill"}
        </Button>
      </div>
    </Card>
  );
}

function BillEditor({
  account,
  term,
  onSaved,
}: {
  account: StudentAccount;
  term: TermName;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<BillDraft>({
    lines: account.bill.lines.map((l) => ({
      name: l.name,
      amountKobo: l.amount,
      checked: true,
    })),
    discountKobo: account.bill.discount,
    discountReason: account.bill.discountReason ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setError(null);
    setSaved(false);
    const problem = validateBillDraft(draft, account.paid);
    if (problem) return setError(problem);
    setSaving(true);
    try {
      await repository.updateBillLines(account.student.id, term, checkedLines(draft));
      await repository.setStudentDiscount(
        account.student.id,
        term,
        draft.discountKobo,
        draft.discountReason.trim() || undefined,
      );
      setSaved(true);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the bill.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && <Banner tone="error">{error}</Banner>}
      {saved && <Banner tone="success">Bill updated.</Banner>}
      <BillPicker value={draft} onChange={setDraft} paidKobo={account.paid} />
      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? "Saving…" : "Save bill"}
      </Button>
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

function DiscountEditor({
  studentId,
  term,
  currentKobo,
  currentReason,
  onSaved,
}: {
  studentId: string;
  term: TermName;
  currentKobo: number;
  currentReason?: string;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amountText, setAmountText] = useState(
    currentKobo > 0 ? String(currentKobo / 100) : "",
  );
  const [reason, setReason] = useState(currentReason ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 border-t border-border pt-3 text-sm font-semibold text-primary"
      >
        {currentKobo > 0 ? "Edit discount / scholarship" : "Add discount / scholarship"}
      </button>
    );
  }

  async function save() {
    setError(null);
    const kobo = amountText.trim() ? parseNairaToKobo(amountText) : 0;
    if (kobo === null) {
      setError("Enter a valid amount, or leave blank to remove.");
      return;
    }
    setSaving(true);
    try {
      await repository.setStudentDiscount(studentId, term, kobo ?? 0, reason.trim() || undefined);
      setOpen(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the discount.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      {error && <Banner tone="error">{error}</Banner>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Discount amount">
          <NairaInput
            value={amountText}
            onValueChange={setAmountText}
            placeholder="e.g. 10,000"
          />
        </Field>
        <Field label="Reason">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Scholarship"
          />
        </Field>
      </div>
      <div className="flex gap-3">
        <Button onClick={save} disabled={saving} className="flex-1">
          {saving ? "Saving…" : "Save discount"}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
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

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function printReceipt(p: Payment, account: StudentAccount) {
  const w = window.open("", "_blank", "width=400,height=600");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>Receipt ${esc(p.receiptNo)}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 360px; margin: 20px auto; color: #1b2a3c; }
  h2 { text-align: center; margin: 0 0 4px; font-size: 18px; }
  .sub { text-align: center; color: #4a5568; font-size: 12px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td { padding: 6px 0; border-bottom: 1px solid #dcd6c4; }
  td:last-child { text-align: right; font-weight: 600; font-family: monospace; }
  .total { font-size: 20px; text-align: center; margin: 16px 0; font-weight: 700; font-family: monospace; }
  .footer { text-align: center; font-size: 11px; color: #54677f; margin-top: 20px; }
  @media print { button { display: none; } }
</style></head><body>
<h2>Payment Receipt</h2>
<p class="sub">${esc(p.receiptNo)}</p>
<p class="total">${formatNaira(p.amount)}</p>
<table>
  <tr><td>Student</td><td>${esc(account.student.firstName)} ${esc(account.student.lastName)}</td></tr>
  <tr><td>Class</td><td>${esc(account.className)}</td></tr>
  <tr><td>Date</td><td>${esc(formatDate(p.paidOn))}</td></tr>
  <tr><td>Method</td><td>${esc(methodLabel(p.method))}</td></tr>
  <tr><td>Recorded by</td><td>${esc(p.recordedByName)}</td></tr>
  ${p.note ? `<tr><td>Note</td><td>${esc(p.note)}</td></tr>` : ""}
</table>
<p class="footer">Generated by Bursar</p>
<div style="text-align:center;margin-top:12px"><button onclick="window.print()" style="padding:8px 24px;font-size:14px;cursor:pointer;border:1px solid #1b2a3c;border-radius:6px;background:white">Print</button></div>
</body></html>`);
  w.document.close();
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
