import { createClient } from "@/lib/supabase/client";
import type {
  AuditEntry,
  Bill,
  Expense,
  FeeItem,
  Income,
  Subject,
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
import type {
  BillLineInput,
  CreateExpenseInput,
  CreateIncomeInput,
  IncomeRow,
  CreateStaffInput,
  CreateStudentInput,
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
  SaveAssessmentsInput,
  ClassRecordSummary,
  SubjectAverageRow,
  StudentSubjectScore,
  StudentReport,
  AssessmentImportResult,
} from "@/lib/data/repository";
import type { FeeTemplateRow } from "@/lib/fees/feeTemplate";
import { groupLedger } from "@/lib/data/ledger";
import { SUBJECT_NAMES } from "@/lib/domain/constants";
import { componentTotal, gradeFor } from "@/lib/records/grading";

/**
 * Supabase-backed implementation of the Repository. Uses the browser client, so
 * every query runs as the signed-in user and RLS automatically scopes results
 * to their school — the app never passes a school id around. Row shapes are
 * mapped from snake_case columns to the camelCase domain types the UI expects.
 */

type Row = Record<string, unknown>;

function sb() {
  return createClient();
}

function meanOf(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}
function numOrNull(v: unknown): number | null {
  return v == null ? null : Number(v);
}

// --- mappers ----------------------------------------------------------------

function mapSchool(r: Row): School {
  return {
    id: r.id as string,
    name: r.name as string,
    code: r.code as string,
    address: (r.address as string) ?? undefined,
    phone: (r.phone as string) ?? undefined,
    currentSessionId: (r.current_session_id as string) ?? "",
    currentTerm: (r.current_term as TermName) ?? "first",
    bankAccountNumber: (r.bank_account_number as string) ?? undefined,
    bankAccountName: (r.bank_account_name as string) ?? undefined,
    bankName: (r.bank_name as string) ?? undefined,
  };
}

function mapSession(r: Row): Session {
  return {
    id: r.id as string,
    schoolId: r.school_id as string,
    name: r.name as string,
    startDate: r.start_date as string,
    endDate: r.end_date as string,
  };
}

function mapClass(r: Row): SchoolClass {
  return {
    id: r.id as string,
    schoolId: r.school_id as string,
    level: r.level as string,
    name: r.name as string,
  };
}

function mapStudent(r: Row): Student {
  return {
    id: r.id as string,
    schoolId: r.school_id as string,
    admissionNo: r.admission_no as string,
    firstName: r.first_name as string,
    lastName: r.last_name as string,
    otherName: (r.other_name as string) ?? undefined,
    gender: (r.gender as "male" | "female") ?? undefined,
    dateOfBirth: (r.date_of_birth as string) ?? undefined,
    classId: (r.class_id as string) ?? "",
    guardianId: (r.guardian_id as string) ?? "",
    status: (r.status as Student["status"]) ?? "active",
    enrolledOn: r.enrolled_on as string,
  };
}

function mapPayment(r: Row): Payment {
  return {
    id: r.id as string,
    schoolId: r.school_id as string,
    studentId: r.student_id as string,
    billId: r.bill_id as string,
    amount: Number(r.amount_kobo),
    method: r.method as Payment["method"],
    receiptNo: r.receipt_no as string,
    paidOn: r.paid_on as string,
    recordedByName: r.recorded_by_name as string,
    note: (r.note as string) ?? undefined,
  };
}

function mapStaff(r: Row): Staff {
  return {
    id: r.id as string,
    schoolId: r.school_id as string,
    fullName: r.full_name as string,
    title: (r.title as string) ?? undefined,
    employmentType: (r.employment_type as Staff["employmentType"]) ?? "teaching",
    assignment: (r.assignment as string) ?? undefined,
    monthlySalary: Number(r.monthly_salary_kobo ?? 0),
    phone: (r.phone as string) ?? undefined,
    active: (r.active as boolean) ?? true,
  };
}

function mapAudit(r: Row): AuditEntry {
  return {
    id: r.id as string,
    actorName: (r.actor_name as string) ?? "Unknown",
    action: r.action as AuditEntry["action"],
    entity: r.entity as AuditEntry["entity"],
    entityId: (r.entity_id as string) ?? "",
    summary: r.summary as string,
    amount: r.amount_kobo == null ? null : Number(r.amount_kobo),
    createdAt: r.created_at as string,
  };
}

function mapSubject(r: Row): Subject {
  return { id: r.id as string, schoolId: r.school_id as string, name: r.name as string };
}

function mapIncome(r: Row): Income {
  return {
    id: r.id as string,
    schoolId: r.school_id as string,
    source: r.source as string,
    description: r.description as string,
    amount: Number(r.amount_kobo),
    receivedOn: r.received_on as string,
    method: r.method as Income["method"],
    note: (r.note as string) ?? undefined,
    recordedByName: r.recorded_by_name as string,
  };
}

function mapExpense(r: Row): Expense {
  return {
    id: r.id as string,
    schoolId: r.school_id as string,
    payee: r.payee as string,
    description: r.description as string,
    category: r.category as string,
    cadence: r.cadence as Expense["cadence"],
    amount: Number(r.amount_kobo),
    spentOn: r.spent_on as string,
    method: r.method as Expense["method"],
    staffId: (r.staff_id as string) ?? undefined,
    salaryPeriod: (r.salary_period as string) ?? undefined,
    recordedByName: r.recorded_by_name as string,
    note: (r.note as string) ?? undefined,
  };
}

function mapFeeItem(r: Row): FeeItem {
  return {
    id: r.id as string,
    schoolId: r.school_id as string,
    sessionId: r.session_id as string,
    term: r.term as TermName,
    level: r.level as string,
    name: r.name as string,
    amount: Number(r.amount_kobo),
    optional: (r.optional as boolean) ?? false,
  };
}

// --- context (school + current session) -------------------------------------

async function getContext(): Promise<{ school: School | null; session: Session | null }> {
  const client = sb();
  const { data: schoolRow } = await client.from("schools").select("*").limit(1).maybeSingle();
  const school = schoolRow ? mapSchool(schoolRow) : null;

  let session: Session | null = null;
  if (school?.currentSessionId) {
    const { data } = await client.from("sessions").select("*").eq("id", school.currentSessionId).maybeSingle();
    if (data) session = mapSession(data);
  }
  if (!session) {
    const { data } = await client.from("sessions").select("*").order("start_date", { ascending: false }).limit(1).maybeSingle();
    if (data) session = mapSession(data);
  }
  return { school, session };
}

/** Build a StudentAccount from a student row (+ joined class/guardian) and its bill. */
function buildAccount(studentRow: Row, billRow: Row | undefined, term: TermName, sessionId: string): StudentAccount {
  const student = mapStudent(studentRow);
  const cls = studentRow.classes as Row | null;
  const guardianRow = studentRow.guardians as Row | null;

  const lines = billRow
    ? ((billRow.bill_lines as Row[]) ?? []).map((l) => ({
        name: l.name as string,
        amount: Number(l.amount_kobo),
      }))
    : [];
  const discount = billRow ? Number(billRow.discount_kobo ?? 0) : 0;
  const payments = billRow ? ((billRow.payments as Row[]) ?? []).map(mapPayment) : [];

  const bill: Bill = {
    id: (billRow?.id as string) ?? "",
    schoolId: student.schoolId,
    studentId: student.id,
    sessionId,
    term,
    lines,
    discount,
    discountReason: (billRow?.discount_reason as string) ?? undefined,
    createdOn: (billRow?.created_on as string) ?? student.enrolledOn,
  };

  const billTotal = Math.max(0, lines.reduce((s, l) => s + l.amount, 0) - discount);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const outstanding = Math.max(0, billTotal - paid);
  const status: StudentAccount["status"] =
    !billRow || billTotal === 0 ? (paid > 0 ? "paid" : "unpaid") : paid <= 0 ? "unpaid" : outstanding <= 0 ? "paid" : "partial";

  return {
    student,
    className: (cls?.name as string) ?? "-",
    guardian: {
      id: (guardianRow?.id as string) ?? "",
      schoolId: student.schoolId,
      fullName: (guardianRow?.full_name as string) ?? "-",
      phone: (guardianRow?.phone as string) ?? "",
      altPhone: (guardianRow?.alt_phone as string) ?? undefined,
      email: (guardianRow?.email as string) ?? undefined,
      relationship: (guardianRow?.relationship as string) ?? undefined,
    },
    bill,
    billTotal,
    paid,
    outstanding,
    status,
    payments,
  };
}

async function loadAccounts(term: TermName): Promise<StudentAccount[]> {
  const client = sb();
  const { session } = await getContext();
  if (!session) return [];

  const { data: students } = await client
    .from("students")
    .select("*, classes(id,name,level), guardians(*)")
    .eq("status", "active");
  const { data: bills } = await client
    .from("bills")
    .select("*, bill_lines(*), payments(*)")
    .eq("session_id", session.id)
    .eq("term", term);

  const billByStudent = new Map<string, Row>();
  (bills ?? []).forEach((b) => billByStudent.set(b.student_id as string, b));

  return (students ?? []).map((s) =>
    buildAccount(s, billByStudent.get(s.id as string), term, session.id),
  );
}

// --- repository -------------------------------------------------------------

export const supabaseRepository: Repository = {
  async getSchool(): Promise<School> {
    const { school } = await getContext();
    if (!school) throw new Error("No school found for this account.");
    return school;
  },

  async getSession(): Promise<Session> {
    const { session } = await getContext();
    if (!session) throw new Error("No session set up yet.");
    return session;
  },

  async updateBankAccount(input): Promise<void> {
    const { school } = await getContext();
    if (!school) throw new Error("No school found for this account.");
    const { error } = await sb()
      .from("schools")
      .update({
        bank_account_number: input.accountNumber.trim(),
        bank_account_name: input.accountName.trim(),
        bank_name: input.bankName.trim(),
      })
      .eq("id", school.id);
    if (error) throw new Error(error.message);
  },

  async listUsers(): Promise<UserProfile[]> {
    const { data } = await sb().from("profiles").select("*");
    return (data ?? []).map((r) => ({
      id: r.id as string,
      schoolId: r.school_id as string,
      fullName: r.full_name as string,
      role: r.role as UserProfile["role"],
      phone: (r.phone as string) ?? undefined,
      email: (r.email as string) ?? undefined,
    }));
  },

  async listClasses(): Promise<SchoolClass[]> {
    const { data } = await sb().from("classes").select("*").order("level");
    return (data ?? []).map(mapClass);
  },

  async getDashboardStats(term: TermName): Promise<DashboardStats> {
    const accounts = await loadAccounts(term);
    return {
      term,
      studentCount: accounts.length,
      totalBilled: accounts.reduce((s, a) => s + a.billTotal, 0),
      totalCollected: accounts.reduce((s, a) => s + a.paid, 0),
      totalOutstanding: accounts.reduce((s, a) => s + a.outstanding, 0),
      debtorCount: accounts.filter((a) => a.outstanding > 0).length,
      fullyPaidCount: accounts.filter((a) => a.status === "paid").length,
      partialCount: accounts.filter((a) => a.status === "partial").length,
      unpaidCount: accounts.filter((a) => a.status === "unpaid").length,
      receiptCount: accounts.reduce((s, a) => s + a.payments.length, 0),
    };
  },

  async listStudentAccounts(term: TermName): Promise<StudentAccount[]> {
    const accounts = await loadAccounts(term);
    return accounts.sort((a, b) =>
      `${a.student.firstName} ${a.student.lastName}`.localeCompare(
        `${b.student.firstName} ${b.student.lastName}`,
      ),
    );
  },

  async listDebtors(term: TermName): Promise<StudentAccount[]> {
    const accounts = await loadAccounts(term);
    return accounts
      .filter((a) => a.outstanding > 0)
      .sort((a, b) => a.bill.createdOn.localeCompare(b.bill.createdOn));
  },

  async getStudentAccount(studentId: string, term: TermName): Promise<StudentAccount | null> {
    const client = sb();
    const { session } = await getContext();
    if (!session) return null;
    const { data: student } = await client
      .from("students")
      .select("*, classes(id,name,level), guardians(*)")
      .eq("id", studentId)
      .maybeSingle();
    if (!student) return null;
    const { data: bill } = await client
      .from("bills")
      .select("*, bill_lines(*), payments(*)")
      .eq("student_id", studentId)
      .eq("session_id", session.id)
      .eq("term", term)
      .maybeSingle();
    return buildAccount(student, bill ?? undefined, term, session.id);
  },

  async listStudents(): Promise<Student[]> {
    const { data } = await sb().from("students").select("*").order("last_name");
    return (data ?? []).map(mapStudent);
  },

  async recordPayment(input: RecordPaymentInput): Promise<Payment> {
    const client = sb();
    const { school, session } = await getContext();
    if (!school || !session) throw new Error("School not set up.");
    if (input.amount <= 0) throw new Error("Enter an amount greater than zero.");

    const { data: bill } = await client
      .from("bills")
      .select("id")
      .eq("student_id", input.studentId)
      .eq("session_id", session.id)
      .eq("term", input.term)
      .maybeSingle();
    if (!bill) throw new Error("This student has no bill for the term.");

    const { data: { user } } = await client.auth.getUser();

    // Next receipt number: continue from the highest existing for the school.
    const { count } = await client
      .from("payments")
      .select("id", { count: "exact", head: true });
    const seq = 1080 + (count ?? 0) + 1;
    const receiptNo = `${school.code}-${seq}`;

    const { data, error } = await client
      .from("payments")
      .insert({
        school_id: school.id,
        student_id: input.studentId,
        bill_id: bill.id,
        amount_kobo: input.amount,
        method: input.method,
        receipt_no: receiptNo,
        recorded_by: user?.id ?? null,
        recorded_by_name: input.recordedByName,
        note: input.note ?? null,
      })
      .select("*")
      .single();
    if (error || !data) {
      throw new Error("This payment couldn't be recorded. No money was affected. Please try again.");
    }
    return mapPayment(data);
  },

  async createStudent(input: CreateStudentInput): Promise<Student> {
    const client = sb();
    const { school, session } = await getContext();
    if (!school || !session) throw new Error("School not set up.");

    const { data: guardian, error: gErr } = await client
      .from("guardians")
      .insert({
        school_id: school.id,
        full_name: input.guardianName,
        phone: input.guardianPhone,
        relationship: input.guardianRelationship ?? null,
      })
      .select("id")
      .single();
    if (gErr || !guardian) throw new Error("Couldn't save the guardian's details.");

    const { count } = await client
      .from("students")
      .select("id", { count: "exact", head: true });
    const admissionNo = `${school.code}/${new Date().getFullYear()}/${String((count ?? 0) + 1).padStart(3, "0")}`;

    const { data: student, error: sErr } = await client
      .from("students")
      .insert({
        school_id: school.id,
        admission_no: admissionNo,
        first_name: input.firstName,
        last_name: input.lastName,
        other_name: input.otherName ?? null,
        gender: input.gender ?? null,
        date_of_birth: input.dateOfBirth ?? null,
        class_id: input.classId,
        guardian_id: guardian.id,
        status: "active",
      })
      .select("*")
      .single();
    if (sErr || !student) throw new Error("Couldn't save the student record.");

    // Bill this term. Prefer the class level's fee structure; fall back to the
    // manually typed term fee when no structure is set for that level yet.
    const { data: cls } = await client
      .from("classes")
      .select("level")
      .eq("id", input.classId)
      .maybeSingle();
    const level = (cls?.level as string) ?? "";

    const { data: feeItems } = await client
      .from("fee_items")
      .select("name, amount_kobo")
      .eq("session_id", session.id)
      .eq("term", school.currentTerm)
      .eq("level", level);

    let lines: { name: string; amount_kobo: number }[] = [];
    if (input.billLines && input.billLines.length > 0) {
      lines = input.billLines
        .filter((l) => l.name.trim() !== "" && l.amountKobo >= 0)
        .map((l) => ({ name: l.name.trim(), amount_kobo: l.amountKobo }));
    } else if (feeItems && feeItems.length > 0) {
      lines = feeItems.map((f) => ({
        name: f.name as string,
        amount_kobo: Number(f.amount_kobo),
      }));
    } else if (input.termFeeKobo > 0) {
      lines = [{ name: "Term fee", amount_kobo: input.termFeeKobo }];
    }

    if (lines.length > 0) {
      const { data: bill } = await client
        .from("bills")
        .insert({
          school_id: school.id,
          student_id: student.id,
          session_id: session.id,
          term: school.currentTerm,
          discount_kobo: Math.max(0, input.discountKobo ?? 0),
          discount_reason: input.discountReason ?? null,
        })
        .select("id")
        .single();
      if (bill) {
        await client
          .from("bill_lines")
          .insert(lines.map((l) => ({ bill_id: bill.id, ...l })));
      }
    }

    return mapStudent(student);
  },

  async importStudents(rows: ImportStudentRow[]): Promise<ImportResult> {
    const client = sb();
    const { school } = await getContext();
    if (!school) throw new Error("School not set up.");
    const { data: classes } = await client.from("classes").select("id,name,level");
    const classList = (classes ?? []) as Row[];

    const results: ImportRowResult[] = [];
    let imported = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1;
      const name = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim();
      const cls = classList.find(
        (c) =>
          (c.name as string)?.toLowerCase() === (row.className ?? "").trim().toLowerCase() ||
          (c.level as string)?.toLowerCase() === (row.className ?? "").trim().toLowerCase(),
      );
      if (!row.firstName || !row.lastName) {
        results.push({ rowNumber, ok: false, studentName: name, error: "Missing first or last name." });
        continue;
      }
      if (!cls) {
        results.push({ rowNumber, ok: false, studentName: name, error: `Class "${row.className}" not found.` });
        continue;
      }
      if (!row.guardianPhone) {
        results.push({ rowNumber, ok: false, studentName: name, error: "Missing guardian phone." });
        continue;
      }
      try {
        await this.createStudent({
          firstName: row.firstName,
          lastName: row.lastName,
          otherName: row.otherName,
          gender: row.gender?.toLowerCase() === "male" ? "male" : row.gender?.toLowerCase() === "female" ? "female" : undefined,
          classId: cls.id as string,
          termFeeKobo: 0,
          guardianName: row.guardianName || "Guardian",
          guardianPhone: row.guardianPhone,
          guardianRelationship: row.guardianRelationship,
        });
        imported += 1;
        results.push({ rowNumber, ok: true, studentName: name });
      } catch {
        results.push({ rowNumber, ok: false, studentName: name, error: "Couldn't save this row." });
      }
    }
    return { imported, failed: rows.length - imported, results };
  },

  // --- Money out ------------------------------------------------------------

  async listExpenses(filter?: DateFilter): Promise<Expense[]> {
    const client = sb();
    let q = client.from("expenses").select("*").order("spent_on", { ascending: false });
    if (filter?.from) q = q.gte("spent_on", filter.from);
    if (filter?.to) q = q.lte("spent_on", filter.to);
    const { data } = await q;
    return (data ?? []).map(mapExpense);
  },

  async createExpense(input: CreateExpenseInput): Promise<Expense> {
    const client = sb();
    const { school, session } = await getContext();
    if (!school) throw new Error("School not set up.");
    if (input.amountKobo <= 0) throw new Error("Enter an amount greater than zero.");
    const { data: { user } } = await client.auth.getUser();

    const { data, error } = await client
      .from("expenses")
      .insert({
        school_id: school.id,
        session_id: session?.id ?? null,
        payee: input.payee,
        description: input.description,
        category: input.category,
        cadence: input.cadence,
        amount_kobo: input.amountKobo,
        spent_on: input.spentOn,
        method: input.method,
        recorded_by: user?.id ?? null,
        recorded_by_name: input.recordedByName,
        note: input.note ?? null,
      })
      .select("*")
      .single();
    if (error || !data) {
      throw new Error("This expense couldn't be saved. No money was affected. Please try again.");
    }
    return mapExpense(data);
  },

  async updateExpense(id: string, patch: CreateExpenseInput): Promise<Expense> {
    const client = sb();
    if (patch.amountKobo <= 0) throw new Error("Enter an amount greater than zero.");
    const { data, error } = await client
      .from("expenses")
      .update({
        payee: patch.payee,
        description: patch.description,
        category: patch.category,
        cadence: patch.cadence,
        amount_kobo: patch.amountKobo,
        spent_on: patch.spentOn,
        method: patch.method,
        note: patch.note ?? null,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) throw new Error("This expense couldn't be updated.");
    return mapExpense(data);
  },

  async deleteExpense(id: string): Promise<void> {
    const { error } = await sb().from("expenses").delete().eq("id", id);
    if (error) throw new Error("This expense couldn't be deleted.");
  },

  async listIncome(filter?: DateFilter): Promise<Income[]> {
    const client = sb();
    let q = client.from("income").select("*").order("received_on", { ascending: false });
    if (filter?.from) q = q.gte("received_on", filter.from);
    if (filter?.to) q = q.lte("received_on", filter.to);
    const { data } = await q;
    return (data ?? []).map(mapIncome);
  },

  async createIncome(input: CreateIncomeInput): Promise<Income> {
    const client = sb();
    const { school, session } = await getContext();
    if (!school) throw new Error("School not set up.");
    if (input.amountKobo <= 0) throw new Error("Enter an amount greater than zero.");
    const { data: { user } } = await client.auth.getUser();
    const { data, error } = await client
      .from("income")
      .insert({
        school_id: school.id,
        session_id: session?.id ?? null,
        source: input.source,
        description: input.description,
        amount_kobo: input.amountKobo,
        received_on: input.receivedOn,
        method: input.method,
        recorded_by: user?.id ?? null,
        recorded_by_name: input.recordedByName,
        note: input.note ?? null,
      })
      .select("*")
      .single();
    if (error || !data) throw new Error("This income couldn't be saved. Please try again.");
    return mapIncome(data);
  },

  async updateIncome(id: string, patch: CreateIncomeInput): Promise<Income> {
    const client = sb();
    if (patch.amountKobo <= 0) throw new Error("Enter an amount greater than zero.");
    const { data, error } = await client
      .from("income")
      .update({
        source: patch.source,
        description: patch.description,
        amount_kobo: patch.amountKobo,
        received_on: patch.receivedOn,
        method: patch.method,
        note: patch.note ?? null,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) throw new Error("This income couldn't be updated.");
    return mapIncome(data);
  },

  async deleteIncome(id: string): Promise<void> {
    const { error } = await sb().from("income").delete().eq("id", id);
    if (error) throw new Error("This income couldn't be deleted.");
  },

  async listIncomeView(filter?: DateFilter): Promise<IncomeRow[]> {
    const client = sb();
    let pq = client.from("payments").select("*").order("paid_on", { ascending: false });
    if (filter?.from) pq = pq.gte("paid_on", filter.from);
    if (filter?.to) pq = pq.lte("paid_on", filter.to);
    let iq = client.from("income").select("*").order("received_on", { ascending: false });
    if (filter?.from) iq = iq.gte("received_on", filter.from);
    if (filter?.to) iq = iq.lte("received_on", filter.to);
    const [{ data: payments }, { data: incomeRows }] = await Promise.all([pq, iq]);

    const studentIds = [...new Set((payments ?? []).map((p) => p.student_id as string))];
    const nameById = new Map<string, string>();
    if (studentIds.length) {
      const { data: students } = await client
        .from("students")
        .select("id,first_name,last_name")
        .in("id", studentIds);
      (students ?? []).forEach((s) =>
        nameById.set(s.id as string, `${s.first_name} ${s.last_name}`),
      );
    }

    const rows: IncomeRow[] = [];
    for (const p of payments ?? []) {
      const pay = mapPayment(p);
      rows.push({
        kind: "fee",
        id: pay.id,
        date: pay.paidOn,
        source: "School fee",
        description: nameById.get(pay.studentId) ?? "Student",
        amount: pay.amount,
        method: pay.method,
        recordedByName: pay.recordedByName,
        studentId: pay.studentId,
      });
    }
    for (const row of incomeRows ?? []) {
      const inc = mapIncome(row);
      rows.push({
        kind: "other",
        id: inc.id,
        date: inc.receivedOn,
        source: inc.source,
        description: inc.description,
        amount: inc.amount,
        method: inc.method,
        recordedByName: inc.recordedByName,
      });
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  },

  async listAuditLog(filter?: DateFilter): Promise<AuditEntry[]> {
    const client = sb();
    let q = client.from("audit_log").select("*").order("created_at", { ascending: false });
    if (filter?.from) q = q.gte("created_at", filter.from);
    if (filter?.to) q = q.lte("created_at", `${filter.to}T23:59:59`);
    const { data } = await q;
    return (data ?? []).map(mapAudit);
  },

  async listSubjects(): Promise<Subject[]> {
    const { data } = await sb().from("subjects").select("*").order("name");
    return (data ?? []).map(mapSubject);
  },

  async ensureDefaultSubjects(): Promise<void> {
    const client = sb();
    const { school } = await getContext();
    if (!school) return;
    const { count } = await client.from("subjects").select("id", { count: "exact", head: true });
    if (count && count > 0) return;
    await client.from("subjects").insert(
      SUBJECT_NAMES.map((name) => ({ school_id: school.id, name })),
    );
  },

  async saveAssessments(input: SaveAssessmentsInput): Promise<void> {
    const client = sb();
    const { school, session } = await getContext();
    if (!school) throw new Error("School not set up.");
    const { data: { user } } = await client.auth.getUser();
    const payload = input.scores.map((s) => ({
      school_id: school.id,
      student_id: s.studentId,
      subject_id: input.subjectId,
      session_id: session?.id ?? null,
      term: input.term,
      ca1: s.ca1,
      ca2: s.ca2,
      exam: s.exam,
      recorded_by: user?.id ?? null,
      recorded_by_name: input.recordedByName,
    }));
    const { error } = await client
      .from("assessments")
      .upsert(payload, { onConflict: "student_id,subject_id,session_id,term" });
    if (error) throw new Error("These scores couldn't be saved. Please try again.");
  },

  async listClassRecordSummaries(term: TermName): Promise<ClassRecordSummary[]> {
    const client = sb();
    const [{ data: classes }, { data: students }, { data: rows }] = await Promise.all([
      client.from("classes").select("id,name"),
      client.from("students").select("id,class_id"),
      client.from("assessments").select("student_id,ca1,ca2,exam").eq("term", term),
    ]);
    return (classes ?? []).map((c) => {
      const ids = new Set((students ?? []).filter((s) => s.class_id === c.id).map((s) => s.id));
      const mine = (rows ?? []).filter((r) => ids.has(r.student_id as string));
      const ca = mine.filter((r) => r.ca1 != null && r.ca2 != null).map((r) => Number(r.ca1) + Number(r.ca2));
      const ex = mine.filter((r) => r.exam != null).map((r) => Number(r.exam));
      return {
        classId: c.id as string,
        className: c.name as string,
        studentCount: ids.size,
        avgCa: meanOf(ca),
        avgExam: meanOf(ex),
      };
    });
  },

  async listSubjectAverages(classId: string, term: TermName): Promise<SubjectAverageRow[]> {
    const client = sb();
    const [{ data: students }, { data: subjects }] = await Promise.all([
      client.from("students").select("id").eq("class_id", classId),
      client.from("subjects").select("id,name").order("name"),
    ]);
    const ids = (students ?? []).map((s) => s.id as string);
    if (ids.length === 0) return [];
    const { data: rows } = await client
      .from("assessments").select("subject_id,ca1,ca2,exam").eq("term", term).in("student_id", ids);
    return (subjects ?? []).map((subj) => {
      const mine = (rows ?? []).filter((r) => r.subject_id === subj.id);
      const totals = mine
        .map((r) => componentTotal(numOrNull(r.ca1), numOrNull(r.ca2), numOrNull(r.exam)))
        .filter((t): t is number => t != null);
      return {
        subjectId: subj.id as string,
        subjectName: subj.name as string,
        avgCa1: meanOf(mine.filter((r) => r.ca1 != null).map((r) => Number(r.ca1))),
        avgCa2: meanOf(mine.filter((r) => r.ca2 != null).map((r) => Number(r.ca2))),
        avgExam: meanOf(mine.filter((r) => r.exam != null).map((r) => Number(r.exam))),
        avgTotal: meanOf(totals),
      };
    }).filter((r) => r.avgTotal != null);
  },

  async listStudentSubjectScores(classId: string, subjectId: string, term: TermName): Promise<StudentSubjectScore[]> {
    const client = sb();
    const { data: students } = await client
      .from("students").select("id,first_name,last_name").eq("class_id", classId);
    const ids = (students ?? []).map((s) => s.id as string);
    const { data: rows } = ids.length
      ? await client.from("assessments").select("*").eq("subject_id", subjectId).eq("term", term).in("student_id", ids)
      : { data: [] as Row[] };
    const byStudent = new Map((rows ?? []).map((r) => [r.student_id as string, r]));
    return (students ?? []).map((s) => {
      const r = byStudent.get(s.id as string);
      const ca1 = r ? numOrNull(r.ca1) : null;
      const ca2 = r ? numOrNull(r.ca2) : null;
      const exam = r ? numOrNull(r.exam) : null;
      const total = componentTotal(ca1, ca2, exam);
      return {
        studentId: s.id as string,
        studentName: `${s.first_name} ${s.last_name}`,
        ca1, ca2, exam, total, grade: gradeFor(total),
      };
    });
  },

  async listClassStudentAverages(classId: string, term: TermName) {
    const client = sb();
    const { data: students } = await client
      .from("students").select("id,first_name,last_name").eq("class_id", classId);
    const ids = (students ?? []).map((s) => s.id as string);
    const { data: rows } = ids.length
      ? await client.from("assessments").select("student_id,ca1,ca2,exam").eq("term", term).in("student_id", ids)
      : { data: [] as Row[] };
    return (students ?? []).map((s) => {
      const totals = (rows ?? [])
        .filter((r) => r.student_id === s.id)
        .map((r) => componentTotal(numOrNull(r.ca1), numOrNull(r.ca2), numOrNull(r.exam)))
        .filter((t): t is number => t != null);
      return { studentId: s.id as string, studentName: `${s.first_name} ${s.last_name}`, average: meanOf(totals) };
    });
  },

  async getStudentReport(studentId: string, term: TermName): Promise<StudentReport> {
    const client = sb();
    const [{ data: student }, { data: subjects }, { data: rows }] = await Promise.all([
      client.from("students").select("id,first_name,last_name,class_id").eq("id", studentId).maybeSingle(),
      client.from("subjects").select("id,name"),
      client.from("assessments").select("*").eq("student_id", studentId).eq("term", term),
    ]);
    let className = "-";
    if (student?.class_id) {
      const { data: cls } = await client.from("classes").select("name").eq("id", student.class_id).maybeSingle();
      className = (cls?.name as string) ?? "-";
    }
    const nameOf = new Map((subjects ?? []).map((s) => [s.id as string, s.name as string]));
    const reportRows = (rows ?? []).map((r) => {
      const total = componentTotal(numOrNull(r.ca1), numOrNull(r.ca2), numOrNull(r.exam));
      return {
        subjectId: r.subject_id as string,
        subjectName: nameOf.get(r.subject_id as string) ?? "Subject",
        ca1: numOrNull(r.ca1), ca2: numOrNull(r.ca2), exam: numOrNull(r.exam),
        total, grade: gradeFor(total),
      };
    });
    const totals = reportRows.map((r) => r.total).filter((t): t is number => t != null);
    return {
      studentId,
      studentName: student ? `${student.first_name} ${student.last_name}` : "Student",
      className, term, rows: reportRows, overallAverage: meanOf(totals),
    };
  },

  async importAssessments(term, rows, recordedByName): Promise<AssessmentImportResult> {
    const client = sb();
    const { school, session } = await getContext();
    if (!school) throw new Error("School not set up.");
    if (rows.length === 0) return { updated: 0, skipped: 0, errors: [] };
    const { data: { user } } = await client.auth.getUser();
    const payload = rows.map((r) => ({
      school_id: school.id, student_id: r.studentId, subject_id: r.subjectId,
      session_id: session?.id ?? null, term, ca1: r.ca1, ca2: r.ca2, exam: r.exam,
      recorded_by: user?.id ?? null, recorded_by_name: recordedByName,
    }));
    const { error } = await client
      .from("assessments").upsert(payload, { onConflict: "student_id,subject_id,session_id,term" });
    if (error) throw new Error("These scores couldn't be saved. Please try again.");
    return { updated: rows.length, skipped: 0, errors: [] };
  },

  async listStaff(): Promise<Staff[]> {
    const { data } = await sb().from("staff").select("*").order("full_name");
    return (data ?? []).map(mapStaff);
  },

  async createStaff(input: CreateStaffInput): Promise<Staff> {
    const client = sb();
    const { school } = await getContext();
    if (!school) throw new Error("School not set up.");
    const { data, error } = await client
      .from("staff")
      .insert({
        school_id: school.id,
        full_name: input.fullName,
        title: input.title ?? null,
        employment_type: input.employmentType,
        assignment: input.assignment ?? null,
        monthly_salary_kobo: input.monthlySalaryKobo,
        phone: input.phone ?? null,
      })
      .select("*")
      .single();
    if (error || !data) throw new Error("Couldn't save this staff member.");
    return mapStaff(data);
  },

  async updateStaff(id: string, patch: CreateStaffInput): Promise<Staff> {
    const { data, error } = await sb()
      .from("staff")
      .update({
        full_name: patch.fullName,
        title: patch.title ?? null,
        employment_type: patch.employmentType,
        assignment: patch.assignment ?? null,
        monthly_salary_kobo: patch.monthlySalaryKobo,
        phone: patch.phone ?? null,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) throw new Error("Couldn't update this staff member.");
    return mapStaff(data);
  },

  async setStaffActive(id: string, active: boolean): Promise<void> {
    const { error } = await sb().from("staff").update({ active }).eq("id", id);
    if (error) throw new Error("Couldn't update this staff member.");
  },

  async previewPayroll(period: string): Promise<PayrollPreview> {
    const client = sb();
    const { data: staffRows } = await client
      .from("staff")
      .select("*")
      .eq("active", true)
      .order("full_name");
    const { data: paidRows } = await client
      .from("expenses")
      .select("staff_id")
      .eq("salary_period", period);
    const paid = new Set((paidRows ?? []).map((r) => r.staff_id as string));

    const rows = (staffRows ?? []).map((r) => {
      const staff = mapStaff(r);
      return { staff, alreadyPaid: paid.has(staff.id) };
    });
    const totalToPayKobo = rows
      .filter((r) => !r.alreadyPaid)
      .reduce((sum, r) => sum + r.staff.monthlySalary, 0);
    return { period, rows, totalToPayKobo };
  },

  async runPayroll(period: string, recordedByName: string): Promise<PayrollResult> {
    const client = sb();
    const { school, session } = await getContext();
    if (!school) throw new Error("School not set up.");
    const { data: { user } } = await client.auth.getUser();

    const preview = await this.previewPayroll(period);
    const toPay = preview.rows.filter(
      (r) => !r.alreadyPaid && r.staff.monthlySalary > 0,
    );
    if (toPay.length === 0) {
      return { created: 0, skipped: preview.rows.length, totalPaidKobo: 0 };
    }

    const rows = toPay.map((r) => ({
      school_id: school.id,
      session_id: session?.id ?? null,
      payee: r.staff.fullName,
      description: `Salary: ${period}`,
      category: "Salary",
      cadence: "monthly" as const,
      amount_kobo: r.staff.monthlySalary,
      spent_on: `${period}-28`,
      method: "transfer" as const,
      staff_id: r.staff.id,
      salary_period: period,
      recorded_by: user?.id ?? null,
      recorded_by_name: recordedByName,
    }));

    // Ignore-duplicates guards against a concurrent run double-paying: the
    // unique (staff_id, salary_period) index rejects repeats.
    const { data, error } = await client
      .from("expenses")
      .upsert(rows, { onConflict: "staff_id,salary_period", ignoreDuplicates: true })
      .select("amount_kobo");
    if (error) throw new Error("Payroll couldn't be completed. Please try again.");

    const created = data?.length ?? 0;
    const totalPaidKobo = (data ?? []).reduce((s, r) => s + Number(r.amount_kobo), 0);
    return { created, skipped: preview.rows.length - created, totalPaidKobo };
  },

  async getLedger(filter?: DateFilter): Promise<LedgerDay[]> {
    const client = sb();

    let pq = client.from("payments").select("*").order("paid_on", { ascending: false });
    if (filter?.from) pq = pq.gte("paid_on", filter.from);
    if (filter?.to) pq = pq.lte("paid_on", filter.to);

    let eq = client.from("expenses").select("*").order("spent_on", { ascending: false });
    if (filter?.from) eq = eq.gte("spent_on", filter.from);
    if (filter?.to) eq = eq.lte("spent_on", filter.to);

    let iq = client.from("income").select("*").order("received_on", { ascending: false });
    if (filter?.from) iq = iq.gte("received_on", filter.from);
    if (filter?.to) iq = iq.lte("received_on", filter.to);

    const [{ data: payments }, { data: expenses }, { data: incomeRows }] = await Promise.all([pq, eq, iq]);

    // Resolve student names for payment rows in one query.
    const studentIds = [...new Set((payments ?? []).map((p) => p.student_id as string))];
    const nameById = new Map<string, string>();
    if (studentIds.length) {
      const { data: students } = await client
        .from("students")
        .select("id,first_name,last_name")
        .in("id", studentIds);
      (students ?? []).forEach((s) =>
        nameById.set(s.id as string, `${s.first_name} ${s.last_name}`),
      );
    }

    const entries: LedgerEntry[] = [];
    for (const p of payments ?? []) {
      const pay = mapPayment(p);
      entries.push({
        id: pay.id,
        date: pay.paidOn,
        kind: "payment",
        direction: "in",
        title: nameById.get(pay.studentId) ?? "Student",
        subtitle: `${pay.receiptNo} · ${pay.method}`,
        amount: pay.amount,
        method: pay.method,
        reference: pay.studentId,
      });
    }
    for (const row of expenses ?? []) {
      const e = mapExpense(row);
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
    for (const row of incomeRows ?? []) {
      const inc = mapIncome(row);
      entries.push({
        id: inc.id,
        date: inc.receivedOn,
        kind: "income",
        direction: "in",
        title: inc.source,
        subtitle: `${inc.description} · ${inc.method}`,
        amount: inc.amount,
        method: inc.method,
        reference: inc.id,
      });
    }
    return groupLedger(entries);
  },

  // --- Fee structure & discounts --------------------------------------------

  async listFeeItems(term: TermName): Promise<FeeItem[]> {
    const client = sb();
    const { session } = await getContext();
    if (!session) return [];
    const { data } = await client
      .from("fee_items")
      .select("*")
      .eq("session_id", session.id)
      .eq("term", term)
      .order("level");
    return (data ?? []).map(mapFeeItem);
  },

  async saveFeeStructure(
    level: string,
    term: TermName,
    items: FeeLineInput[],
  ): Promise<void> {
    const client = sb();
    const { school, session } = await getContext();
    if (!school || !session) throw new Error("School not set up.");

    // Replace the level+term structure atomically enough for our needs: delete
    // then insert. A student's existing bill lines are snapshots and untouched.
    const { error: delErr } = await client
      .from("fee_items")
      .delete()
      .eq("session_id", session.id)
      .eq("term", term)
      .eq("level", level);
    if (delErr) throw new Error("Couldn't update the fee structure.");

    const rows = items
      .filter((i) => i.name.trim() && i.amountKobo >= 0)
      .map((i) => ({
        school_id: school.id,
        session_id: session.id,
        term,
        level,
        name: i.name.trim(),
        amount_kobo: i.amountKobo,
        optional: i.optional ?? false,
      }));
    if (rows.length > 0) {
      const { error } = await client.from("fee_items").insert(rows);
      if (error) throw new Error("Couldn't save the fee structure.");
    }
  },

  async generateBill(studentId: string, term: TermName): Promise<void> {
    const client = sb();
    const { school, session } = await getContext();
    if (!school || !session) throw new Error("School not set up.");

    const { data: existing } = await client
      .from("bills")
      .select("id")
      .eq("student_id", studentId)
      .eq("session_id", session.id)
      .eq("term", term)
      .maybeSingle();
    if (existing) return; // never overwrite a student's history

    const { data: student } = await client
      .from("students")
      .select("class_id")
      .eq("id", studentId)
      .maybeSingle();
    const { data: cls } = await client
      .from("classes")
      .select("level")
      .eq("id", (student?.class_id as string) ?? "")
      .maybeSingle();
    const level = (cls?.level as string) ?? "";

    const { data: feeItems } = await client
      .from("fee_items")
      .select("name, amount_kobo")
      .eq("session_id", session.id)
      .eq("term", term)
      .eq("level", level);
    if (!feeItems || feeItems.length === 0) return; // nothing to bill yet

    const { data: bill } = await client
      .from("bills")
      .insert({
        school_id: school.id,
        student_id: studentId,
        session_id: session.id,
        term,
      })
      .select("id")
      .single();
    if (bill) {
      await client.from("bill_lines").insert(
        feeItems.map((f) => ({
          bill_id: bill.id,
          name: f.name as string,
          amount_kobo: Number(f.amount_kobo),
        })),
      );
    }
  },

  async setStudentDiscount(
    studentId: string,
    term: TermName,
    discountKobo: number,
    reason?: string,
  ): Promise<void> {
    const client = sb();
    const { school, session } = await getContext();
    if (!school || !session) throw new Error("School not set up.");
    if (discountKobo < 0) throw new Error("A discount can't be negative.");

    const { data: bill } = await client
      .from("bills")
      .select("id")
      .eq("student_id", studentId)
      .eq("session_id", session.id)
      .eq("term", term)
      .maybeSingle();
    if (!bill) throw new Error("This student has no bill for the term yet.");

    const { error } = await client
      .from("bills")
      .update({ discount_kobo: discountKobo, discount_reason: reason ?? null })
      .eq("id", bill.id);
    if (error) throw new Error("Couldn't save the discount.");
  },

  async importFeeStructure(
    term: TermName,
    rows: FeeTemplateRow[],
  ): Promise<FeeStructureImportResult> {
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

  async updateBillLines(
    studentId: string,
    term: TermName,
    lines: BillLineInput[],
  ): Promise<void> {
    const client = sb();
    const { session } = await getContext();
    if (!session) throw new Error("School not set up.");

    const { data: bill } = await client
      .from("bills")
      .select("id, discount_kobo")
      .eq("student_id", studentId)
      .eq("session_id", session.id)
      .eq("term", term)
      .maybeSingle();
    if (!bill) throw new Error("This student has no bill for the term yet.");

    const clean = lines
      .filter((l) => l.name.trim() !== "" && l.amountKobo >= 0)
      .map((l) => ({ name: l.name.trim(), amount_kobo: l.amountKobo }));
    if (clean.length === 0) throw new Error("A bill needs at least one item.");

    const { data: payments } = await client
      .from("payments")
      .select("amount_kobo")
      .eq("bill_id", bill.id);
    const paid = (payments ?? []).reduce(
      (s, p) => s + Number(p.amount_kobo),
      0,
    );
    const newTotal =
      clean.reduce((s, l) => s + l.amount_kobo, 0) -
      Number(bill.discount_kobo ?? 0);
    if (newTotal < paid) {
      throw new Error("New bill total is less than what has already been paid.");
    }

    // Snapshot lines are replaced wholesale: clear then insert.
    const { error: delErr } = await client
      .from("bill_lines")
      .delete()
      .eq("bill_id", bill.id);
    if (delErr) throw new Error("Couldn't update the bill.");
    const { error: insErr } = await client
      .from("bill_lines")
      .insert(clean.map((l) => ({ bill_id: bill.id, ...l })));
    if (insErr) throw new Error("Couldn't save the bill items.");
  },
};
