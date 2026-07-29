"use client";

import { useActionState } from "react";
import { createSchool, type OnboardingResult } from "./actions";
import { Button, Field, Input } from "@/components/ui";

const currentAcademicYear = (() => {
  const y = new Date().getFullYear();
  const m = new Date().getMonth(); // Nigerian sessions start ~September
  const startYear = m >= 8 ? y : y - 1;
  return `${startYear}/${startYear + 1}`;
})();

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState<OnboardingResult, FormData>(
    createSchool,
    {},
  );

  return (
    <form action={action} className="mt-6 space-y-4">
      <Field label="Your name">
        <Input name="fullName" defaultValue={defaultName} placeholder="e.g. Mrs. Adunni Bello" required />
      </Field>
      <Field label="School name">
        <Input name="schoolName" placeholder="e.g. Tejuosho Group of Schools" required />
      </Field>
      <Field
        label="Short code"
        hint="2–6 letters, printed on every receipt (e.g. TJH-1082)."
      >
        <Input name="code" placeholder="TJH" maxLength={6} required />
      </Field>
      <Field label="Current session">
        <Input name="sessionName" defaultValue={currentAcademicYear} placeholder="2024/2025" required />
      </Field>

      {state.error && (
        <p className="rounded-lg border-l-4 border-danger bg-danger-tint px-4 py-3 text-sm text-ink">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Setting up…" : "Create school"}
      </Button>
    </form>
  );
}
