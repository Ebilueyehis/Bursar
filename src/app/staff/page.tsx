"use client";

import { useState } from "react";
import Link from "next/link";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { useOnline } from "@/lib/useOnline";
import { repository } from "@/lib/data/repository";
import type { CreateStaffInput } from "@/lib/data/repository";
import { can } from "@/lib/domain/constants";
import { parseNairaToKobo } from "@/lib/money";
import type { Staff, StaffType } from "@/lib/domain/types";
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
} from "@/components/ui";
import { PlusIcon, StaffIcon } from "@/components/icons";

export default function StaffPage() {
  const { role } = useViewer();
  const { data, loading, reload } = useAsync(() => repository.listStaff(), []);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);

  if (!can(role, "manage_staff")) {
    return (
      <EmptyState
        title="Staff records are for the Proprietor and Bursar"
        description="Ask an administrator if you need access to payroll."
      />
    );
  }

  const staff = data ?? [];
  const active = staff.filter((s) => s.active);
  const retired = staff.filter((s) => !s.active);
  const monthlyWage = active.reduce((s, x) => s + x.monthlySalary, 0);

  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle="Your salary register: who you pay, and how much each month."
        action={
          <Button onClick={() => { setEditing(null); setShowForm(true); }}>
            <PlusIcon width={18} height={18} /> Add staff
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/payroll" className="contents">
          <Button variant="ghost">Run monthly payroll</Button>
        </Link>
        <Link href="/expenses" className="contents">
          <Button variant="ghost">All expenses</Button>
        </Link>
      </div>

      {(showForm || editing) && (
        <StaffForm
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); reload(); }}
        />
      )}

      {loading && !data ? (
        <LoadingBlock label="Loading staff…" />
      ) : staff.length === 0 ? (
        <EmptyState
          icon={<StaffIcon width={28} height={28} />}
          title="No staff yet"
          description="Add teaching and non-teaching staff so you can run payroll each month."
        />
      ) : (
        <>
          <Card className="mb-3 flex items-center justify-between bg-surface-sunken">
            <span className="text-sm text-ink-muted">
              {active.length} active {active.length === 1 ? "member" : "members"}
            </span>
            <span className="text-sm text-ink-muted">
              Monthly wage bill <Money kobo={monthlyWage} />
            </span>
          </Card>

          <ul className="space-y-2.5">
            {active.map((s) => (
              <StaffRow key={s.id} staff={s} onEdit={() => { setShowForm(false); setEditing(s); }} />
            ))}
          </ul>

          {retired.length > 0 && (
            <>
              <p className="mb-2 mt-6 font-mono text-xs uppercase tracking-wide text-ink-faint">
                Retired
              </p>
              <ul className="space-y-2.5 opacity-70">
                {retired.map((s) => (
                  <StaffRow key={s.id} staff={s} onEdit={() => { setShowForm(false); setEditing(s); }} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

function StaffRow({ staff, onEdit }: { staff: Staff; onEdit: () => void }) {
  return (
    <li>
      <button
        onClick={onEdit}
        className="flex w-full items-start gap-3 rounded-lg border border-border bg-surface p-3.5 text-left transition hover:bg-surface-sunken"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{staff.fullName}</p>
          <p className="truncate text-xs text-ink-muted">
            {staff.title ? `${staff.title} · ` : ""}
            {staff.assignment || (staff.employmentType === "teaching" ? "Teaching" : "Non-teaching")}
          </p>
          <div className="mt-1.5">
            <StatusPill tone="neutral">
              {staff.employmentType === "teaching" ? "Teaching" : "Non-teaching"}
            </StatusPill>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <Money kobo={staff.monthlySalary} className="text-sm" />
          <p className="mt-0.5 text-xs text-ink-faint">/ month</p>
        </div>
      </button>
    </li>
  );
}

// --- Add / edit form ---------------------------------------------------------

function StaffForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Staff | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const online = useOnline();
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [employmentType, setEmploymentType] = useState<StaffType>(initial?.employmentType ?? "teaching");
  const [assignment, setAssignment] = useState(initial?.assignment ?? "");
  const [salaryText, setSalaryText] = useState(initial ? String(initial.monthlySalary / 100) : "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const teaching = employmentType === "teaching";

  async function save() {
    setError(null);
    if (!online) {
      setError("You're offline. Reconnect to save staff records.");
      return;
    }
    if (!fullName.trim()) {
      setError("Enter the staff member's name.");
      return;
    }
    const salaryKobo = parseNairaToKobo(salaryText) ?? 0;
    const input: CreateStaffInput = {
      fullName: fullName.trim(),
      title: title.trim() || undefined,
      employmentType,
      assignment: assignment.trim() || undefined,
      monthlySalaryKobo: salaryKobo,
      phone: phone.trim() || undefined,
    };
    setSaving(true);
    try {
      if (initial) await repository.updateStaff(initial.id, input);
      else await repository.createStaff(input);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save this staff member.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!initial) return;
    setSaving(true);
    setError(null);
    try {
      await repository.setStaffActive(initial.id, !initial.active);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update this staff member.");
      setSaving(false);
    }
  }

  return (
    <Card className="mb-4 space-y-3.5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink">{initial ? "Edit staff" : "Add staff"}</h2>
        <button onClick={onClose} className="text-sm font-semibold text-primary">Close</button>
      </div>

      {error && <Banner tone="error">{error}</Banner>}

      <Field label="Full name">
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Mr. Emeka Okafor" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Title (optional)">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Class Teacher" />
        </Field>
        <Field label="Type">
          <Select value={employmentType} onChange={(e) => setEmploymentType(e.target.value as StaffType)}>
            <option value="teaching">Teaching</option>
            <option value="non_teaching">Non-teaching</option>
          </Select>
        </Field>
      </div>

      {teaching && (
        <Field
          label="Class or subjects"
          hint="Class for a primary teacher, subjects for a secondary teacher."
        >
          <Input value={assignment} onChange={(e) => setAssignment(e.target.value)} placeholder="e.g. Primary 3  ·  or  ·  Maths, Physics" />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Monthly salary">
          <NairaInput value={salaryText} onValueChange={setSalaryText} placeholder="e.g. 80,000" />
        </Field>
        <Field label="Phone (optional)">
          <Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803…" />
        </Field>
      </div>

      <div className="flex gap-3">
        <Button onClick={save} disabled={saving || !online} className="flex-1">
          {saving ? "Saving…" : initial ? "Save changes" : "Add staff"}
        </Button>
        {initial && (
          <Button variant="secondary" onClick={toggleActive} disabled={saving}>
            {initial.active ? "Retire" : "Reactivate"}
          </Button>
        )}
      </div>
    </Card>
  );
}
