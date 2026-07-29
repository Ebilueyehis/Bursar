import { createClient } from "@/lib/supabase/client";
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
import type {
  CreateStudentInput,
  DashboardStats,
  ImportResult,
  ImportRowResult,
  ImportStudentRow,
  RecordPaymentInput,
  Repository,
} from "@/lib/data/repository";

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
    createdOn: (billRow?.created_on as string) ?? student.enrolledOn,
  };

  const billTotal = Math.max(0, lines.reduce((s, l) => s + l.amount, 0) - discount);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const outstanding = Math.max(0, billTotal - paid);
  const status: StudentAccount["status"] =
    !billRow || billTotal === 0 ? (paid > 0 ? "paid" : "unpaid") : paid <= 0 ? "unpaid" : outstanding <= 0 ? "paid" : "partial";

  return {
    student,
    className: (cls?.name as string) ?? "—",
    guardian: {
      id: (guardianRow?.id as string) ?? "",
      schoolId: student.schoolId,
      fullName: (guardianRow?.full_name as string) ?? "—",
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

    // Create this term's bill from the provided term fee (a single line).
    if (input.termFeeKobo > 0) {
      const { data: bill } = await client
        .from("bills")
        .insert({
          school_id: school.id,
          student_id: student.id,
          session_id: session.id,
          term: school.currentTerm,
        })
        .select("id")
        .single();
      if (bill) {
        await client.from("bill_lines").insert({
          bill_id: bill.id,
          name: "Term fee",
          amount_kobo: input.termFeeKobo,
        });
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
};
