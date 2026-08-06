import type {
  AuditEntry,
  Expense,
  ExpenseCadence,
  FeeItem,
  Income,
  LedgerDay,
  Payment,
  PaymentMethod,
  Role,
  School,
  SchoolClass,
  Session,
  Staff,
  StaffType,
  Student,
  StudentAccount,
  TermName,
  UserProfile,
} from "@/lib/domain/types";
import type { FeeTemplateRow } from "@/lib/fees/feeTemplate";

/**
 * The single interface the UI uses to read and write data. Today it is backed
 * by an in-memory mock (mock.ts). When Supabase is connected we implement the
 * same interface against Postgres — no screen has to change.
 *
 * All methods are async on purpose: real reads come from the network or the
 * offline cache, and the UI is built to await them from day one.
 */
export interface Repository {
  getSchool(): Promise<School>;
  getSession(): Promise<Session>;
  listUsers(): Promise<UserProfile[]>;
  listClasses(): Promise<SchoolClass[]>;

  /** Dashboard headline numbers for a term. */
  getDashboardStats(term: TermName): Promise<DashboardStats>;

  /** Every student's account (bill vs payments) for a term. */
  listStudentAccounts(term: TermName): Promise<StudentAccount[]>;

  /**
   * Students with an outstanding balance for the term, sorted oldest bill
   * first — "so you always know who to follow up with first."
   */
  listDebtors(term: TermName): Promise<StudentAccount[]>;

  getStudentAccount(studentId: string, term: TermName): Promise<StudentAccount | null>;

  listStudents(): Promise<Student[]>;

  /** Record a payment received. Returns the created payment (with receipt no.). */
  recordPayment(input: RecordPaymentInput): Promise<Payment>;

  /** Create a single student (+ guardian, + this term's bill). Fixes "add student". */
  createStudent(input: CreateStudentInput): Promise<Student>;

  /** Bulk import parsed student rows. Returns per-row results. */
  importStudents(rows: ImportStudentRow[]): Promise<ImportResult>;

  // --- Money out: expenses, staff, payroll, ledger --------------------------

  /** All expenses, newest first, optionally within a date range. */
  listExpenses(filter?: DateFilter): Promise<Expense[]>;
  createExpense(input: CreateExpenseInput): Promise<Expense>;
  updateExpense(id: string, patch: CreateExpenseInput): Promise<Expense>;
  deleteExpense(id: string): Promise<void>;

  /** Staff register. Includes retired staff so they can be reactivated. */
  listStaff(): Promise<Staff[]>;
  createStaff(input: CreateStaffInput): Promise<Staff>;
  updateStaff(id: string, patch: CreateStaffInput): Promise<Staff>;
  setStaffActive(id: string, active: boolean): Promise<void>;

  /** Active staff for a month, flagging any already paid for that period. */
  previewPayroll(period: string): Promise<PayrollPreview>;
  /** Generate a salary expense per active, unpaid staff for the month. */
  runPayroll(period: string, recordedByName: string): Promise<PayrollResult>;

  /** Unified daily cashbook: payments (in) + expenses (out) grouped by day. */
  getLedger(filter?: DateFilter): Promise<LedgerDay[]>;

  // --- Fee structure & discounts --------------------------------------------

  /** Fee line items for the current session + term, across all class levels. */
  listFeeItems(term: TermName): Promise<FeeItem[]>;
  /** Replace the fee structure for one class level + term. */
  saveFeeStructure(
    level: string,
    term: TermName,
    items: FeeLineInput[],
  ): Promise<void>;
  /** Create a bill for a student from their class level's structure, if missing. */
  generateBill(studentId: string, term: TermName): Promise<void>;
  /** Set a student's discount/scholarship on their bill for the term. */
  setStudentDiscount(
    studentId: string,
    term: TermName,
    discountKobo: number,
    reason?: string,
  ): Promise<void>;

  /** Replace fee structure for every class level present in the uploaded rows. */
  importFeeStructure(
    term: TermName,
    rows: FeeTemplateRow[],
  ): Promise<FeeStructureImportResult>;

  /** Replace a student's bill snapshot lines for the term. Discount is untouched. */
  updateBillLines(
    studentId: string,
    term: TermName,
    lines: BillLineInput[],
  ): Promise<void>;

  /** Save the school's bank account details (shown on invoices/receipts). */
  updateBankAccount(input: BankAccountInput): Promise<void>;

  // --- Income (non-fee money in) --------------------------------------------

  /** Non-fee income entries, newest first, optionally within a date range. */
  listIncome(filter?: DateFilter): Promise<Income[]>;
  createIncome(input: CreateIncomeInput): Promise<Income>;
  updateIncome(id: string, patch: CreateIncomeInput): Promise<Income>;
  deleteIncome(id: string): Promise<void>;

  /** Merged money-in view: fee payments + non-fee income, newest first. */
  listIncomeView(filter?: DateFilter): Promise<IncomeRow[]>;

  /** Read-only money audit trail, newest first. */
  listAuditLog(filter?: DateFilter): Promise<AuditEntry[]>;
}

export interface IncomeRow {
  kind: "fee" | "other";
  id: string;
  date: string;
  source: string;
  description: string;
  amount: number; // kobo
  method: PaymentMethod;
  recordedByName: string;
  studentId?: string;
}

export interface CreateIncomeInput {
  source: string;
  description: string;
  amountKobo: number;
  receivedOn: string; // ISO date
  method: PaymentMethod;
  note?: string;
  recordedByName: string;
}

export interface BankAccountInput {
  accountNumber: string;
  accountName: string;
  bankName: string;
}

export interface FeeLineInput {
  name: string;
  amountKobo: number;
  optional?: boolean;
}

export interface BillLineInput {
  name: string;
  amountKobo: number;
}

export interface FeeStructureImportResult {
  levelsUpdated: number;
  itemsWritten: number;
  skipped: number;
}

export interface DateFilter {
  from?: string; // ISO date, inclusive
  to?: string; // ISO date, inclusive
}

export interface CreateExpenseInput {
  payee: string;
  description: string;
  category: string;
  cadence: ExpenseCadence;
  amountKobo: number;
  spentOn: string; // ISO date
  method: PaymentMethod;
  note?: string;
  recordedByName: string;
}

export interface CreateStaffInput {
  fullName: string;
  title?: string;
  employmentType: StaffType;
  assignment?: string;
  monthlySalaryKobo: number;
  phone?: string;
}

export interface PayrollPreviewRow {
  staff: Staff;
  alreadyPaid: boolean;
}

export interface PayrollPreview {
  period: string; // 'YYYY-MM'
  rows: PayrollPreviewRow[];
  totalToPayKobo: number; // sum of unpaid, active staff salaries
}

export interface PayrollResult {
  created: number;
  skipped: number;
  totalPaidKobo: number;
}

export interface CreateStudentInput {
  firstName: string;
  lastName: string;
  otherName?: string;
  gender?: "male" | "female";
  dateOfBirth?: string;
  religion?: string;
  classId: string;
  termFeeKobo: number;
  /** Chosen + edited bill lines from the picker. If omitted, falls back to termFeeKobo. */
  billLines?: BillLineInput[];
  discountKobo?: number;
  discountReason?: string;
  guardianName: string;
  guardianPhone: string;
  guardianRelationship?: string;
}

export interface DashboardStats {
  term: TermName;
  studentCount: number;
  /** Total billed for the term across all students. */
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  debtorCount: number;
  fullyPaidCount: number;
  partialCount: number;
  unpaidCount: number;
  /** Number of payments (receipts) recorded for the term. */
  receiptCount: number;
}

export interface RecordPaymentInput {
  studentId: string;
  term: TermName;
  amount: number; // kobo
  method: PaymentMethod;
  note?: string;
  recordedByName: string;
}

export interface ImportStudentRow {
  firstName: string;
  lastName: string;
  otherName?: string;
  gender?: string;
  className: string;
  guardianName: string;
  guardianPhone: string;
  guardianRelationship?: string;
}

export interface ImportRowResult {
  rowNumber: number;
  ok: boolean;
  studentName: string;
  error?: string;
}

export interface ImportResult {
  imported: number;
  failed: number;
  results: ImportRowResult[];
}

/** The active repository. Swap this line to change backends. */
export { supabaseRepository as repository } from "@/lib/data/supabase-repo";

/** For the prototype only: which role the viewer is currently acting as. */
export type ViewerRole = Role;
