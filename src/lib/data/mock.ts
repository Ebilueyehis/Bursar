import type {
  Bill,
  Payment,
  School,
  SchoolClass,
  Session,
  Student,
  StudentAccount,
  TermName,
  UserProfile,
} from "@/lib/domain/types";
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
  DashboardStats,
  ImportResult,
  ImportRowResult,
  ImportStudentRow,
  RecordPaymentInput,
  Repository,
} from "@/lib/data/repository";

/**
 * In-memory implementation of the Repository. Data lives in module arrays that
 * were seeded once; writes mutate them so the app feels live within a session.
 * Nothing here persists across reloads — that arrives with Supabase.
 */

let receiptSeq = NEXT_RECEIPT_SEQ;

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
    className: cls?.name ?? "—",
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
    if (input.termFeeKobo > 0) {
      BILLS.push({
        id: `b-new-${Date.now()}`,
        schoolId: SCHOOL.id,
        studentId: sId,
        sessionId: SESSION.id,
        term: SCHOOL.currentTerm,
        lines: [{ name: "Term fee", amount: input.termFeeKobo }],
        discount: 0,
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
};
