"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { formatNaira } from "@/lib/money";
import { parseNairaToKobo } from "@/lib/money";
import { Button, Field, Input, Money, NairaInput, Select, LoadingBlock } from "@/components/ui";
import { ArrowLeftIcon } from "@/components/icons";

export default function NewStudentPage() {
  const router = useRouter();
  const { data: classes } = useAsync(() => repository.listClasses(), []);
  const { actorName, term } = useViewer();
  const { data: feeItems } = useAsync(() => repository.listFeeItems(term), [term]);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    otherName: "",
    gender: "",
    dateOfBirth: "",
    religion: "",
    classId: "",
    termFee: "",
    guardianName: "",
    guardianPhone: "",
    guardianRelationship: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedClass = useMemo(
    () => classes?.find((c) => c.id === form.classId),
    [classes, form.classId],
  );
  const levelFeeTotal = useMemo(() => {
    if (!selectedClass || !feeItems) return 0;
    return feeItems
      .filter((f) => f.level === selectedClass.level)
      .reduce((s, f) => s + f.amount, 0);
  }, [selectedClass, feeItems]);

  useEffect(() => {
    if (levelFeeTotal > 0) {
      setForm((f) => ({ ...f, termFee: String(levelFeeTotal / 100) }));
    }
  }, [levelFeeTotal]);

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
    const termFeeKobo = form.termFee ? parseNairaToKobo(form.termFee) : 0;
    if (termFeeKobo === null) return setError("Enter a valid term fee, or leave it blank.");

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
        termFeeKobo: termFeeKobo ?? 0,
        guardianName: form.guardianName.trim(),
        guardianPhone: form.guardianPhone.trim(),
        guardianRelationship: form.guardianRelationship.trim() || undefined,
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
        Recorded by {actorName}. If this class has a fee structure, it&apos;s
        applied automatically — set it under Fees.
      </p>

      <div className="space-y-4">
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

        <Field
          label="Term fee (₦)"
          hint={
            levelFeeTotal > 0
              ? `Auto-filled from ${selectedClass!.level} fee structure (${formatNaira(levelFeeTotal, { kobo_decimals: false })}). You can adjust if needed.`
              : "No fee structure for this class. Enter the term fee manually."
          }
        >
          <NairaInput value={form.termFee} onValueChange={(v) => setForm((f) => ({ ...f, termFee: v }))} placeholder="e.g. 45,000" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Gender">
            <Select value={form.gender} onChange={set("gender")}>
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </Select>
          </Field>
          <Field label="Date of birth">
            <Input type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")} />
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
