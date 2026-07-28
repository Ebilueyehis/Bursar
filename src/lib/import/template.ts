import type { ImportStudentRow } from "@/lib/data/repository";

/**
 * The canonical column order for the student registration spreadsheet. This is
 * also the shape of the shareable registration form: a school shares the form,
 * responses collect into a sheet with exactly these columns, and that sheet is
 * uploaded here. Keep the labels stable — they are what people fill in.
 */
export const IMPORT_COLUMNS = [
  "First name",
  "Last name",
  "Other name",
  "Gender",
  "Class",
  "Guardian name",
  "Guardian phone",
  "Relationship",
] as const;

/** Map a spreadsheet row (header -> value) to an ImportStudentRow. */
export function rowToStudent(row: Record<string, string>): ImportStudentRow {
  const get = (key: string) => (row[key] ?? "").toString().trim();
  return {
    firstName: get("First name"),
    lastName: get("Last name"),
    otherName: get("Other name") || undefined,
    gender: get("Gender") || undefined,
    className: get("Class"),
    guardianName: get("Guardian name"),
    guardianPhone: get("Guardian phone"),
    guardianRelationship: get("Relationship") || undefined,
  };
}

/** Build a CSV template with headers and one example row. */
export function buildTemplateCsv(): string {
  const example = [
    "Tunde",
    "Okafor",
    "Ade",
    "Male",
    "JSS 1A",
    "Mr. Chidi Okafor",
    "08030000011",
    "Father",
  ];
  return `${IMPORT_COLUMNS.join(",")}\n${example.join(",")}\n`;
}

/** Trigger a browser download of the CSV template. */
export function downloadTemplate() {
  const blob = new Blob([buildTemplateCsv()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bursar-student-registration-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}
