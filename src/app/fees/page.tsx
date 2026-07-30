"use client";

import { useMemo, useState } from "react";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { useOnline } from "@/lib/useOnline";
import { repository } from "@/lib/data/repository";
import type { FeeLineInput } from "@/lib/data/repository";
import { DEFAULT_FEE_TYPES, can, termLabel } from "@/lib/domain/constants";
import { parseNairaToKobo } from "@/lib/money";
import type { FeeItem } from "@/lib/domain/types";
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
} from "@/components/ui";
import { PlusIcon } from "@/components/icons";

export default function FeesPage() {
  const { role, term } = useViewer();
  const { data: classes } = useAsync(() => repository.listClasses(), []);
  const { data: feeItems, loading, reload } = useAsync(
    () => repository.listFeeItems(term),
    [term],
  );

  const levels = useMemo(() => {
    const set = new Set<string>();
    (classes ?? []).forEach((c) => set.add(c.level));
    return [...set];
  }, [classes]);

  if (!can(role, "edit_fees")) {
    return (
      <EmptyState
        title="Fees are set by the Proprietor and Bursar"
        description="Ask an administrator to set up the fee structure."
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Fees"
        subtitle={`Set what each class level is charged for ${termLabel(term)}. New students are billed from this automatically.`}
      />

      {loading && !feeItems ? (
        <LoadingBlock label="Loading fee structure…" />
      ) : levels.length === 0 ? (
        <EmptyState
          title="No class levels yet"
          description="Add classes first, then set their fees here."
        />
      ) : (
        <div className="space-y-3">
          {levels.map((level) => (
            <LevelCard
              key={level}
              level={level}
              term={term}
              items={(feeItems ?? []).filter((f) => f.level === level)}
              onSaved={reload}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LevelCard({
  level,
  term,
  items,
  onSaved,
}: {
  level: string;
  term: ReturnType<typeof useViewer>["term"];
  items: FeeItem[];
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const total = items.reduce((s, f) => s + f.amount, 0);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-ink">{level}</p>
          <p className="text-xs text-ink-muted">
            {items.length === 0
              ? "No fees set"
              : `${items.length} ${items.length === 1 ? "item" : "items"} · `}
            {items.length > 0 && <Money kobo={total} className="text-xs" />}
          </p>
        </div>
        {!editing && (
          <Button variant="ghost" onClick={() => setEditing(true)}>
            {items.length === 0 ? "Set fees" : "Edit"}
          </Button>
        )}
      </div>

      {!editing && items.length > 0 && (
        <ul className="mt-3 border-t border-border pt-2">
          {items.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between py-1.5 text-sm"
            >
              <span className="text-ink-muted">
                {f.name}
                {f.optional && (
                  <span className="ml-1.5 text-xs text-ink-faint">(optional)</span>
                )}
              </span>
              <Money kobo={f.amount} tone="ink" className="font-medium" />
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <LevelEditor
          level={level}
          term={term}
          items={items}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); onSaved(); }}
        />
      )}
    </Card>
  );
}

interface Row {
  name: string;
  amountText: string;
  optional: boolean;
}

function LevelEditor({
  level,
  term,
  items,
  onClose,
  onSaved,
}: {
  level: string;
  term: ReturnType<typeof useViewer>["term"];
  items: FeeItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const online = useOnline();
  const seed: Row[] =
    items.length > 0
      ? items.map((f) => ({
          name: f.name,
          amountText: String(f.amount / 100),
          optional: f.optional ?? false,
        }))
      : DEFAULT_FEE_TYPES.slice(0, 3).map((n) => ({
          name: n,
          amountText: "",
          optional: false,
        }));

  const [rows, setRows] = useState<Row[]>(seed);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const addRow = () =>
    setRows((r) => [...r, { name: "", amountText: "", optional: false }]);
  const removeRow = (i: number) =>
    setRows((r) => r.filter((_, idx) => idx !== i));

  const total = rows.reduce(
    (s, r) => s + (parseNairaToKobo(r.amountText) ?? 0),
    0,
  );

  async function save() {
    setError(null);
    if (!online) {
      setError("You're offline. Reconnect to save fees.");
      return;
    }
    const items: FeeLineInput[] = [];
    for (const r of rows) {
      if (!r.name.trim()) continue;
      const kobo = parseNairaToKobo(r.amountText);
      if (kobo === null) {
        setError(`Enter a valid amount for "${r.name.trim()}".`);
        return;
      }
      items.push({ name: r.name.trim(), amountKobo: kobo, optional: r.optional });
    }
    setSaving(true);
    try {
      await repository.saveFeeStructure(level, term, items);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the fees.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      {error && <Banner tone="error">{error}</Banner>}

      {rows.map((row, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="flex-1">
            <Field label={i === 0 ? "Item" : ""}>
              <Input
                value={row.name}
                onChange={(e) => setRow(i, { name: e.target.value })}
                placeholder="e.g. Tuition"
              />
            </Field>
          </div>
          <div className="w-32">
            <Field label={i === 0 ? "Amount" : ""}>
              <Input
                inputMode="decimal"
                value={row.amountText}
                onChange={(e) => setRow(i, { amountText: e.target.value })}
                placeholder="45,000"
              />
            </Field>
          </div>
          <button
            onClick={() => removeRow(i)}
            className="mb-1.5 flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-faint hover:text-danger"
            aria-label="Remove item"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        onClick={addRow}
        className="flex items-center gap-1.5 text-sm font-semibold text-primary"
      >
        <PlusIcon width={16} height={16} /> Add item
      </button>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm text-ink-muted">Total per student</span>
        <Money kobo={total} className="text-base" />
      </div>

      <div className="flex gap-3">
        <Button onClick={save} disabled={saving || !online} className="flex-1">
          {saving ? "Saving…" : "Save fees"}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
