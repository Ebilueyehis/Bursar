import type {
  AuditEntry,
  Bill,
  Expense,
  FeeItem,
  Income,
  LedgerDay,
  LedgerEntry,
  Payment,
  School,
  SchoolClass,
  Session,
  Staff,
  Student,
  StudentAccount,
  TermName,
  UserProfile,
} from "@/lib/domain/types";
import { groupLedger } from "@/lib/data/ledger";
import {
  BILLS,
  CLASSES,
  GUARDIANS,
  NEXT_RECEIPT_SEQ,
  PAYMENTS,
  SCHOOL,
  SESSION,
  STUDENTS,
  USERS,
} from "@/lib/data/seed";
import type {
  BillLineInput,
  CreateExpenseInput,
  CreateIncomeInput,
  IncomeRow,
  CreateStaffInput,
  DashboardStats,
  DateFilter,
  FeeLineInput,
  FeeStructureImportResult,
  ImportResult,
  ImportRowResult,
  ImportStudentRow,
  PayrollPreview,
  PayrollResult,
  RecordPaymentInput,
  Repository,
} from "@/lib/data/repository";
import type { FeeTemplateRow } from "@/lib/fees/feeTemplate";

/**
 * In-memory implementation of the Repository. Data lives in module arrays that
 * were seeded once; writes mutate them so the app feels live within a session.
 * Nothing here persists across reloads — that arrives with Supabase.
 */

let receiptSeq = NEXT_RECEIPT_SEQ;

// Money-out stores. Seeded empty; writes mutate them within a session.
const STAFF: Staff[] = [];
const EXPENSES: Expense[] = [];
// Fee structure store (level + term → line items). Seeded empty.
const FEE_ITEMS: FeeItem[] = [];
// Non-fee income store. Seeded empty.
const INCOME: Income[] = [];
// Money audit trail. In the real backend this is written by DB triggers; the
// mock simulates it so the Audit tab is populated without a database.
const AUDIT: AuditEntry[] = [];

function pushAudit(
  action: AuditEntry["action"],
  entity: AuditEntry["entity"],
  entityId: string,
  summary: string,
  amount: number | null,
): void {
  AUDIT.push({
    id: `aud-${Date.now()}-${AUDIT.length}`,
    actorName: "You",
    action,
    entity,
    entityId,
    summary,
    amount,
    createdAt: new Date().toISOString(),
  });
}

function inRange(date: string, filter?: DateFilter): boolean {
  if (filter?.from && date < filter.from) return false;
  if (filter?.to && date > filter.to) return false;
  return true;
}

function studentName(studentId: string): string {
  const s = STUDENTS.find((x) => x.id === studentId);
  return s ? `${s.firstName} ${s.lastName}` : "Student";
}

function classById(id: string): SchoolClass | undefined {
  return CLASSES.find((c) => c.id === id);
}

function billFor(studentId: string, term: TermName): Bill | undefined {
  return BILLS.find((b) => b.studentId === studentId && b.term === term);
}

function paymentsFor(billId: string): Payment[] {
  return PAYMENTS.filter((p) => p.billId === billId).sort((a, b) =>
    a.paidOn.localeCompare(b.paidOn),
  );
}

function buildAccount(student: Student, term: TermName): StudentAccount | null {
  const bill = billFor(student.id, term);
  if (!bill) return null;
  const cls = classById(student.classId);
  const guardian = GUARDIANS.find((g) => g.id === student.guardianId)!;
  const payments = paymentsFor(bill.id);
  const billTotal =
    bill.lines.reduce((sum, l) => sum + l.amount, 0) - bill.discount;
  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  const outstanding = Math.max(0, billTotal - paid);
  const status: StudentAccount["status"] =
    paid <= 0 ? "unpaid" : outstanding <= 0 ? "paid" : "partial";
  return {
    student,
    className: cls?.name ?? "-",
    guardian,
    bill,
    billTotal,
    paid,
    outstanding,
    status,
    payments,
  };
}

// Simulate a little latency so loading states are real in the prototype.
const tick = () => new Promise<void>((r) => setTimeout(r, 120));

export const mockRepository: Repository = {
  async getSchool(): Promise<School> {
    await tick();
    return SCHOOL;
  },

  async updateBankAccount(input): Promise<void> {
    await tick();
    SCHOOL.bankAccountNumber = input.accountNumber.trim();
    SCHOOL.bankAccountName = input.accountName.trim();
    SCHOOL.bankName = input.bankName.trim();
  },

  async getSession(): Promise<Session> {
    await tick();
    return SESSION;
  },

  async listUsers(): Promise<UserProfile[]> {
    await tick();
    return USERS;
  },

  async listClasses(): Promise<SchoolClass[]> {
    await tick();
    return CLASSES;
  },

  async getDashboardStats(term: TermName): Promise<DashboardStats> {
    await tick();
    const accounts = STUDENTS.map((s) => buildAccount(s, term)).filter(
      (a): a is StudentAccount => a !== null,
    );
    const totalBilled = accounts.reduce((s, a) => s + a.billTotal, 0);
    const totalCollected = accounts.reduce((s, a) => s + a.paid, 0);
    const totalOutstanding = accounts.reduce((s, a) => s + a.outstanding, 0);
    return {
      term,
      studentCount: STUDENTS.filter((s) => s.status === "active").length,
      totalBilled,
      totalCollected,
      totalOutstanding,
      debtorCount: accounts.filter((a) => a.outstanding > 0).length,
      fullyPaidCount: accounts.filter((a) => a.status === "paid").length,
      partialCount: accounts.filter((a) => a.status === "partial").length,
      unpaidCount: accounts.filter((a) => a.status === "unpaid").length,
      receiptCount: accounts.reduce((s, a) => s + a.payments.length, 0),
    };
  },

  async listStudentAccounts(term: TermName): Promise<StudentAccount[]> {
    await tick();
    return STUDENTS.map((s) => buildAccount(s, term))
      .filter((a): a is StudentAccount => a !== null)
      .sort((a, b) =>
        `${a.student.firstName} ${a.student.lastName}`.localeCompare(
          `${b.student.firstName} ${b.student.lastName}`,
        ),
      );
  },

  async listDebtors(term: TermName): Promise<StudentAccount[]> {
    await tick();
    return STUDENTS.map((s) => buildAccount(s, term))
      .filter((a): a is StudentAccount => a !== null && a.outstanding > 0)
      // Oldest bill first — who to chase first.
      .sort((a, b) => a.bill.createdOn.localeCompare(b.bill.createdOn));
  },

  async getStudentAccount(
    studentId: string,
    term: TermName,
  ): Promise<StudentAccount | null> {
    await tick();
    const student = STUDENTS.find((s) => s.id === studentId);
    if (!student) return null;
    return buildAccount(student, term);
  },

  async listStudents(): Promise<Student[]> {
    await tick();
    return [...STUDENTS].sort((a, b) =>
      a.lastName.localeCompare(b.lastName),
    );
  },

  async recordPayment(input: RecordPaymentInput): Promise<Payment> {
    await tick();
    const bill = billFor(input.studentId, input.term);
    if (!bill) throw new Error("This student has no bill for the term.");
    if (input.amount <= 0)
      throw new Error("Enter an amount greater than zero.");
    receiptSeq += 1;
    const payment: Payment = {
      id: `p-new-${receiptSeq}`,
      schoolId: SCHOOL.id,
      studentId: input.studentId,
      billId: bill.id,
      amount: input.amount,
      method: input.method,
      receiptNo: `${SCHOOL.code}-${receiptSeq}`,
      paidOn: new Date().toISOString().slice(0, 10),
      recordedByName: input.recordedByName,
      note: input.note,
    };
    PAYMENTS.push(payment);
    pushAudit("created", "payment", payment.id, `Payment receipt ${payment.receiptNo}`, payment.amount);
    return payment;
  },

  async createStudent(input): Promise<Student> {
    await tick();
    const cls = CLASSES.find((c) => c.id === input.classId);
    if (!cls) throw new Error("Class not found.");
    const gId = `g-new-${Date.now()}`;
    GUARDIANS.push({
      id: gId,
      schoolId: SCHOOL.id,
      fullName: input.guardianName,
      phone: input.guardianPhone,
      relationship: input.guardianRelationship,
    });
    const sId = `s-new-${Date.now()}`;
    const seq = STUDENTS.length + 1;
    const student: Student = {
      id: sId,
      schoolId: SCHOOL.id,
      admissionNo: `${SCHOOL.code}/${new Date().getFullYear()}/${String(seq).padStart(3, "0")}`,
      firstName: input.firstName,
      lastName: input.lastName,
      otherName: input.otherName,
      gender: input.gender,
      dateOfBirth: input.dateOfBirth,
      classId: cls.id,
      guardianId: gId,
      status: "active",
      enrolledOn: new Date().toISOString().slice(0, 10),
    };
    STUDENTS.push(student);

    // Bill lines: prefer explicitly chosen picker lines, then the class level's
    // fee structure, then the typed term fee.
    const structure = FEE_ITEMS.filter(
      (f) => f.level === cls.level && f.term === SCHOOL.currentTerm,
    );
    let lines: { name: string; amount: number }[] = [];
    if (input.billLines && input.billLines.length > 0) {
      lines = input.billLines
        .filter((l) => l.name.trim() !== "" && l.amountKobo >= 0)
        .map((l) => ({ name: l.name.trim(), amount: l.amountKobo }));
    } else if (structure.length > 0) {
      lines = structure.map((f) => ({ name: f.name, amount: f.amount }));
    } else if (input.termFeeKobo > 0) {
      lines = [{ name: "Term fee", amount: input.termFeeKobo }];
    }
    if (lines.length > 0) {
      BILLS.push({
        id: `b-new-${Date.now()}`,
        schoolId: SCHOOL.id,
        studentId: sId,
        sessionId: SESSION.id,
        term: SCHOOL.currentTerm,
        lines,
        discount: Math.max(0, input.discountKobo ?? 0),
        discountReason: input.discountReason,
        createdOn: new Date().toISOString().slice(0, 10),
      });
    }
    return student;
  },

  async importStudents(rows: ImportStudentRow[]): Promise<ImportResult> {
    await tick();
    const results: ImportRowResult[] = [];
    let imported = 0;
    rows.forEach((row, idx) => {
      const rowNumber = idx + 1;
      const name = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim();
      const cls = CLASSES.find(
        (c) =>
          c.name.toLowerCase() === (row.className ?? "").trim().toLowerCase() ||
          c.level.toLowerCase() === (row.className ?? "").trim().toLowerCase(),
      );
      if (!row.firstName || !row.lastName) {
        results.push({ rowNumber, ok: false, studentName: name, error: "Missing first or last name." });
        return;
      }
      if (!cls) {
        results.push({ rowNumber, ok: false, studentName: name, error: `Class "${row.className}" not found.` });
        return;
      }
      if (!row.guardianPhone) {
        results.push({ rowNumber, ok: false, studentName: name, error: "Missing guardian phone." });
        return;
      }
      const gId = `g-imp-${Date.now()}-${idx}`;
      GUARDIANS.push({
        id: gId,
        schoolId: SCHOOL.id,
        fullName: row.guardianName || "Guardian",
        phone: row.guardianPhone,
        relationship: row.guardianRelationship,
      });
      const sId = `s-imp-${Date.now()}-${idx}`;
      const seq = STUDENTS.length + 1;
      STUDENTS.push({
        id: sId,
        schoolId: SCHOOL.id,
        admissionNo: `${SCHOOL.code}/2024/${String(seq).padStart(3, "0")}`,
        firstName: row.firstName,
        lastName: row.lastName,
        otherName: row.otherName,
        gender: row.gender?.toLowerCase() === "male" ? "male" : row.gender?.toLowerCase() === "female" ? "female" : undefined,
        classId: cls.id,
        guardianId: gId,
        status: "active",
        enrolledOn: new Date().toISOString().slice(0, 10),
      });
      imported += 1;
      results.push({ rowNumber, ok: true, studentName: name });
    });
    return { imported, failed: rows.length - imported, results };
  },

  // --- Money out ------------------------------------------------------------

  async listExpenses(filter?: DateFilter): Promise<Expense[]> {
    await tick();
    return EXPENSES.filter((e) => inRange(e.spentOn, filter)).sort((a, b) =>
      b.spentOn.localeCompare(a.spentOn),
    );
  },

  async createExpense(input: CreateExpenseInput): Promise<Expense> {
    await tick();
    if (input.amountKobo <= 0)
      throw new Error("Enter an amount greater than zero.");
    const expense: Expense = {
      id: `e-new-${Date.now()}`,
      schoolId: SCHOOL.id,
      payee: input.payee,
      description: input.description,
      category: input.category,
      cadence: input.cadence,
      amount: input.amountKobo,
      spentOn: input.spentOn,
      method: input.method,
      recordedByName: input.recordedByName,
      note: input.note,
    };
    EXPENSES.push(expense);
    pushAudit("created", "expense", expense.id, `Expense to ${expense.payee}`, expense.amount);
    return expense;
  },

  async updateExpense(id: string, patch: CreateExpenseInput): Promise<Expense> {
    await tick();
    const existing = EXPENSES.find((e) => e.id === id);
    if (!existing) throw new Error("Expense not found.");
    Object.assign(existing, {
      payee: patch.payee,
      description: patch.description,
      category: patch.category,
      cadence: patch.cadence,
      amount: patch.amountKobo,
      spentOn: patch.spentOn,
      method: patch.method,
      note: patch.note,
    });
    pushAudit("edited", "expense", existing.id, `Expense to ${existing.payee}`, existing.amount);
    return existing;
  },

  async deleteExpense(id: string): Promise<void> {
    await tick();
    const i = EXPENSES.findIndex((e) => e.id === id);
    if (i >= 0) EXPENSES.splice(i, 1);
    pushAudit("deleted", "expense", id, "Expense", null);
  },

  async listIncome(filter?: DateFilter): Promise<Income[]> {
    await tick();
    return INCOME.filter((i) => inRange(i.receivedOn, filter)).sort((a, b) =>
      b.receivedOn.localeCompare(a.receivedOn),
    );
  },

  async createIncome(input: CreateIncomeInput): Promise<Income> {
    await tick();
    if (input.amountKobo <= 0)
      throw new Error("Enter an amount greater than zero.");
    const income: Income = {
      id: `inc-new-${Date.now()}`,
      schoolId: SCHOOL.id,
      source: input.source,
      description: input.description,
      amount: input.amountKobo,
      receivedOn: input.receivedOn,
      method: input.method,
      note: input.note,
      recordedByName: input.recordedByName,
    };
    INCOME.push(income);
    pushAudit("created", "income", income.id, `Income: ${income.source}`, income.amount);
    return income;
  },

  async updateIncome(id: string, patch: CreateIncomeInput): Promise<Income> {
    await tick();
    if (patch.amountKobo <= 0)
      throw new Error("Enter an amount greater than zero.");
    const existing = INCOME.find((i) => i.id === id);
    if (!existing) throw new Error("Income entry not found.");
    Object.assign(existing, {
      source: patch.source,
      description: patch.description,
      amount: patch.amountKobo,
      receivedOn: patch.receivedOn,
      method: patch.method,
      note: patch.note,
    });
    pushAudit("edited", "income", existing.id, `Income: ${existing.source}`, existing.amount);
    return existing;
  },

  async deleteIncome(id: string): Promise<void> {
    await tick();
    const i = INCOME.findIndex((x) => x.id === id);
    if (i >= 0) INCOME.splice(i, 1);
    pushAudit("deleted", "income", id, "Income entry", null);
  },

  async listIncomeView(filter?: DateFilter): Promise<IncomeRow[]> {
    await tick();
    const rows: IncomeRow[] = [];
    for (const p of PAYMENTS) {
      if (!inRange(p.paidOn, filter)) continue;
      rows.push({
        kind: "fee",
        id: p.id,
        date: p.paidOn,
        source: "School fee",
        description: studentName(p.studentId),
        amount: p.amount,
        method: p.method,
        recordedByName: p.recordedByName,
        studentId: p.studentId,
      });
    }
    for (const i of INCOME) {
      if (!inRange(i.receivedOn, filter)) continue;
      rows.push({
        kind: "other",
        id: i.id,
        date: i.receivedOn,
        source: i.source,
        description: i.description,
        amount: i.amount,
        method: i.method,
        recordedByName: i.recordedByName,
      });
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  },

  async listStaff(): Promise<Staff[]> {
    await tick();
    return [...STAFF].sort((a, b) => a.fullName.localeCompare(b.fullName));
  },

  async createStaff(input: CreateStaffInput): Promise<Staff> {
    await tick();
    const staff: Staff = {
      id: `st-new-${Date.now()}`,
      schoolId: SCHOOL.id,
      fullName: input.fullName,
      title: input.title,
      employmentType: input.employmentType,
      assignment: input.assignment,
      monthlySalary: input.monthlySalaryKobo,
      phone: input.phone,
      active: true,
    };
    STAFF.push(staff);
    return staff;
  },

  async updateStaff(id: string, patch: CreateStaffInput): Promise<Staff> {
    await tick();
    const existing = STAFF.find((s) => s.id === id);
    if (!existing) throw new Error("Staff not found.");
    Object.assign(existing, {
      fullName: patch.fullName,
      title: patch.title,
      employmentType: patch.employmentType,
      assignment: patch.assignment,
      monthlySalary: patch.monthlySalaryKobo,
      phone: patch.phone,
    });
    return existing;
  },

  async setStaffActive(id: string, active: boolean): Promise<void> {
    await tick();
    const s = STAFF.find((x) => x.id === id);
    if (s) s.active = active;
  },

  async previewPayroll(period: string): Promise<PayrollPreview> {
    await tick();
    const rows = STAFF.filter((s) => s.active).map((staff) => {
      const alreadyPaid = EXPENSES.some(
        (e) => e.staffId === staff.id && e.salaryPeriod === period,
      );
      return { staff, alreadyPaid };
    });
    const totalToPayKobo = rows
      .filter((r) => !r.alreadyPaid)
      .reduce((sum, r) => sum + r.staff.monthlySalary, 0);
    return { period, rows, totalToPayKobo };
  },

  async runPayroll(
    period: string,
    recordedByName: string,
  ): Promise<PayrollResult> {
    await tick();
    let created = 0;
    let skipped = 0;
    let totalPaidKobo = 0;
    for (const staff of STAFF.filter((s) => s.active)) {
      const already = EXPENSES.some(
        (e) => e.staffId === staff.id && e.salaryPeriod === period,
      );
      if (already) {
        skipped += 1;
        continue;
      }
      if (staff.monthlySalary <= 0) {
        skipped += 1;
        continue;
      }
      EXPENSES.push({
        id: `e-sal-${staff.id}-${period}`,
        schoolId: SCHOOL.id,
        payee: staff.fullName,
        description: `Salary: ${period}`,
        category: "Salary",
        cadence: "monthly",
        amount: staff.monthlySalary,
        spentOn: `${period}-28`,
        method: "transfer",
        staffId: staff.id,
        salaryPeriod: period,
        recordedByName,
      });
      created += 1;
      totalPaidKobo += staff.monthlySalary;
    }
    return { created, skipped, totalPaidKobo };
  },

  async getLedger(filter?: DateFilter): Promise<LedgerDay[]> {
    await tick();
    const entries: LedgerEntry[] = [];
    for (const p of PAYMENTS) {
      if (!inRange(p.paidOn, filter)) continue;
      entries.push({
        id: p.id,
        date: p.paidOn,
        kind: "payment",
        direction: "in",
        title: studentName(p.studentId),
        subtitle: `${p.receiptNo} · ${p.method}`,
        amount: p.amount,
        method: p.method,
        reference: p.studentId,
      });
    }
    for (const e of EXPENSES) {
      if (!inRange(e.spentOn, filter)) continue;
      entries.push({
        id: e.id,
        date: e.spentOn,
        kind: "expense",
        direction: "out",
        title: e.payee,
        subtitle: `${e.category} · ${e.method}`,
        amount: e.amount,
        method: e.method,
        reference: e.id,
      });
    }
    for (const i of INCOME) {
      if (!inRange(i.receivedOn, filter)) continue;
      entries.push({
        id: i.id,
        date: i.receivedOn,
        kind: "income",
        direction: "in",
        title: i.source,
        subtitle: `${i.description} · ${i.method}`,
        amount: i.amount,
        method: i.method,
        reference: i.id,
      });
    }
    return groupLedger(entries);
  },

  // --- Fee structure & discounts --------------------------------------------

  async listFeeItems(term: TermName): Promise<FeeItem[]> {
    await tick();
    return FEE_ITEMS.filter((f) => f.term === term);
  },

  async saveFeeStructure(
    level: string,
    term: TermName,
    items: FeeLineInput[],
  ): Promise<void> {
    await tick();
    // Replace this level+term structure.
    for (let i = FEE_ITEMS.length - 1; i >= 0; i--) {
      if (FEE_ITEMS[i].level === level && FEE_ITEMS[i].term === term)
        FEE_ITEMS.splice(i, 1);
    }
    items
      .filter((it) => it.name.trim() && it.amountKobo >= 0)
      .forEach((it, idx) => {
        FEE_ITEMS.push({
          id: `fee-${level}-${term}-${idx}-${Date.now()}`,
          schoolId: SCHOOL.id,
          sessionId: SESSION.id,
          term,
          level,
          name: it.name.trim(),
          amount: it.amountKobo,
          optional: it.optional ?? false,
        });
      });
  },

  async importFeeStructure(
    term: TermName,
    rows: FeeTemplateRow[],
  ): Promise<FeeStructureImportResult> {
    await tick();
    const byLevel = new Map<string, FeeTemplateRow[]>();
    for (const r of rows) {
      const list = byLevel.get(r.level) ?? [];
      list.push(r);
      byLevel.set(r.level, list);
    }
    let itemsWritten = 0;
    for (const [level, items] of byLevel) {
      await this.saveFeeStructure(
        level,
        term,
        items.map((i) => ({
          name: i.name,
          amountKobo: i.amountKobo,
          optional: i.optional,
        })),
      );
      itemsWritten += items.length;
    }
    return { levelsUpdated: byLevel.size, itemsWritten, skipped: 0 };
  },

  async generateBill(studentId: string, term: TermName): Promise<void> {
    await tick();
    if (BILLS.some((b) => b.studentId === studentId && b.term === term)) return;
    const student = STUDENTS.find((s) => s.id === studentId);
    if (!student) return;
    const cls = classById(student.classId);
    const structure = FEE_ITEMS.filter(
      (f) => f.level === cls?.level && f.term === term,
    );
    if (structure.length === 0) return;
    BILLS.push({
      id: `b-gen-${studentId}-${term}`,
      schoolId: SCHOOL.id,
      studentId,
      sessionId: SESSION.id,
      term,
      lines: structure.map((f) => ({ name: f.name, amount: f.amount })),
      discount: 0,
      createdOn: new Date().toISOString().slice(0, 10),
    });
  },

  async setStudentDiscount(
    studentId: string,
    term: TermName,
    discountKobo: number,
    reason?: string,
  ): Promise<void> {
    await tick();
    const bill = BILLS.find((b) => b.studentId === studentId && b.term === term);
    if (!bill) throw new Error("This student has no bill for the term yet.");
    bill.discount = Math.max(0, discountKobo);
    bill.discountReason = reason;
  },

  async updateBillLines(
    studentId: string,
    term: TermName,
    lines: BillLineInput[],
  ): Promise<void> {
    await tick();
    const bill = BILLS.find((b) => b.studentId === studentId && b.term === term);
    if (!bill) throw new Error("This student has no bill for the term yet.");
    const clean = lines
      .filter((l) => l.name.trim() !== "" && l.amountKobo >= 0)
      .map((l) => ({ name: l.name.trim(), amount: l.amountKobo }));
    if (clean.length === 0) throw new Error("A bill needs at least one item.");
    const newTotal = clean.reduce((s, l) => s + l.amount, 0) - bill.discount;
    const paid = paymentsFor(bill.id).reduce((s, p) => s + p.amount, 0);
    if (newTotal < paid) {
      throw new Error("New bill total is less than what has already been paid.");
    }
    bill.lines = clean;
  },

  async listAuditLog(filter?: DateFilter): Promise<AuditEntry[]> {
    await tick();
    return AUDIT.filter((a) => inRange(a.createdAt.slice(0, 10), filter)).sort(
      (x, y) => y.createdAt.localeCompare(x.createdAt),
    );
  },
};
