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
