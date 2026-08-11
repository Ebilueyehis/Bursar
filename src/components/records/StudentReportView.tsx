"use client";

import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { termLabel } from "@/lib/domain/constants";
import { Card, LoadingBlock, EmptyState, Button } from "@/components/ui";

export function StudentReportView({ studentId }: { studentId: string }) {
  const { term } = useViewer();
  const { data, loading } = useAsync(() => repository.getStudentReport(studentId, term), [studentId, term]);

  if (loading && !data) return <LoadingBlock label="Loading report…" />;
  if (!data) return <EmptyState title="No report" />;
  if (data.rows.length === 0) {
    return <EmptyState title="No scores yet" description="This student has no scores entered for the term." />;
  }

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="font-semibold text-ink">{data.studentName}</p>
          <p className="text-xs text-ink-muted">{data.className} · {termLabel(data.term)}</p>
        </div>
        <Button variant="ghost" onClick={() => window.print()}>Print</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-border-strong">
              <Th>Subject</Th><Th>CA1</Th><Th>CA2</Th><Th>Exam</Th><Th>Total</Th><Th>Grade</Th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.subjectId} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 text-sm font-medium text-ink">{r.subjectName}</td>
                <Num v={r.ca1} /><Num v={r.ca2} /><Num v={r.exam} /><Num v={r.total} />
                <td className="px-4 py-2.5 text-sm font-semibold text-ink">{r.grade ?? "-"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border-strong">
              <td className="px-4 py-2.5 text-sm font-bold text-ink" colSpan={4}>Overall average</td>
              <td className="px-4 py-2.5 text-sm font-bold tabular text-ink" colSpan={2}>
                {data.overallAverage == null ? "-" : `${data.overallAverage} / 100`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="border-t border-border px-4 py-3 text-xs text-ink-faint">
        A formatted printable report card is coming in a future update.
      </p>
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-xs font-bold text-ink-faint">{children}</th>;
}
function Num({ v }: { v: number | null }) {
  return <td className="px-4 py-2.5 text-sm tabular text-ink-muted">{v == null ? "-" : v}</td>;
}
