import type {
  ExpenseCadence,
  PaymentMethod,
  Role,
  TermName,
} from "@/lib/domain/types";

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
  | "manage_expenses"
  | "view_ledger"
  | "view_reports"
  | "view_grades"
  | "manage_grades";

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
    "manage_expenses",
    "view_ledger",
    "view_reports",
    "view_grades",
    "manage_grades",
  ],
  bursar: [
    "view_dashboard",
    "view_debtors",
    "record_payment",
    "edit_fees",
    "manage_students",
    "import_students",
    "send_reminders",
    "manage_staff",
    "manage_expenses",
    "view_ledger",
    "view_reports",
    "view_grades",
    "manage_grades",
  ],
  teacher: [
    "view_dashboard",
    "view_debtors",
    "manage_students",
    "view_grades",
    "manage_grades",
  ],
};

/** Common expense categories for a Nigerian school. Seed only — free text. */
export const EXPENSE_CATEGORIES: string[] = [
  "Salary",
  "Rent",
  "Utilities",
  "Maintenance",
  "Supplies",
  "Transport",
  "Feeding",
  "Examination",
  "Miscellaneous",
];

/** Common non-fee income sources for a Nigerian school. Seed only, free text. */
export const INCOME_SOURCES: string[] = [
  "Donation",
  "Grant",
  "Uniform sales",
  "Book sales",
  "Hall rental",
  "PTA",
  "Other",
];

/** Default subjects seeded for a new school. Editable later. */
export const SUBJECT_NAMES: string[] = [
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
  "Physical & Health Education",
  "Fine Arts",
];

export const EXPENSE_CADENCES: { value: ExpenseCadence; label: string }[] = [
  { value: "one_off", label: "One-off" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export const PAY_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "transfer", label: "Transfer" },
  { value: "pos", label: "POS" },
  { value: "online", label: "Online" },
];

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
