/**
 * The downloadable/uploadable fee template: a long-format sheet keyed by class
 * level. Pure functions only, so the parsing and building are unit-tested and
 * the UI just wires files to them via exportToXlsx / readSheetRows.
 */

export const FEE_TEMPLATE_HEADERS = [
  "Class",
  "Item",
  "Amount",
  "Optional",
] as const;

export interface FeeTemplateRow {
  level: string;
  name: string;
  amountKobo: number;
  optional: boolean;
}

export interface FeeTemplateParse {
  rows: FeeTemplateRow[];
  errors: string[];
}

const STARTER_ITEMS = ["School fee", "Sportswear", "Books"];

/** Rows for exportToXlsx: one per (level, item), pre-filled from existing items. */
export function buildFeeTemplateRows(
  levels: string[],
  existingByLevel: Record<
    string,
    { name: string; amountKobo: number; optional?: boolean }[]
  >,
): (string | number)[][] {
  const out: (string | number)[][] = [];
  for (const level of levels) {
    const items = existingByLevel[level];
    if (items && items.length > 0) {
      for (const it of items) {
        out.push([
          level,
          it.name,
          it.amountKobo / 100,
          it.optional ? "Yes" : "No",
        ]);
      }
    } else {
      for (const name of STARTER_ITEMS) out.push([level, name, 0, "No"]);
    }
  }
  return out;
}

/** Parse readSheetRows() output into typed rows + per-row error messages. */
export function parseFeeTemplate(
  sheetRows: Record<string, string>[],
  knownLevels: string[],
): FeeTemplateParse {
  const rows: FeeTemplateRow[] = [];
  const errors: string[] = [];
  const canon = new Map(knownLevels.map((l) => [l.toLowerCase(), l]));

  sheetRows.forEach((raw, idx) => {
    const rowNo = idx + 2; // header is row 1 in the sheet
    const level = canon.get((raw.Class ?? "").trim().toLowerCase());
    const name = (raw.Item ?? "").trim();
    const amountRaw = (raw.Amount ?? "").replace(/,/g, "").trim();
    const optRaw = (raw.Optional ?? "").trim().toLowerCase();

    if (!level) {
      errors.push(`Row ${rowNo}: unknown class "${raw.Class ?? ""}"`);
      return;
    }
    if (!name) {
      errors.push(`Row ${rowNo}: item name is required`);
      return;
    }
    const amount = Number(amountRaw);
    if (amountRaw === "" || !Number.isFinite(amount) || amount < 0) {
      errors.push(`Row ${rowNo}: amount "${raw.Amount ?? ""}" is not valid`);
      return;
    }
    let optional: boolean;
    if (optRaw === "" || optRaw === "no") optional = false;
    else if (optRaw === "yes") optional = true;
    else {
      errors.push(`Row ${rowNo}: Optional must be Yes or No`);
      return;
    }
    rows.push({ level, name, amountKobo: Math.round(amount * 100), optional });
  });

  return { rows, errors };
}
