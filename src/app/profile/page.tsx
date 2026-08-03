"use client";

import { useMemo, useRef, useState } from "react";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { useOnline } from "@/lib/useOnline";
import { repository } from "@/lib/data/repository";
import type { CreateStaffInput } from "@/lib/data/repository";
import { ROLE_LABELS, can, termLabel } from "@/lib/domain/constants";
import { classRank } from "@/lib/classes";
import { exportToXlsx, readSheetRows } from "@/lib/export";
import { formatNaira, parseNairaToKobo } from "@/lib/money";
import type { FeeItem, Staff, StaffType } from "@/lib/domain/types";
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  Money,
  Select,
  StatusPill,
  cn,
} from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  ChevronRightIcon,
  PlusIcon,
  StaffIcon,
  UploadIcon,
} from "@/components/icons";

/** Subjects a secondary teacher might take. Seed list, free to grow. */
const SUBJECTS = [
  "Mathematics",
  "English Language",
  "Basic Science",
  "Social Studies",
  "Civic Education",
  "Agricultural Science",
  "Business Studies",
  "Computer Studies",
  "Christian Religious Studies",
  "Islamic Religious Studies",
  "Yoruba",
  "Igbo",
  "Hausa",
  "Fine Arts",
  "Physical & Health Education",
];

type PanelId = "account" | "staff" | "fees" | "roles" | "appearance";

const PANELS: { id: PanelId; label: string }[] = [
  { id: "account", label: "Account Information" },
  { id: "staff", label: "Staff & Payroll" },
  { id: "fees", label: "Fees & Discount" },
  { id: "roles", label: "User Roles" },
  { id: "appearance", label: "Appearance" },
];

export default function ProfilePage() {
  const [panel, setPanel] = useState<PanelId>("account");

  return (
    <div className="grid gap-5 md:grid-cols-[240px_1fr]">
      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1.5 md:flex-col md:gap-0.5 md:self-start">
        {PANELS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPanel(p.id)}
            className={cn(
              "flex shrink-0 items-center justify-between gap-2 rounded-lg px-3.5 py-2.5 text-left text-sm font-semibold transition md:w-full",
              panel === p.id
                ? "bg-primary-tint text-primary"
                : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
            )}
          >
            {p.label}
            <ChevronRightIcon
              width={16}
              height={16}
              className={cn("hidden md:block", panel === p.id ? "opacity-100" : "opacity-30")}
            />
          </button>
        ))}
      </nav>

      <div className="min-w-0">
        {panel === "account" && <AccountPanel />}
        {panel === "staff" && <StaffPanel />}
        {panel === "fees" && <FeesPanel />}
        {panel === "roles" && <RolesPanel />}
        {panel === "appearance" && <AppearancePanel />}
      </div>
    </div>
  );
}

function PanelShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// --- Account Information ------------------------------------------------------

function AccountPanel() {
  const { school, session, actorName, role, term } = useViewer();
  const rows: { k: string; v: string }[] = [
    { k: "Your name", v: actorName || "-" },
    { k: "Your role", v: ROLE_LABELS[role] },
    { k: "School", v: school?.name ?? "-" },
    { k: "School code", v: school?.code ?? "-" },
    { k: "Session", v: session?.name ?? "-" },
    { k: "Current term", v: termLabel(term) },
    { k: "School phone", v: school?.phone ?? "Not set" },
    { k: "Address", v: school?.address ?? "Not set" },
  ];
  return (
    <PanelShell
      title="Account Information"
      subtitle="Your details and the school on record."
    >
      <Card className="p-0">
        <dl className="divide-y divide-border">
          {rows.map((r) => (
            <div key={r.k} className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-sm text-ink-faint">{r.k}</dt>
              <dd className="text-right text-sm font-semibold text-ink">{r.v}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </PanelShell>
  );
}

// --- Staff & Payroll ---------------------------------------------------------

function StaffPanel() {
  const { role } = useViewer();
  const { data, loading, reload } = useAsync(() => repository.listStaff(), []);

  if (!can(role, "manage_staff")) {
    return (
      <PanelShell title="Staff & Payroll">
        <EmptyState
          title="Staff records are for the Proprietor and Bursar"
          description="Ask an administrator if you need access to payroll."
        />
      </PanelShell>
    );
  }

  const staff = data ?? [];
  const active = staff.filter((s) => s.active);
  const monthlyWage = active.reduce((s, x) => s + x.monthlySalary, 0);

  function onExport() {
    exportToXlsx(
      "Staff",
      ["Full name", "Title", "Type", "Assignment", "Monthly salary", "Phone", "Status"],
      staff.map((s) => [
        s.fullName,
        s.title ?? "",
        s.employmentType === "teaching" ? "Teaching" : "Non-teaching",
        s.assignment ?? "",
        s.monthlySalary / 100,
        s.phone ?? "",
        s.active ? "Active" : "Retired",
      ]),
    );
  }

  return (
    <PanelShell
      title="Staff & Payroll"
      subtitle="Add your team all at once with a template, or one at a time by hand."
      action={
        <Button variant="ghost" onClick={onExport} disabled={staff.length === 0}>
          Export
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <BulkStaffCard onImported={reload} />
        <ManualStaffCard onAdded={reload} />
      </div>

      {loading && !data ? (
        <LoadingBlock label="Loading staff…" />
      ) : staff.length === 0 ? (
        <EmptyState
          icon={<StaffIcon width={28} height={28} />}
          title="No staff yet"
          description="Add teaching and non-teaching staff so you can run payroll each month."
        />
      ) : (
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm text-ink-muted">
            <span>
              {active.length} active {active.length === 1 ? "member" : "members"}
            </span>
            <span>
              Monthly wage bill <Money kobo={monthlyWage} />
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-border-strong">
                  <Th>Staff</Th>
                  <Th>Assignment</Th>
                  <Th>Type</Th>
                  <Th>Monthly salary</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <Td className="font-semibold">{s.fullName}</Td>
                    <Td className="text-ink-muted">
                      {s.assignment || (s.employmentType === "teaching" ? "Teaching" : "-")}
                    </Td>
                    <Td>{s.employmentType === "teaching" ? "Teaching" : "Non-teaching"}</Td>
                    <td className="px-4 py-2.5">
                      <Money kobo={s.monthlySalary} className="text-sm" />
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill tone={s.active ? "paid" : "neutral"}>
                        {s.active ? "Active" : "Retired"}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </PanelShell>
  );
}

function BulkStaffCard({ onImported }: { onImported: () => void }) {
  const online = useOnline();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function downloadTemplate() {
    exportToXlsx(
      "Staff template",
      ["Full name", "Type", "Assignment", "Monthly salary", "Phone"],
      [["Mrs Adaeze Bello", "teaching", "Mathematics", 120000, "0803 000 0000"]],
    );
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    if (!online) {
      setError("You're offline. Reconnect to import staff.");
      return;
    }
    setBusy(true);
    try {
      const rows = await readSheetRows(file);
      let added = 0;
      for (const row of rows) {
        const name = (row["Full name"] ?? row["Name"] ?? "").trim();
        if (!name) continue;
        const type: StaffType =
          (row["Type"] ?? "").toLowerCase().startsWith("non") ? "non_teaching" : "teaching";
        const input: CreateStaffInput = {
          fullName: name,
          employmentType: type,
          assignment: (row["Assignment"] ?? row["Subject"] ?? "").trim() || undefined,
          monthlySalaryKobo: parseNairaToKobo(row["Monthly salary"] ?? row["Salary"] ?? "") ?? 0,
          phone: (row["Phone"] ?? "").trim() || undefined,
        };
        await repository.createStaff(input);
        added += 1;
      }
      setResult(`${added} ${added === 1 ? "member" : "members"} imported.`);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file. Use the template layout.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Card className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
        Bulk upload
      </p>
      <p className="text-sm text-ink-muted">
        Download the template, fill in each staff member&apos;s details and salary,
        then upload it back.
      </p>
      <Button variant="ghost" onClick={downloadTemplate} className="w-full">
        Download template
      </Button>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface-sunken px-4 py-6 text-center transition hover:border-primary"
      >
        <UploadIcon width={26} height={26} className="text-ink-faint" />
        <span className="text-sm font-semibold text-ink">
          {busy ? "Importing…" : "Upload filled template"}
        </span>
        <span className="text-xs text-ink-faint">.xlsx or .csv</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.csv"
        hidden
        onChange={onFile}
      />
      {result && <Banner tone="success">{result}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}
    </Card>
  );
}

function ManualStaffCard({ onAdded }: { onAdded: () => void }) {
  const online = useOnline();
  const [fullName, setFullName] = useState("");
  const [type, setType] = useState<StaffType>("teaching");
  const [subject, setSubject] = useState("");
  const [salaryText, setSalaryText] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    const input: CreateStaffInput = {
      fullName: fullName.trim(),
      employmentType: type,
      assignment: type === "teaching" ? subject.trim() || undefined : undefined,
      monthlySalaryKobo: parseNairaToKobo(salaryText) ?? 0,
      phone: phone.trim() || undefined,
    };
    setSaving(true);
    try {
      await repository.createStaff(input);
      setFullName("");
      setSubject("");
      setSalaryText("");
      setPhone("");
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save this staff member.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
        Add one manually
      </p>
      {error && <Banner tone="error">{error}</Banner>}
      <Field label="Staff name">
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Mrs Adaeze Bello" />
      </Field>
      <Field label="Type">
        <Select value={type} onChange={(e) => setType(e.target.value as StaffType)}>
          <option value="teaching">Teaching</option>
          <option value="non_teaching">Non-teaching</option>
        </Select>
      </Field>
      {type === "teaching" && (
        <Field label="Subject taught">
          <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">Select a subject</option>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Monthly salary">
        <NairaField value={salaryText} onChange={setSalaryText} />
      </Field>
      <Field label="Phone (optional)">
        <Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803…" />
      </Field>
      <Button onClick={save} disabled={saving || !online} className="w-full">
        <PlusIcon width={18} height={18} />
        {saving ? "Adding…" : "Add staff member"}
      </Button>
    </Card>
  );
}

// --- Fees & Discount ---------------------------------------------------------

function FeesPanel() {
  const { role, term } = useViewer();
  const { data, loading } = useAsync(() => repository.listFeeItems(term), [term]);

  const items = useMemo(() => data ?? [], [data]);
  const byLevel = useMemo(() => {
    const map = new Map<string, FeeItem[]>();
    for (const it of items) {
      const list = map.get(it.level) ?? [];
      list.push(it);
      map.set(it.level, list);
    }
    return Array.from(map.entries()).sort(
      (a, b) => classRank(a[0]) - classRank(b[0]),
    );
  }, [items]);

  if (!can(role, "edit_fees")) {
    return (
      <PanelShell title="Fees & Discount">
        <EmptyState
          title="Fees are set by the Proprietor and Bursar"
          description="Ask an administrator to adjust the fee structure."
        />
      </PanelShell>
    );
  }

  function onExport() {
    exportToXlsx(
      "Fees",
      ["Class level", "Item", "Amount", "Optional"],
      items
        .slice()
        .sort((a, b) => classRank(a.level) - classRank(b.level))
        .map((it) => [it.level, it.name, it.amount / 100, it.optional ? "Yes" : "No"]),
    );
  }

  return (
    <PanelShell
      title="Fees & Discount"
      subtitle={`Fee structure for ${termLabel(term)}.`}
      action={
        <Button variant="ghost" onClick={onExport} disabled={items.length === 0}>
          Export
        </Button>
      }
    >
      {loading && !data ? (
        <LoadingBlock label="Loading fees…" />
      ) : byLevel.length === 0 ? (
        <EmptyState
          title="No fees set for this term"
          description="Set each class level's fee items so student bills generate automatically."
        />
      ) : (
        <div className="space-y-4">
          {byLevel.map(([level, list]) => {
            const total = list.reduce((s, it) => s + it.amount, 0);
            return (
              <Card key={level} className="p-0">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <p className="font-semibold text-ink">{level}</p>
                  <Money kobo={total} />
                </div>
                <ul>
                  {list.map((it) => (
                    <li
                      key={it.id}
                      className="flex items-center justify-between px-4 py-2.5 text-sm"
                    >
                      <span className="text-ink-muted">
                        {it.name}
                        {it.optional && (
                          <span className="ml-2 text-xs text-ink-faint">(optional)</span>
                        )}
                      </span>
                      <Money kobo={it.amount} tone="ink" className="text-sm" />
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </PanelShell>
  );
}

// --- User Roles --------------------------------------------------------------

function RolesPanel() {
  const { role } = useViewer();
  const { data, loading } = useAsync(() => repository.listUsers(), []);

  if (role !== "proprietor") {
    return (
      <PanelShell title="User Roles">
        <EmptyState
          title="Only the proprietor manages roles"
          description="Roles decide what each team member can see and do."
        />
      </PanelShell>
    );
  }

  const users = data ?? [];

  return (
    <PanelShell
      title="User Roles"
      subtitle="Decide what each team member can see and do."
    >
      {loading && !data ? (
        <LoadingBlock label="Loading team…" />
      ) : users.length === 0 ? (
        <EmptyState title="No team members yet" description="Invited members appear here." />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-border-strong">
                  <Th>Member</Th>
                  <Th>Email</Th>
                  <Th>Role</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <Td className="font-semibold">{u.fullName}</Td>
                    <Td className="text-ink-muted">{u.email ?? "-"}</Td>
                    <td className="px-4 py-2.5">
                      <StatusPill tone="neutral">{ROLE_LABELS[u.role]}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <p className="text-xs text-ink-faint">
        Role changes are made from the team member&apos;s invite. This list shows
        who currently holds which role.
      </p>
    </PanelShell>
  );
}

// --- Appearance --------------------------------------------------------------

function AppearancePanel() {
  return (
    <PanelShell
      title="Appearance"
      subtitle="Choose how Bursar looks on this device."
    >
      <Card>
        <ThemeToggle />
      </Card>
    </PanelShell>
  );
}

// --- Small helpers -----------------------------------------------------------

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-xs font-bold text-ink-faint">{children}</th>;
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("px-4 py-2.5 text-sm text-ink", className)}>{children}</td>
  );
}

function NairaField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center rounded-lg border border-border bg-surface-raised focus-within:border-primary focus-within:ring-2 focus-within:ring-primary-tint">
      <span className="pl-3 text-ink-faint">₦</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.00"
        className="w-full bg-transparent px-2 py-2.5 text-ink outline-none"
      />
    </div>
  );
}
