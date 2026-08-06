"use client";

import { useMemo, useRef, useState } from "react";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { ASSESSMENT_MAXES } from "@/lib/records/grading";
import {
  ASSESSMENT_TEMPLATE_HEADERS,
  buildAssessmentTemplateRows,
  parseAssessmentTemplate,
} from "@/lib/records/recordsTemplate";
import { exportToXlsx, readSheetRows } from "@/lib/export";
import {
  Banner, Button, Card, Field, Input, LoadingBlock, Select,
} from "@/components/ui";

type Draft = Record<string, { ca1: string; ca2: string; exam: string }>;

export function ScoreEntry({ classId, className, onClose }: { classId: string; className: string; onClose: () => void }) {
  const { term, actorName } = useViewer();
  const { data: subjects } = useAsync(() => repository.listSubjects(), []);
  const { data: students } = useAsync(() => repository.listStudents(), []);
  const [subjectId, setSubjectId] = useState("");
  const { data: existing } = useAsync(
    () => (subjectId ? repository.listStudentSubjectScores(classId, subjectId, term) : Promise.resolve([])),
    [classId, subjectId, term],
  );

  const [draft, setDraft] = useState<Draft>({});
  const [seededSubject, setSeededSubject] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [templateErrors, setTemplateErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const classStudents = useMemo(
    () => (students ?? []).filter((s) => s.classId === classId),
    [students, classId],
  );

  // Seed the grid from existing scores when the chosen subject changes.
  if (subjectId && existing && subjectId !== seededSubject) {
    setSeededSubject(subjectId);
    const next: Draft = {};
    for (const r of existing) {
      next[r.studentId] = {
        ca1: r.ca1 == null ? "" : String(r.ca1),
        ca2: r.ca2 == null ? "" : String(r.ca2),
        exam: r.exam == null ? "" : String(r.exam),
      };
    }
    setDraft(next);
  }

  function setCell(studentId: string, key: "ca1" | "ca2" | "exam", value: string) {
    setDraft((d) => {
      const cur = d[studentId] ?? { ca1: "", ca2: "", exam: "" };
      return { ...d, [studentId]: { ...cur, [key]: value } };
    });
  }

  function toNum(v: string): number | null {
    const t = v.trim();
    return t === "" ? null : Number(t);
  }

  async function saveGrid() {
    setError(null); setResult(null);
    if (!subjectId) return setError("Choose a subject first.");
    for (const s of classStudents) {
      const cell = draft[s.id];
      if (!cell) continue;
      const checks: [string, number | null, number][] = [
        ["CA1", toNum(cell.ca1), ASSESSMENT_MAXES.ca1],
        ["CA2", toNum(cell.ca2), ASSESSMENT_MAXES.ca2],
        ["Exam", toNum(cell.exam), ASSESSMENT_MAXES.exam],
      ];
      for (const [label, n, max] of checks) {
        if (n != null && (!Number.isInteger(n) || n < 0 || n > max)) {
          return setError(`${s.firstName} ${s.lastName}: ${label} must be a whole number between 0 and ${max}.`);
        }
      }
    }
    setSaving(true);
    try {
      await repository.saveAssessments({
        classId, subjectId, term,
        scores: classStudents.map((s) => {
          const cell = draft[s.id] ?? { ca1: "", ca2: "", exam: "" };
          return { studentId: s.id, ca1: toNum(cell.ca1), ca2: toNum(cell.ca2), exam: toNum(cell.exam) };
        }),
        recordedByName: actorName,
      });
      setResult("Scores saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save scores. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function downloadTemplate() {
    const tStudents = classStudents.map((s) => ({
      id: s.id, admissionNo: s.admissionNo, name: `${s.firstName} ${s.lastName}`, className,
    }));
    const tSubjects = (subjects ?? []).map((s) => ({ id: s.id, name: s.name }));
    exportToXlsx(`${className} scores template`, [...ASSESSMENT_TEMPLATE_HEADERS], buildAssessmentTemplateRows(tStudents, tSubjects));
  }

  async function onTemplateFile(file: File) {
    setTemplateErrors([]); setResult(null); setBusy(true);
    try {
      const sheet = await readSheetRows(file);
      const tStudents = classStudents.map((s) => ({
        id: s.id, admissionNo: s.admissionNo, name: `${s.firstName} ${s.lastName}`, className,
      }));
      const tSubjects = (subjects ?? []).map((s) => ({ id: s.id, name: s.name }));
      const { rows, errors } = parseAssessmentTemplate(sheet, tStudents, tSubjects);
      if (errors.length) setTemplateErrors(errors.slice(0, 10));
      if (rows.length) {
        const res = await repository.importAssessments(term, rows, actorName);
        setResult(`Saved scores for ${res.updated} ${res.updated === 1 ? "entry" : "entries"}.`);
        if (subjectId) setSeededSubject(""); // force grid reseed
      } else if (!errors.length) {
        setTemplateErrors(["The file had no scores to import."]);
      }
    } catch {
      setTemplateErrors(["Couldn't read that file. Use the downloaded template."]);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Card className="mb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink">Enter scores</h2>
        <button onClick={onClose} className="text-sm font-semibold text-primary">Close</button>
      </div>

      <div className="rounded-lg border border-border bg-surface-sunken p-3">
        <p className="text-sm font-semibold text-ink">Bulk with Excel</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          Download the template for this class, fill CA1, CA2 and Exam, then upload it.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={downloadTemplate} disabled={!subjects || classStudents.length === 0}>
            Download template
          </Button>
          <Button onClick={() => fileRef.current?.click()} disabled={busy || classStudents.length === 0}>
            {busy ? "Uploading…" : "Upload filled template"}
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onTemplateFile(f); }} />
        </div>
        {templateErrors.length > 0 && (
          <div className="mt-2"><Banner tone="error" title="Some rows were skipped">
            <span className="block whitespace-pre-line">{templateErrors.join("\n")}</span>
          </Banner></div>
        )}
      </div>

      <Field label="Subject (for the grid below)">
        <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">Choose a subject</option>
          {(subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </Field>

      {error && <Banner tone="error">{error}</Banner>}
      {result && <Banner tone="success">{result}</Banner>}

      {!subjectId ? null : !students ? (
        <LoadingBlock label="Loading students…" />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-border-strong">
                  <th className="px-3 py-2 text-xs font-bold text-ink-faint">Student</th>
                  <th className="px-3 py-2 text-xs font-bold text-ink-faint">CA1 /{ASSESSMENT_MAXES.ca1}</th>
                  <th className="px-3 py-2 text-xs font-bold text-ink-faint">CA2 /{ASSESSMENT_MAXES.ca2}</th>
                  <th className="px-3 py-2 text-xs font-bold text-ink-faint">Exam /{ASSESSMENT_MAXES.exam}</th>
                </tr>
              </thead>
              <tbody>
                {classStudents.map((s) => {
                  const cell = draft[s.id] ?? { ca1: "", ca2: "", exam: "" };
                  return (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 text-sm font-medium text-ink">{s.firstName} {s.lastName}</td>
                      {(["ca1", "ca2", "exam"] as const).map((k) => (
                        <td key={k} className="px-3 py-2">
                          <Input inputMode="numeric" value={cell[k]} onChange={(e) => setCell(s.id, k, e.target.value)} className="w-20" />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button onClick={saveGrid} disabled={saving}>{saving ? "Saving…" : "Save scores"}</Button>
        </>
      )}
    </Card>
  );
}
