"use client";

import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { Card, LoadingBlock, EmptyState } from "@/components/ui";

export function SubjectScores({ classId, subjectId, subjectName }: { classId: string; subjectId: string; subjectName: string }) {
  const { term } = useViewer();
  const { data, loading } = useAsync(
    () => repository.listStudentSubjectScores(classId, subjectId, term),
    [classId, subjectId, term],
  );
  const rows = data ?? [];

  if (loading && !data) return <LoadingBlock label="Loading scores…" />;
  if (rows.length === 0) return <EmptyState title="No students in this class" />;

  return (
    <Card className="p-0">
      <div className="border-b border-border px-4 py-3 text-sm font-semibold text-ink">{subjectName}</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-border-strong">
              <Th>Student</Th><Th>CA1</Th><Th>CA2</Th><Th>Exam</Th><Th>Total</Th><Th>Grade</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.studentId} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 text-sm font-medium text-ink">{r.studentName}</td>
                <Num v={r.ca1} /><Num v={r.ca2} /><Num v={r.exam} /><Num v={r.total} />
                <td className="px-4 py-2.5 text-sm font-semibold text-ink">{r.grade ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-xs font-bold text-ink-faint">{children}</th>;
}
function Num({ v }: { v: number | null }) {
  return <td className="px-4 py-2.5 text-sm tabular text-ink-muted">{v == null ? "-" : v}</td>;
}
