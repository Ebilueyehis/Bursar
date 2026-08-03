"use client";

import { useState } from "react";
import Link from "next/link";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { useOnline } from "@/lib/useOnline";
import { repository } from "@/lib/data/repository";
import type { CreateExpenseInput } from "@/lib/data/repository";
import {
  EXPENSE_CADENCES,
  EXPENSE_CATEGORIES,
  PAY_METHODS,
  can,
} from "@/lib/domain/constants";
import { parseNairaToKobo } from "@/lib/money";
import type { Expense, ExpenseCadence, PaymentMethod } from "@/lib/domain/types";
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
  PageHeader,
  Select,
  StatusPill,
  TextArea,
} from "@/components/ui";
import { ExpenseIcon, PlusIcon, StaffIcon } from "@/components/icons";
import { formatDay } from "@/lib/dates";

const cadenceLabel = (c: ExpenseCadence) =>
  EXPENSE_CADENCES.find((x) => x.value === c)?.label ?? c;

export default function ExpensesPage() {
  const { role } = useViewer();
  const { data, loading, reload } = useAsync(() => repository.listExpenses(), []);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  if (!can(role, "manage_expenses")) {
    return (
      <EmptyState
        title="Expenses are for the Proprietor and Bursar"
        description="Ask an administrator if you need access to the school's spending."
      />
    );
  }

  const expenses = data ?? [];
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Every naira the school spends on vendors, bills, and salaries."
        action={
          <Button onClick={() => { setEditing(null); setShowForm(true); }}>
            <PlusIcon width={18} height={18} /> Add expense
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/staff" className="contents">
          <Button variant="ghost"><StaffIcon width={16} height={16} /> Staff & payroll</Button>
        </Link>
        <Link href="/ledger" className="contents">
          <Button variant="ghost">View daily ledger</Button>
        </Link>
      </div>

      {(showForm || editing) && (
        <ExpenseForm
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); reload(); }}
        />
      )}

      {loading && !data ? (
        <LoadingBlock label="Loading expenses…" />
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={<ExpenseIcon width={28} height={28} />}
          title="No expenses recorded yet"
          description="Add your first expense: rent, utilities, supplies, or a salary payment."
        />
      ) : (
        <>
          <Card className="mb-3 flex items-center justify-between bg-surface-sunken">
            <span className="text-sm text-ink-muted">
              {expenses.length} {expenses.length === 1 ? "expense" : "expenses"}
            </span>
            <span className="text-sm text-ink-muted">
              Total <Money kobo={total} tone="danger" />
            </span>
          </Card>
          <ul className="space-y-2.5">
            {expenses.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => { setShowForm(false); setEditing(e); }}
                  className="flex w-full items-start gap-3 rounded-lg border border-border bg-surface p-3.5 text-left transition hover:bg-surface-sunken"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{e.payee}</p>
                    <p className="truncate text-xs text-ink-muted">{e.description}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <StatusPill tone="neutral">{e.category}</StatusPill>
                      {e.cadence !== "one_off" && (
                        <StatusPill tone="neutral">{cadenceLabel(e.cadence)}</StatusPill>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <Money kobo={e.amount} tone="danger" className="text-sm" />
                    <p className="mt-0.5 text-xs text-ink-faint">{formatDay(e.spentOn)}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// --- Add / edit form ---------------------------------------------------------

function ExpenseForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Expense | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { actorName } = useViewer();
  const online = useOnline();
  const today = new Date().toISOString().slice(0, 10);

  const [payee, setPayee] = useState(initial?.payee ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? EXPENSE_CATEGORIES[0]);
  const [cadence, setCadence] = useState<ExpenseCadence>(initial?.cadence ?? "one_off");
  const [amountText, setAmountText] = useState(initial ? String(initial.amount / 100) : "");
  const [spentOn, setSpentOn] = useState(initial?.spentOn ?? today);
  const [method, setMethod] = useState<PaymentMethod>(initial?.method ?? "cash");
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setError(null);
    if (!online) {
      setError("You're offline. Expenses are saved only when connected, so nothing is ever lost. Reconnect and try again.");
      return;
    }
    const amountKobo = parseNairaToKobo(amountText);
    if (!payee.trim() || !description.trim()) {
      setError("Add who was paid and what it was for.");
      return;
    }
    if (amountKobo === null || amountKobo <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    const input: CreateExpenseInput = {
      payee: payee.trim(),
      description: description.trim(),
      category: category.trim() || "Miscellaneous",
      cadence,
      amountKobo,
      spentOn,
      method,
      note: note.trim() || undefined,
      recordedByName: actorName,
    };
    setSaving(true);
    try {
      if (initial) await repository.updateExpense(initial.id, input);
      else await repository.createExpense(input);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "This expense couldn't be saved. No money was affected. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!initial) return;
    setSaving(true);
    setError(null);
    try {
      await repository.deleteExpense(initial.id);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "This expense couldn't be deleted.");
      setSaving(false);
    }
  }

  return (
    <Card className="mb-4 space-y-3.5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink">{initial ? "Edit expense" : "Add expense"}</h2>
        <button onClick={onClose} className="text-sm font-semibold text-primary">Close</button>
      </div>

      {error && <Banner tone="error">{error}</Banner>}

      <Field label="Paid to" hint="Vendor, supplier, or staff name">
        <Input value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="e.g. PHCN, Dangote Cement, Mrs. Bello" />
      </Field>
      <Field label="What was it for">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. June electricity bill" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="How often" hint="Rent is yearly; salaries monthly">
          <Select value={cadence} onChange={(e) => setCadence(e.target.value as ExpenseCadence)}>
            {EXPENSE_CADENCES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount">
          <NairaInput value={amountText} onValueChange={setAmountText} placeholder="e.g. 25,000" />
        </Field>
        <Field label="Date of spend">
          <Input type="date" value={spentOn} max={today} onChange={(e) => setSpentOn(e.target.value)} />
        </Field>
      </div>

      <Field label="Paid by">
        <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
          {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </Select>
      </Field>

      <Field label="Note (optional)">
        <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything worth remembering" />
      </Field>

      <div className="flex gap-3">
        <Button onClick={save} disabled={saving || !online} className="flex-1">
          {saving ? "Saving…" : initial ? "Save changes" : "Add expense"}
        </Button>
        {initial && (
          <Button variant="danger" onClick={remove} disabled={saving}>Delete</Button>
        )}
      </div>
    </Card>
  );
}
