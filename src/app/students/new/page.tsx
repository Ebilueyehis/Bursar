"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { Button, Field, Input, Select, LoadingBlock, Banner, cn } from "@/components/ui";
import { BillPicker, draftFromItems } from "@/components/BillPicker";
import {
  type BillDraft,
  checkedLines,
  validateBillDraft,
} from "@/lib/fees/billMath";
import { ArrowLeftIcon } from "@/components/icons";

const EMPTY_DRAFT: BillDraft = { lines: [], discountKobo: 0, discountReason: "" };
const BLANK_LINE_DRAFT: BillDraft = {
  lines: [{ name: "", amountKobo: 0, checked: true }],
  discountKobo: 0,
  discountReason: "",
};

export default function NewStudentPage() {
  const router = useRouter();
  const { data: classes } = useAsync(() => repository.listClasses(), []);
  const { actorName, term } = useViewer();
  const { data: feeItems } = useAsync(() => repository.listFeeItems(term), [term]);
  const hasAnyFeeStructure = (feeItems?.length ?? 0) > 0;

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    otherName: "",
    gender: "",
    dateOfBirth: "",
    religion: "",
    classId: "",
    guardianName: "",
    guardianPhone: "",
    guardianRelationship: "",
  });
  const [registrationType, setRegistrationType] = useState<"active" | "pending">("active");
  const [draft, setDraft] = useState<BillDraft>(EMPTY_DRAFT);
  const [seededClassId, setSeededClassId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A student cannot be born in the future: cap the date picker at today.
  const today = new Date().toISOString().slice(0, 10);

  const selectedClass = useMemo(
    () => classes?.find((c) => c.id === form.classId),
    [classes, form.classId],
  );
  // The class level's fee items, shaped for the picker.
  const levelItems = useMemo(() => {
    if (!selectedClass || !feeItems) return [];
    return feeItems
      .filter((f) => f.level === selectedClass.level)
      .map((f) => ({ name: f.name, amountKobo: f.amount, optional: f.optional }));
  }, [selectedClass, feeItems]);

  // Re-seed the bill when the chosen class changes (set-state-during-render:
  // guarded so it converges, and avoids a class change effect).
  if (form.classId !== seededClassId && feeItems) {
    setSeededClassId(form.classId);
    setDraft(
      !form.classId
        ? EMPTY_DRAFT
        : levelItems.length > 0
          ? draftFromItems(levelItems)
          : BLANK_LINE_DRAFT,
    );
  }

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    setError(null);
    if (!form.firstName.trim() || !form.lastName.trim())
      return setError("Enter the student's first name and surname.");
    if (!form.classId) return setError("Choose a class.");
    if (!form.guardianName.trim() || !form.guardianPhone.trim())
      return setError("Enter the guardian's name and phone number.");
    const billError = validateBillDraft(draft);
    if (billError) return setError(billError);

    setSaving(true);
    try {
      const student = await repository.createStudent({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        otherName: form.otherName.trim() || undefined,
        gender: form.gender === "male" ? "male" : form.gender === "female" ? "female" : undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        religion: form.religion.trim() || undefined,
        classId: form.classId,
        termFeeKobo: 0,
        billLines: checkedLines(draft),
        discountKobo: draft.discountKobo,
        discountReason: draft.discountReason.trim() || undefined,
        guardianName: form.guardianName.trim(),
        guardianPhone: form.guardianPhone.trim(),
        guardianRelationship: form.guardianRelationship.trim() || undefined,
        status: registrationType,
      });
      router.push(`/students/${student.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the record. Please try again.");
      setSaving(false);
    }
  }

  if (!classes) return <LoadingBlock label="Loading classes…" />;

  return (
    <div className="max-w-lg">
      <Link
        href="/students"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted"
      >
        <ArrowLeftIcon width={18} height={18} />
        Students
      </Link>
      <p className="mb-1 font-mono text-xs uppercase tracking-wide text-warning">
        New record
      </p>
      <h1 className="mb-1 font-display text-2xl font-extrabold text-ink">Add a student</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Recorded by {actorName}. Pick a class to load its fees, then tick the
        items that apply and adjust amounts for this student.
      </p>

      <div className="space-y-4">
        <div className="inline-flex rounded-xl border border-border bg-surface-sunken p-1">
          {(["active", "pending"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setRegistrationType(t)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-semibold transition",
                registrationType === t
                  ? "bg-surface-raised text-ink shadow-sm"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              {t === "active" ? "Register now" : "Temporary / Pre-registered"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <Input value={form.firstName} onChange={set("firstName")} placeholder="Tunde" />
          </Field>
          <Field label="Surname">
            <Input value={form.lastName} onChange={set("lastName")} placeholder="Okafor" />
          </Field>
        </div>

        <Field label="Class">
          <Select value={form.classId} onChange={set("classId")}>
            <option value="">Choose a class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        {form.classId && (
          <>
            {!hasAnyFeeStructure && (
              <Banner tone="info" title="No fee structure yet">
                You can type this bill by hand now, or set up your class fees
                first so bills load automatically.{" "}
                <Link href="/profile" className="font-semibold text-primary underline">
                  Set up fees
                </Link>
              </Banner>
            )}
            <Field
              label="Bill"
              hint={
                levelItems.length > 0
                  ? `Loaded from the ${selectedClass?.level} fee structure. Untick anything that does not apply.`
                  : "This class has no fee structure yet. Enter the bill items manually."
              }
            >
              <BillPicker value={draft} onChange={setDraft} />
            </Field>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Gender">
            <Select value={form.gender} onChange={set("gender")}>
              <option value="">Select a gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </Select>
          </Field>
          <Field label="Date of birth">
            <Input type="date" max={today} value={form.dateOfBirth} onChange={set("dateOfBirth")} />
          </Field>
        </div>

        <Field label="Religion (optional)">
          <Input value={form.religion} onChange={set("religion")} placeholder="e.g. Christianity, Islam" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Guardian's name">
            <Input value={form.guardianName} onChange={set("guardianName")} placeholder="Mr. Chidi Okafor" />
          </Field>
          <Field label="Relationship">
            <Input value={form.guardianRelationship} onChange={set("guardianRelationship")} placeholder="Father" />
          </Field>
        </div>

        <Field label="Guardian's phone" hint="Used to send receipts and fee reminders.">
          <Input value={form.guardianPhone} onChange={set("guardianPhone")} inputMode="tel" placeholder="0803 123 4567" />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? "Saving…" : "Save record"}
        </Button>
      </div>
    </div>
  );
}
