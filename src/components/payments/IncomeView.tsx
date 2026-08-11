"use client";

import { useState } from "react";
import Link from "next/link";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { useOnline } from "@/lib/useOnline";
import { repository } from "@/lib/data/repository";
import type { CreateIncomeInput, IncomeRow } from "@/lib/data/repository";
import { INCOME_SOURCES, PAY_METHODS } from "@/lib/domain/constants";
import { parseNairaToKobo } from "@/lib/money";
import type { PaymentMethod } from "@/lib/domain/types";
import {
  Banner, Button, Card, EmptyState, Field, Input, LoadingBlock, Money,
  NairaInput, PageHeader, Select, StatusPill, TextArea,
} from "@/components/ui";
import { PlusIcon } from "@/components/icons";
import { formatDay } from "@/lib/dates";

export function IncomeView() {
  const { data, loading, reload } = useAsync(() => repository.listIncomeView(), []);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const rows = data ?? [];
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div>
      <PageHeader
        title="Income"
        subtitle="Every naira the school takes in: fees and other income."
        action={
          <Button onClick={() => { setEditingId(null); setShowForm(true); }}>
            <PlusIcon width={18} height={18} /> Log income
          </Button>
        }
      />

      {(showForm || editingId) && (
        <IncomeForm
          editingId={editingId}
          onClose={() => { setShowForm(false); setEditingId(null); }}
          onSaved={() => { setShowForm(false); setEditingId(null); reload(); }}
        />
      )}

      {loading && !data ? (
        <LoadingBlock label="Loading income…" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No income recorded yet"
          description="Fee payments show here automatically. Use Log income for donations, grants, or sales."
        />
      ) : (
        <>
          <Card className="mb-3 flex items-center justify-between bg-surface-sunken">
            <span className="text-sm text-ink-muted">
              {rows.length} {rows.length === 1 ? "entry" : "entries"}
            </span>
            <span className="text-sm text-ink-muted">
              Total in <Money kobo={total} tone="success" />
            </span>
          </Card>
          <ul className="space-y-2.5">
            {rows.map((r) => (
              <li key={`${r.kind}-${r.id}`}>
                {r.kind === "fee" ? (
                  <Link
                    href={`/students/${r.studentId}`}
                    className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3.5 transition hover:bg-surface-sunken"
                  >
                    <IncomeRowBody r={r} />
                  </Link>
                ) : (
                  <button
                    onClick={() => { setShowForm(false); setEditingId(r.id); }}
                    className="flex w-full items-start gap-3 rounded-lg border border-border bg-surface p-3.5 text-left transition hover:bg-surface-sunken"
                  >
                    <IncomeRowBody r={r} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function IncomeRowBody({ r }: { r: IncomeRow }) {
  return (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">{r.description}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <StatusPill tone={r.kind === "fee" ? "paid" : "neutral"}>
            {r.kind === "fee" ? "School fee" : r.source}
          </StatusPill>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <Money kobo={r.amount} tone="success" className="text-sm" />
        <p className="mt-0.5 text-xs text-ink-faint">{formatDay(r.date)}</p>
      </div>
    </>
  );
}

function IncomeForm({
  editingId,
  onClose,
  onSaved,
}: {
  editingId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { actorName } = useViewer();
  const online = useOnline();
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = useAsync(
    async () => (editingId ? (await repository.listIncome()).find((i) => i.id === editingId) ?? null : null),
    [editingId],
  );

  const [source, setSource] = useState(INCOME_SOURCES[0]);
  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [receivedOn, setReceivedOn] = useState(today);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!seeded && existing) {
    setSeeded(true);
    setSource(existing.source);
    setDescription(existing.description);
    setAmountText(String(existing.amount / 100));
    setReceivedOn(existing.receivedOn);
    setMethod(existing.method);
    setNote(existing.note ?? "");
  }

  async function save() {
    setError(null);
    if (!online) return setError("You're offline. Income is saved only when connected. Reconnect and try again.");
    const amountKobo = parseNairaToKobo(amountText);
    if (!description.trim()) return setError("Add a short description.");
    if (amountKobo === null || amountKobo <= 0) return setError("Enter an amount greater than zero.");
    const input: CreateIncomeInput = {
      source: source.trim() || "Other",
      description: description.trim(),
      amountKobo,
      receivedOn,
      method,
      note: note.trim() || undefined,
      recordedByName: actorName,
    };
    setSaving(true);
    try {
      if (editingId) await repository.updateIncome(editingId, input);
      else await repository.createIncome(input);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "This income couldn't be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      await repository.deleteIncome(editingId);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "This income couldn't be deleted.");
      setSaving(false);
    }
  }

  return (
    <Card className="mb-4 space-y-3.5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink">{editingId ? "Edit income" : "Log income"}</h2>
        <button onClick={onClose} className="text-sm font-semibold text-primary">Close</button>
      </div>
      {error && <Banner tone="error">{error}</Banner>}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Source">
          <Select value={source} onChange={(e) => setSource(e.target.value)}>
            {INCOME_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Date received">
          <Input type="date" value={receivedOn} max={today} onChange={(e) => setReceivedOn(e.target.value)} />
        </Field>
      </div>

      <Field label="Description">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. PTA fundraiser proceeds" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount">
          <NairaInput value={amountText} onValueChange={setAmountText} placeholder="e.g. 50,000" />
        </Field>
        <Field label="Received by">
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
        </Field>
      </div>

      <Field label="Note (optional)">
        <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything worth remembering" />
      </Field>

      <div className="flex gap-3">
        <Button onClick={save} disabled={saving || !online} className="flex-1">
          {saving ? "Saving…" : editingId ? "Save changes" : "Log income"}
        </Button>
        {editingId && <Button variant="danger" onClick={remove} disabled={saving}>Delete</Button>}
      </div>
    </Card>
  );
}
