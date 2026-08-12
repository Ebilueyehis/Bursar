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
): Promise<void> {
  const name = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  // Building and serializing the workbook is synchronous and CPU-heavy. Run it
  // after the click has painted so the interaction is not blocked (fixes INP):
  // yield one animation frame, then a macrotask, before the heavy work. The
  // download still fires immediately after, within the user-gesture chain.
  return new Promise<void>((resolve, reject) => {
    const run = () => {
      try {
        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
        XLSX.writeFile(workbook, name);
        resolve();
      } catch (e) {
        reject(e instanceof Error ? e : new Error("Export failed."));
      }
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => setTimeout(run, 0));
    } else {
      setTimeout(run, 0);
    }
  });
}

/** One sheet in a multi-sheet workbook. */
export interface ExportSheet {
  name: string;
  headers: string[];
  rows: (string | number)[][];
}

/**
 * Excel rejects sheet names over 31 characters and forbids : \ / ? * [ ].
 * Anything that would make the workbook refuse to open is replaced rather than
 * passed through, because a failed download gives the user nothing to act on.
 */
export function safeSheetName(name: string): string {
  const cleaned = name
    .replace(/[:\\/?*]/g, "-")
    .replace(/\[/g, "(")
    .replace(/\]/g, ")")
    .trim();
  if (!cleaned) return "Sheet";
  return cleaned.slice(0, 31);
}

/**
 * Client-side .xlsx export with one sheet per table. Same deferred-work shape
 * as exportToXlsx: building and serializing is synchronous and CPU-heavy, so it
 * runs after the click has painted and does not block the interaction.
 */
export function exportWorkbook(
  filename: string,
  sheets: ExportSheet[],
): Promise<void> {
  const name = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  return new Promise<void>((resolve, reject) => {
    const run = () => {
      try {
        const workbook = XLSX.utils.book_new();
        const used = new Set<string>();
        for (const sheet of sheets) {
          let title = safeSheetName(sheet.name);
          // Two sheets cannot share a name, and SheetJS throws rather than
          // renaming, which would lose a whole table from the export.
          let n = 2;
          while (used.has(title)) {
            title = safeSheetName(`${sheet.name} ${n}`);
            n += 1;
          }
          used.add(title);
          const ws = XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows]);
          XLSX.utils.book_append_sheet(workbook, ws, title);
        }
        XLSX.writeFile(workbook, name);
        resolve();
      } catch (e) {
        reject(e instanceof Error ? e : new Error("Export failed."));
      }
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => setTimeout(run, 0));
    } else {
      setTimeout(run, 0);
    }
  });
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
