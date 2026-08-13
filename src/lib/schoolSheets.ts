import type { SchoolExport } from "@/lib/data/repository";
import type { ExportSheet } from "@/lib/export";

/**
 * Kobo to a naira number. Excel keeps it numeric so the column can be summed,
 * which a preformatted string would prevent.
 */
function naira(kobo: number): number {
  return Math.round(kobo) / 100;
}

/**
 * Turns a school's complete records into one sheet per collection. Pure, so it
 * is testable without a browser, and so the workbook's shape is decided in one
 * place rather than inside a click handler.
 */
export function schoolSheets(data: SchoolExport): ExportSheet[] {
  const className = new Map(data.classes.map((c) => [c.id, c.name]));
  const guardianName = new Map(data.guardians.map((g) => [g.id, g.fullName]));
  const studentName = new Map(
    data.students.map((s) => [s.id, `${s.firstName} ${s.lastName}`]),
  );
  const subjectName = new Map(data.subjects.map((s) => [s.id, s.name]));

  return [
    {
      name: "Students",
      headers: [
        "Admission no",
        "First name",
        "Last name",
        "Other name",
        "Gender",
        "Date of birth",
        "Class",
        "Guardian",
        "Status",
        "Enrolled on",
      ],
      rows: data.students.map((s) => [
        s.admissionNo,
        s.firstName,
        s.lastName,
        s.otherName ?? "",
        s.gender ?? "",
        s.dateOfBirth ?? "",
        className.get(s.classId) ?? "",
        guardianName.get(s.guardianId) ?? "",
        s.status,
        s.enrolledOn,
      ]),
    },
    {
      name: "Guardians",
      headers: ["Name", "Relationship", "Phone", "Alternate phone", "Email"],
      rows: data.guardians.map((g) => [
        g.fullName,
        g.relationship ?? "",
        g.phone,
        g.altPhone ?? "",
        g.email ?? "",
      ]),
    },
    {
      name: "Classes",
      headers: ["Class", "Level"],
      rows: data.classes.map((c) => [c.name, c.level]),
    },
    {
      name: "Fee items",
      headers: ["Level", "Term", "Item", "Amount"],
      rows: data.feeItems.map((f) => [f.level, f.term, f.name, naira(f.amount)]),
    },
    {
      name: "Bills",
      headers: ["Student", "Term", "Total", "Discount", "Reason", "Created on"],
      rows: data.bills.map((b) => [
        studentName.get(b.studentId) ?? "",
        b.term,
        naira(b.lines.reduce((sum, l) => sum + l.amount, 0)),
        naira(b.discount),
        b.discountReason ?? "",
        b.createdOn,
      ]),
    },
    {
      name: "Payments",
      headers: [
        "Receipt no",
        "Student",
        "Amount",
        "Method",
        "Paid on",
        "Recorded by",
        "Note",
      ],
      rows: data.payments.map((p) => [
        p.receiptNo,
        studentName.get(p.studentId) ?? "",
        naira(p.amount),
        p.method,
        p.paidOn,
        p.recordedByName,
        p.note ?? "",
      ]),
    },
    {
      name: "Expenses",
      headers: [
        "Date",
        "Payee",
        "Description",
        "Category",
        "Cadence",
        "Amount",
        "Method",
        "Recorded by",
      ],
      rows: data.expenses.map((e) => [
        e.spentOn,
        e.payee,
        e.description,
        e.category,
        e.cadence,
        naira(e.amount),
        e.method,
        e.recordedByName,
      ]),
    },
    {
      name: "Income",
      headers: [
        "Date",
        "Source",
        "Description",
        "Amount",
        "Method",
        "Recorded by",
      ],
      rows: data.income.map((i) => [
        i.receivedOn,
        i.source,
        i.description,
        naira(i.amount),
        i.method,
        i.recordedByName,
      ]),
    },
    {
      name: "Staff",
      headers: [
        "Name",
        "Title",
        "Employment type",
        "Assignment",
        "Phone",
        "Monthly salary",
        "Active",
      ],
      rows: data.staff.map((s) => [
        s.fullName,
        s.title ?? "",
        s.employmentType,
        s.assignment ?? "",
        s.phone ?? "",
        naira(s.monthlySalary),
        s.active ? "Yes" : "No",
      ]),
    },
    {
      name: "Assessments",
      headers: ["Student", "Subject", "Term", "CA 1", "CA 2", "Exam"],
      rows: data.assessments.map((a) => [
        studentName.get(a.studentId) ?? "",
        subjectName.get(a.subjectId) ?? "",
        a.term,
        a.ca1 ?? "",
        a.ca2 ?? "",
        a.exam ?? "",
      ]),
    },
  ];
}
