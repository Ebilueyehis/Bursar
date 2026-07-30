import type { Kobo } from "@/lib/money";

/**
 * Core domain types for Bursar. These mirror the database schema (see
 * supabase/schema.sql) so the mock repository and a future Supabase repository
 * are interchangeable behind the same interface.
 *
 * Vocabulary is fixed by the voice guide — we say Receipt, Outstanding balance,
 * Student record, Guardian, Payment received, Dashboard. Type names follow suit.
 */

export type Role = "proprietor" | "bursar" | "teacher";

export type PaymentMethod = "cash" | "transfer" | "pos" | "online";

/** The Nigerian academic term. Sessions run First → Second → Third. */
export type TermName = "first" | "second" | "third";

export interface School {
  id: string;
  name: string;
  /** Short code used as a prefix on receipt numbers, e.g. "TJH". */
  code: string;
  address?: string;
  phone?: string;
  currentSessionId: string;
  currentTerm: TermName;
}

export interface Session {
  id: string;
  schoolId: string;
  /** e.g. "2024/2025" */
  name: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
}

export interface UserProfile {
  id: string;
  schoolId: string;
  fullName: string;
  role: Role;
  phone?: string;
  email?: string;
}

/** A class/section, e.g. "JSS 1A" belonging to level "JSS 1". */
export interface SchoolClass {
  id: string;
  schoolId: string;
  /** Broad level, e.g. "Primary 3", "JSS 1" — used to attach a fee structure. */
  level: string;
  /** Full class name including section, e.g. "JSS 1A". */
  name: string;
}

export interface Guardian {
  id: string;
  schoolId: string;
  fullName: string;
  phone: string;
  altPhone?: string;
  email?: string;
  relationship?: string; // Mother, Father, Guardian...
}

export type StudentStatus = "active" | "graduated" | "withdrawn";

export interface Student {
  id: string;
  schoolId: string;
  /** School-issued admission number, e.g. "TJH/2024/018". */
  admissionNo: string;
  firstName: string;
  lastName: string;
  otherName?: string;
  gender?: "male" | "female";
  dateOfBirth?: string;
  classId: string;
  guardianId: string;
  status: StudentStatus;
  enrolledOn: string; // ISO date
}

/**
 * A single billable line in a class's fee structure for a term, e.g.
 * "Tuition" ₦45,000 for "JSS 1" in First term. The structure is the template;
 * a student's actual bill snapshots these amounts so later edits don't rewrite
 * history.
 */
export interface FeeItem {
  id: string;
  schoolId: string;
  sessionId: string;
  term: TermName;
  level: string;
  name: string; // Tuition, PTA levy, Uniform...
  amount: Kobo;
  /** Optional: some items are one-off (e.g. Uniform) vs recurring each term. */
  optional?: boolean;
}

/**
 * A student's bill for one term. total is the snapshot sum of applied fee
 * items minus any discount. Outstanding balance is derived: total − paid.
 */
export interface Bill {
  id: string;
  schoolId: string;
  studentId: string;
  sessionId: string;
  term: TermName;
  lines: BillLine[];
  discount: Kobo;
  discountReason?: string;
  createdOn: string; // ISO date — drives "oldest first" debtor ordering
}

export interface BillLine {
  name: string;
  amount: Kobo;
}

export interface Payment {
  id: string;
  schoolId: string;
  studentId: string;
  billId: string;
  amount: Kobo;
  method: PaymentMethod;
  /** Receipt number, immutable once issued, e.g. "TJH-1082". */
  receiptNo: string;
  paidOn: string; // ISO date
  recordedByName: string;
  note?: string;
}

// --- Money out: staff, expenses, and the unified ledger ----------------------

export type StaffType = "teaching" | "non_teaching";

/** A person the school pays a salary. Kept separate from Bursar logins. */
export interface Staff {
  id: string;
  schoolId: string;
  fullName: string;
  title?: string;
  employmentType: StaffType;
  /** Class taken (primary) or subjects taken (secondary). Free text. */
  assignment?: string;
  monthlySalary: Kobo;
  phone?: string;
  active: boolean;
}

/** How often a cost recurs. Descriptive metadata, surfaced on the ledger. */
export type ExpenseCadence = "one_off" | "monthly" | "yearly";

/** A single money-out entry: vendor spend or a staff salary payment. */
export interface Expense {
  id: string;
  schoolId: string;
  payee: string;
  description: string;
  category: string; // Rent, Utilities, Salary, Maintenance...
  cadence: ExpenseCadence;
  amount: Kobo;
  spentOn: string; // ISO date — date of service/delivery
  method: PaymentMethod;
  /** Set when this expense is a salary payment. */
  staffId?: string;
  /** 'YYYY-MM' when this is a salary payment; drives payroll idempotency. */
  salaryPeriod?: string;
  recordedByName: string;
  note?: string;
}

/** One line in the daily ledger — a payment (in) or an expense (out). */
export interface LedgerEntry {
  id: string;
  date: string; // ISO date
  kind: "payment" | "expense";
  direction: "in" | "out";
  title: string; // student name / payee
  subtitle: string; // receipt no + method / category + cadence
  amount: Kobo;
  method: PaymentMethod;
  reference: string; // studentId or expenseId, for linking
}

/** A day's worth of ledger entries with its totals. */
export interface LedgerDay {
  date: string; // ISO date
  entries: LedgerEntry[];
  totalIn: Kobo;
  totalOut: Kobo;
  net: Kobo; // totalIn − totalOut
}

/** A student with their bill and payment math resolved for a given term. */
export interface StudentAccount {
  student: Student;
  className: string;
  guardian: Guardian;
  bill: Bill;
  billTotal: Kobo;
  paid: Kobo;
  outstanding: Kobo;
  status: "paid" | "partial" | "unpaid";
  payments: Payment[];
}
