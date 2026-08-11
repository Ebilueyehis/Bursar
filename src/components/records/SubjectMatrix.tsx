"use client";

import { useState } from "react";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { Card, LoadingBlock, EmptyState } from "@/components/ui";
import { SubjectScores } from "@/components/records/SubjectScores";

export function SubjectMatrix({ classId }: { classId: string }) {
  const { term } = useViewer();
  const { data, loading } = useAsync(() => repository.listSubjectAverages(classId, term), [classId, term]);
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const rows = data ?? [];

  if (picked) {
    return (
      <div className="space-y-3">
        <button onClick={() => setPicked(null)} className="text-sm font-semibold text-primary">
          Back to subjects
        </button>
        <SubjectScores classId={classId} subjectId={picked.id} subjectName={picked.name} />
      </div>
    );
  }

  if (loading && !data) return <LoadingBlock label="Loading subject averages…" />;
  if (rows.length === 0) {
    return <EmptyState title="No scores entered yet" description="Enter or upload scores to see subject averages." />;
  }

  return (
    <Card className="p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-border-strong">
              <Th>Subject</Th><Th>CA1</Th><Th>CA2</Th><Th>Exam</Th><Th>Total</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.subjectId} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 text-sm font-medium text-ink">{r.subjectName}</td>
                <Num v={r.avgCa1} /><Num v={r.avgCa2} /><Num v={r.avgExam} /><Num v={r.avgTotal} />
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => setPicked({ id: r.subjectId, name: r.subjectName })}
                    className="text-sm font-semibold text-primary"
                  >
                    View students
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-3 text-xs font-bold text-ink-faint">{children}</th>;
}
function Num({ v }: { v: number | null }) {
  return <td className="px-4 py-2.5 text-sm tabular text-ink-muted">{v == null ? "-" : v}</td>;
}
