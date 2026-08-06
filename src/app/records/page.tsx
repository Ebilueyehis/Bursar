"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { can, termLabel } from "@/lib/domain/constants";
import { EmptyState, LoadingBlock, PageHeader, cn } from "@/components/ui";
import { ChevronRightIcon } from "@/components/icons";

export default function RecordsPage() {
  const { role, term } = useViewer();
  const canManage = can(role, "manage_grades");
  const params = useSearchParams();
  const classId = params.get("class");

  // Seed default subjects once for schools that have none (idempotent).
  useEffect(() => {
    if (canManage) void repository.ensureDefaultSubjects();
  }, [canManage]);

  const { data, loading } = useAsync(() => repository.listClassRecordSummaries(term), [term]);

  if (!can(role, "view_grades")) {
    return (
      <EmptyState
        title="Records are for school staff"
        description="Ask an administrator if you need access to exam records."
      />
    );
  }

  // Class detail (?class=) is wired in the next slice.
  void classId;

  const classes = data ?? [];

  return (
    <div>
      <PageHeader
        title="Records"
        subtitle={`Class averages for ${termLabel(term)}. Pick a class to see subjects and students.`}
      />
      {loading && !data ? (
        <LoadingBlock label="Loading class records…" />
      ) : classes.length === 0 ? (
        <EmptyState
          title="No classes yet"
          description="Add classes and students, then enter their scores to see records here."
        />
      ) : (
        <ul className="space-y-2.5">
          {classes.map((c) => (
            <li key={c.classId}>
              <a
                href={`/records?class=${c.classId}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 transition hover:bg-surface-sunken"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{c.className}</p>
                  <p className="text-xs text-ink-muted">
                    {c.studentCount} {c.studentCount === 1 ? "student" : "students"}
                  </p>
                </div>
                <Stat label="Avg CA" value={c.avgCa} outOf={40} />
                <Stat label="Avg Exam" value={c.avgExam} outOf={60} />
                <ChevronRightIcon width={18} height={18} className="text-ink-faint" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, outOf }: { label: string; value: number | null; outOf: number }) {
  return (
    <div className={cn("shrink-0 text-right")}>
      <p className="text-xs text-ink-faint">{label}</p>
      <p className="tabular text-sm font-bold text-ink">
        {value == null ? "-" : `${value} / ${outOf}`}
      </p>
    </div>
  );
}
