import { rowToStudent } from "@/lib/import/template";
import type { ImportStudentRow } from "@/lib/data/repository";

/**
 * Parse an uploaded registration file into student rows. Supports .csv (parsed
 * natively, no dependency) and .xlsx/.xls (parsed with SheetJS, loaded lazily
 * so the heavy library only downloads when someone actually uploads a
 * spreadsheet — kind to low-end phones and data plans).
 */
export async function parseStudentFile(file: File): Promise<ImportStudentRow[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv") {
    return parseCsv(await file.text());
  }
  return parseXlsx(await file.arrayBuffer());
}

/** Minimal RFC-4180-ish CSV parser (handles quoted fields and commas). */
export function parseCsv(text: string): ImportStudentRow[] {
  const rows = splitCsvRows(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((cells) => cells.some((c) => c.trim() !== ""))
    .map((cells) => {
      const record: Record<string, string> = {};
      headers.forEach((h, i) => (record[h] = cells[i] ?? ""));
      return rowToStudent(record);
    });
}

function splitCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function parseXlsx(buffer: ArrayBuffer): Promise<ImportStudentRow[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const records = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
    raw: false,
  });
  return records.map(rowToStudent);
}
