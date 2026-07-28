import type {
  Bill,
  FeeItem,
  Guardian,
  Payment,
  School,
  SchoolClass,
  Session,
  Student,
  UserProfile,
} from "@/lib/domain/types";
import { nairaToKobo } from "@/lib/money";

/**
 * Realistic Nigerian seed data for a demo school ("Tejuosho Group of Schools").
 * Used by the mock repository so the app is fully explorable before Supabase is
 * connected. Amounts are typical of a small/medium private school.
 */

export const SESSION: Session = {
  id: "sess-2024",
  schoolId: "sch-1",
  name: "2024/2025",
  startDate: "2024-09-16",
  endDate: "2025-07-25",
};

export const SCHOOL: School = {
  id: "sch-1",
  name: "Tejuosho Group of Schools",
  code: "TJH",
  address: "12 Adeniran Ogunsanya St, Surulere, Lagos",
  phone: "0803 000 0000",
  currentSessionId: SESSION.id,
  currentTerm: "first",
};

export const USERS: UserProfile[] = [
  {
    id: "u-prop",
    schoolId: "sch-1",
    fullName: "Mrs. Adunni Bello",
    role: "proprietor",
    phone: "0803 111 1111",
    email: "principal@tejuosho.ng",
  },
  {
    id: "u-bursar",
    schoolId: "sch-1",
    fullName: "Mr. Emeka Okoro",
    role: "bursar",
    phone: "0806 222 2222",
    email: "bursar@tejuosho.ng",
  },
  {
    id: "u-teacher",
    schoolId: "sch-1",
    fullName: "Miss Halima Yusuf",
    role: "teacher",
    phone: "0809 333 3333",
  },
];

const LEVELS = ["Primary 3", "Primary 5", "JSS 1", "JSS 2", "SSS 1"] as const;

export const CLASSES: SchoolClass[] = LEVELS.map((level, i) => ({
  id: `cls-${i}`,
  schoolId: "sch-1",
  level,
  name: `${level}A`,
}));

/** Tuition scales up by level; PTA + development levies are flat. */
function tuitionFor(level: string): number {
  if (level.startsWith("Primary")) return 45000;
  if (level.startsWith("JSS")) return 60000;
  return 75000; // SSS
}

export const FEE_ITEMS: FeeItem[] = LEVELS.flatMap((level, i) => [
  {
    id: `fi-${i}-t`,
    schoolId: "sch-1",
    sessionId: SESSION.id,
    term: "first",
    level,
    name: "Tuition",
    amount: nairaToKobo(tuitionFor(level)),
  },
  {
    id: `fi-${i}-p`,
    schoolId: "sch-1",
    sessionId: SESSION.id,
    term: "first",
    level,
    name: "PTA levy",
    amount: nairaToKobo(5000),
  },
  {
    id: `fi-${i}-d`,
    schoolId: "sch-1",
    sessionId: SESSION.id,
    term: "first",
    level,
    name: "Development levy",
    amount: nairaToKobo(10000),
  },
]);

// --- Students, guardians, bills, payments -----------------------------------

interface SeedRow {
  first: string;
  last: string;
  gender: "male" | "female";
  classIdx: number;
  guardian: string;
  guardianPhone: string;
  relationship: string;
  /** Fraction of the term bill already paid: 1 = cleared, 0 = nothing. */
  paidFraction: number;
  /** Days ago the bill was raised — larger = older debt (drives ordering). */
  billAgeDays: number;
}

const ROWS: SeedRow[] = [
  { first: "Tunde", last: "Okafor", gender: "male", classIdx: 2, guardian: "Mr. Chidi Okafor", guardianPhone: "08030000011", relationship: "Father", paidFraction: 0, billAgeDays: 54 },
  { first: "Aisha", last: "Bello", gender: "female", classIdx: 0, guardian: "Mrs. Zainab Bello", guardianPhone: "08030000012", relationship: "Mother", paidFraction: 0.4, billAgeDays: 54 },
  { first: "Chinaza", last: "Eze", gender: "female", classIdx: 3, guardian: "Mr. Ifeanyi Eze", guardianPhone: "08030000013", relationship: "Father", paidFraction: 1, billAgeDays: 50 },
  { first: "Bolu", last: "Adeyemi", gender: "male", classIdx: 4, guardian: "Mrs. Funke Adeyemi", guardianPhone: "08030000014", relationship: "Mother", paidFraction: 0, billAgeDays: 48 },
  { first: "Ngozi", last: "Nwosu", gender: "female", classIdx: 1, guardian: "Mr. Emeka Nwosu", guardianPhone: "08030000015", relationship: "Father", paidFraction: 0.5, billAgeDays: 47 },
  { first: "Yusuf", last: "Ibrahim", gender: "male", classIdx: 2, guardian: "Alhaji Musa Ibrahim", guardianPhone: "08030000016", relationship: "Father", paidFraction: 1, billAgeDays: 44 },
  { first: "Blessing", last: "Ojo", gender: "female", classIdx: 0, guardian: "Mrs. Grace Ojo", guardianPhone: "08030000017", relationship: "Mother", paidFraction: 0, billAgeDays: 40 },
  { first: "David", last: "Balogun", gender: "male", classIdx: 3, guardian: "Mr. Sola Balogun", guardianPhone: "08030000018", relationship: "Father", paidFraction: 0.75, billAgeDays: 38 },
  { first: "Fatima", last: "Sanni", gender: "female", classIdx: 4, guardian: "Mrs. Rukayat Sanni", guardianPhone: "08030000019", relationship: "Mother", paidFraction: 1, billAgeDays: 35 },
  { first: "Emmanuel", last: "Udo", gender: "male", classIdx: 1, guardian: "Mr. Bassey Udo", guardianPhone: "08030000020", relationship: "Father", paidFraction: 0, billAgeDays: 33 },
  { first: "Zainab", last: "Lawal", gender: "female", classIdx: 2, guardian: "Mrs. Aisha Lawal", guardianPhone: "08030000021", relationship: "Mother", paidFraction: 0.3, billAgeDays: 30 },
  { first: "Precious", last: "Obi", gender: "female", classIdx: 0, guardian: "Mr. Kingsley Obi", guardianPhone: "08030000022", relationship: "Father", paidFraction: 1, billAgeDays: 28 },
  { first: "Ibrahim", last: "Musa", gender: "male", classIdx: 3, guardian: "Mallam Sani Musa", guardianPhone: "08030000023", relationship: "Father", paidFraction: 0, billAgeDays: 24 },
  { first: "Grace", last: "Adeleke", gender: "female", classIdx: 4, guardian: "Mrs. Toyin Adeleke", guardianPhone: "08030000024", relationship: "Mother", paidFraction: 0.6, billAgeDays: 20 },
  { first: "Samuel", last: "Igwe", gender: "male", classIdx: 1, guardian: "Mr. Obinna Igwe", guardianPhone: "08030000025", relationship: "Father", paidFraction: 1, billAgeDays: 16 },
  { first: "Halima", last: "Bala", gender: "female", classIdx: 2, guardian: "Mrs. Amina Bala", guardianPhone: "08030000026", relationship: "Mother", paidFraction: 0, billAgeDays: 12 },
  { first: "John", last: "Peter", gender: "male", classIdx: 0, guardian: "Mr. Paul Peter", guardianPhone: "08030000027", relationship: "Father", paidFraction: 0.9, billAgeDays: 8 },
  { first: "Maryam", last: "Danladi", gender: "female", classIdx: 3, guardian: "Alhaji Danladi Umar", guardianPhone: "08030000028", relationship: "Father", paidFraction: 1, billAgeDays: 5 },
];

function daysAgo(n: number): string {
  const d = new Date(SCHOOL_TODAY);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * "Today" for the demo is the real current date, so bill ages and "days owing"
 * always read realistically (roughly 5–54 days) instead of drifting as the
 * calendar moves past a hardcoded date.
 */
const SCHOOL_TODAY = new Date();

function billLinesForLevel(level: string) {
  return FEE_ITEMS.filter((f) => f.level === level).map((f) => ({
    name: f.name,
    amount: f.amount,
  }));
}

export const GUARDIANS: Guardian[] = [];
export const STUDENTS: Student[] = [];
export const BILLS: Bill[] = [];
export const PAYMENTS: Payment[] = [];

let receiptCounter = 1080;

ROWS.forEach((row, i) => {
  const cls = CLASSES[row.classIdx];
  const guardianId = `g-${i}`;
  GUARDIANS.push({
    id: guardianId,
    schoolId: "sch-1",
    fullName: row.guardian,
    phone: row.guardianPhone,
    relationship: row.relationship,
  });

  const studentId = `s-${i}`;
  const admissionNo = `TJH/2024/${String(i + 1).padStart(3, "0")}`;
  STUDENTS.push({
    id: studentId,
    schoolId: "sch-1",
    admissionNo,
    firstName: row.first,
    lastName: row.last,
    gender: row.gender,
    classId: cls.id,
    guardianId,
    status: "active",
    enrolledOn: daysAgo(row.billAgeDays + 2),
  });

  const lines = billLinesForLevel(cls.level);
  const billId = `b-${i}`;
  BILLS.push({
    id: billId,
    schoolId: "sch-1",
    studentId,
    sessionId: SESSION.id,
    term: "first",
    lines,
    discount: 0,
    createdOn: daysAgo(row.billAgeDays),
  });

  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  const paid = Math.round((total * row.paidFraction) / 100) * 100; // whole naira
  if (paid > 0) {
    receiptCounter += 1;
    PAYMENTS.push({
      id: `p-${i}`,
      schoolId: "sch-1",
      studentId,
      billId,
      amount: paid,
      method: i % 3 === 0 ? "transfer" : "cash",
      receiptNo: `TJH-${receiptCounter}`,
      paidOn: daysAgo(Math.max(0, row.billAgeDays - 3)),
      recordedByName: "Mr. Emeka Okoro",
    });
  }
});

export const NEXT_RECEIPT_SEQ = receiptCounter + 1;
export { SCHOOL_TODAY };
