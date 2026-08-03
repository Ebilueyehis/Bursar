import * as XLSX from "xlsx";

/**
 * Client-side .xlsx export. Give it a filename, column headers, and a matrix of
 * rows (strings for text, numbers for money/counts so Excel keeps them numeric).
 * Used by every data screen's Export button.
 */
export function exportToXlsx(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
): void {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  const name = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, name);
}

/** Read the first sheet of an uploaded .xlsx/.csv into keyed rows (header row). */
export async function readSheetRows(
  file: File,
): Promise<Record<string, string>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const first = workbook.SheetNames[0];
  if (!first) return [];
  const sheet = workbook.Sheets[first];
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
    raw: false,
  });
}
