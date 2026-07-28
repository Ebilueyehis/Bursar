import type { Role, TermName } from "@/lib/domain/types";

/** Terms in order. Nigerian schools run three terms per session. */
export const TERMS: { value: TermName; label: string }[] = [
  { value: "first", label: "First term" },
  { value: "second", label: "Second term" },
  { value: "third", label: "Third term" },
];

export function termLabel(term: TermName): string {
  return TERMS.find((t) => t.value === term)?.label ?? term;
}

/**
 * Default class levels for a Nigerian school (Nursery → SSS). A specific school
 * can add or rename these during setup — this is only the seed.
 */
export const DEFAULT_CLASS_LEVELS: string[] = [
  "Creche",
  "Nursery 1",
  "Nursery 2",
  "Primary 1",
  "Primary 2",
  "Primary 3",
  "Primary 4",
  "Primary 5",
  "Primary 6",
  "JSS 1",
  "JSS 2",
  "JSS 3",
  "SSS 1",
  "SSS 2",
  "SSS 3",
];

/** Common fee types small/medium schools charge. Seed only — fully editable. */
export const DEFAULT_FEE_TYPES: string[] = [
  "Tuition",
  "PTA levy",
  "Development levy",
  "Examination",
  "Uniform",
  "Books",
  "Boarding",
];

/** Human-facing role labels (voice guide: Guardian/Parent, not "user"). */
export const ROLE_LABELS: Record<Role, string> = {
  proprietor: "Proprietor",
  bursar: "Bursar",
  teacher: "Teacher",
};

/**
 * What each role can do. Role-based access is enforced in the database (RLS);
 * this map drives what the UI shows so people aren't offered actions they
 * can't take.
 */
export type Permission =
  | "view_dashboard"
  | "view_debtors"
  | "record_payment"
  | "edit_fees"
  | "manage_students"
  | "import_students"
  | "send_reminders"
  | "manage_staff"
  | "view_reports";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  proprietor: [
    "view_dashboard",
    "view_debtors",
    "record_payment",
    "edit_fees",
    "manage_students",
    "import_students",
    "send_reminders",
    "manage_staff",
    "view_reports",
  ],
  bursar: [
    "view_dashboard",
    "view_debtors",
    "record_payment",
    "edit_fees",
    "manage_students",
    "import_students",
    "send_reminders",
    "view_reports",
  ],
  teacher: ["view_dashboard", "view_debtors", "manage_students"],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
