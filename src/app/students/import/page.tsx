"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { repository } from "@/lib/data/repository";
import type { ImportResult, ImportStudentRow } from "@/lib/data/repository";
import { parseStudentFile } from "@/lib/import/parse";
import { IMPORT_COLUMNS, downloadTemplate } from "@/lib/import/template";
import { Button, Card, LoadingBlock, StatusPill, cn } from "@/components/ui";
import {
  ArrowLeftIcon,
  CheckIcon,
  UploadIcon,
} from "@/components/icons";

type Stage = "upload" | "preview" | "done";

export default function ImportStudentsPage() {
  const [stage, setStage] = useState<Stage>("upload");
  const [rows, setRows] = useState<ImportStudentRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setError(null);
    setParsing(true);
    try {
      const parsed = await parseStudentFile(file);
      if (parsed.length === 0) {
        setError("No rows found. Check that the file has a header row and at least one student.");
        return;
      }
      setRows(parsed);
      setFileName(file.name);
      setStage("preview");
    } catch {
      setError("This file couldn't be read. Please upload the .csv or .xlsx template, unchanged.");
    } finally {
      setParsing(false);
    }
  }

  async function confirmImport() {
    setImporting(true);
    try {
      const res = await repository.importStudents(rows);
      setResult(res);
      setStage("done");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <Link
        href="/students"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted"
      >
        <ArrowLeftIcon width={18} height={18} />
        Students
      </Link>

      <h1 className="mb-1 text-2xl font-bold tracking-tight text-ink">
        Import students
      </h1>
      <p className="mb-5 text-sm text-ink-muted">
        Share the registration form, collect responses in a spreadsheet, then
        upload it here. We&apos;ll check every row before adding anyone.
      </p>

      {stage === "upload" && (
        <div className="space-y-4">
          <Card>
            <p className="text-sm font-semibold text-ink">
              Step 1 — Get the form
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              Download the template and share it, or collect the same columns in
              a Google Form. Required columns:
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {IMPORT_COLUMNS.map((c) => (
                <span
                  key={c}
                  className="rounded-md bg-surface-sunken px-2 py-1 text-xs text-ink-muted"
                >
                  {c}
                </span>
              ))}
            </div>
            <Button
              variant="secondary"
              onClick={downloadTemplate}
              className="mt-3 w-full"
            >
              Download template (CSV)
            </Button>
          </Card>

          <Card>
            <p className="text-sm font-semibold text-ink">
              Step 2 — Upload the completed sheet
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              Accepts .csv or .xlsx. Nothing is added until you review and
              confirm.
            </p>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
            <Button
              onClick={() => fileInput.current?.click()}
              className="mt-3 w-full"
              disabled={parsing}
            >
              <UploadIcon width={20} height={20} />
              {parsing ? "Reading file…" : "Choose file"}
            </Button>
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          </Card>
        </div>
      )}

      {stage === "preview" && (
        <PreviewStage
          rows={rows}
          fileName={fileName}
          importing={importing}
          onConfirm={confirmImport}
          onCancel={() => {
            setStage("upload");
            setRows([]);
          }}
        />
      )}

      {stage === "done" && result && (
        <DoneStage result={result} />
      )}
    </div>
  );
}

function PreviewStage({
  rows,
  fileName,
  importing,
  onConfirm,
  onCancel,
}: {
  rows: ImportStudentRow[];
  fileName: string;
  importing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Lightweight client-side validation preview (repository re-checks on import).
  const checked = rows.map((r) => {
    const problems: string[] = [];
    if (!r.firstName || !r.lastName) problems.push("Missing name");
    if (!r.className) problems.push("Missing class");
    if (!r.guardianPhone) problems.push("Missing guardian phone");
    return { row: r, problems };
  });
  const validCount = checked.filter((c) => c.problems.length === 0).length;
  const problemCount = rows.length - validCount;

  if (importing) return <LoadingBlock label="Adding students…" />;

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-muted">From {fileName}</p>
          <p className="font-semibold text-ink">
            {rows.length} rows · {validCount} ready
            {problemCount > 0 && `, ${problemCount} to fix`}
          </p>
        </div>
        <Button variant="secondary" onClick={onCancel} className="min-h-10 px-3 text-sm">
          Change file
        </Button>
      </Card>

      <ul className="space-y-2">
        {checked.map((c, i) => (
          <Card
            key={i}
            className={cn(
              "flex items-center justify-between gap-2",
              c.problems.length > 0 && "border-danger/40 bg-danger-tint/40",
            )}
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">
                {c.row.firstName} {c.row.lastName}
                {!c.row.firstName && !c.row.lastName && (
                  <span className="text-ink-faint">(no name)</span>
                )}
              </p>
              <p className="truncate text-xs text-ink-muted">
                {c.row.className || "—"} · {c.row.guardianName || "no guardian"}
              </p>
            </div>
            {c.problems.length === 0 ? (
              <StatusPill tone="paid">Ready</StatusPill>
            ) : (
              <span className="shrink-0 text-xs font-semibold text-danger">
                {c.problems.join(", ")}
              </span>
            )}
          </Card>
        ))}
      </ul>

      <div className="sticky bottom-24 space-y-2">
        {problemCount > 0 && (
          <p className="text-center text-xs text-ink-muted">
            Rows with problems will be skipped. You can fix them in the sheet and
            re-upload.
          </p>
        )}
        <Button onClick={onConfirm} disabled={validCount === 0} className="w-full">
          Import {validCount} {validCount === 1 ? "student" : "students"}
        </Button>
      </div>
    </div>
  );
}

function DoneStage({ result }: { result: ImportResult }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center pt-4 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-success-tint text-success">
          <CheckIcon width={34} height={34} />
        </span>
        <h2 className="mt-4 text-xl font-bold text-ink">
          {result.imported} {result.imported === 1 ? "student" : "students"} added
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          {result.failed > 0
            ? `${result.failed} row${result.failed === 1 ? "" : "s"} were skipped and can be fixed and re-uploaded.`
            : "Every row was added. That's fewer names to remember on your own."}
        </p>
      </div>

      {result.failed > 0 && (
        <Card>
          <p className="mb-2 text-sm font-semibold text-ink">Skipped rows</p>
          <ul className="space-y-1.5">
            {result.results
              .filter((r) => !r.ok)
              .map((r) => (
                <li
                  key={r.rowNumber}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-ink">
                    Row {r.rowNumber}: {r.studentName || "(no name)"}
                  </span>
                  <span className="text-danger">{r.error}</span>
                </li>
              ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link href="/students/import" className="contents">
          <Button variant="secondary" className="w-full">
            Import more
          </Button>
        </Link>
        <Link href="/students" className="contents">
          <Button className="w-full">View students</Button>
        </Link>
      </div>
    </div>
  );
}
