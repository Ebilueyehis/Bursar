"use client";

import { useState } from "react";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { LoadingBlock, EmptyState } from "@/components/ui";
import { ChevronRightIcon } from "@/components/icons";
import { StudentReportView } from "@/components/records/StudentReportView";

export function StudentLens({ classId }: { classId: string }) {
  const { term } = useViewer();
  const { data, loading } = useAsync(() => repository.listClassStudentAverages(classId, term), [classId, term]);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const rows = data ?? [];

  if (pickedId) {
    return (
      <div className="space-y-3">
        <button onClick={() => setPickedId(null)} className="text-sm font-semibold text-primary">
          Back to students
        </button>
        <StudentReportView studentId={pickedId} />
      </div>
    );
  }

  if (loading && !data) return <LoadingBlock label="Loading students…" />;
  if (rows.length === 0) return <EmptyState title="No students in this class" />;

  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.studentId}>
          <button
            onClick={() => setPickedId(r.studentId)}
            className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-3.5 text-left transition hover:bg-surface-sunken"
          >
            <span className="min-w-0 flex-1 font-semibold text-ink">{r.studentName}</span>
            <span className="shrink-0 text-right">
              <span className="block text-xs text-ink-faint">Average</span>
              <span className="tabular text-sm font-bold text-ink">
                {r.average == null ? "-" : `${r.average} / 100`}
              </span>
            </span>
            <ChevronRightIcon width={18} height={18} className="text-ink-faint" />
          </button>
        </li>
      ))}
    </ul>
  );
}
