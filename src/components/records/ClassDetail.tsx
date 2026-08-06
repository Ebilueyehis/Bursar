"use client";

import { useState } from "react";
import Link from "next/link";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { cn } from "@/components/ui";
import { ArrowLeftIcon } from "@/components/icons";
import { SubjectMatrix } from "@/components/records/SubjectMatrix";
import { StudentLens } from "@/components/records/StudentLens";

type Lens = "subject" | "student";

export function ClassDetail({ classId }: { classId: string }) {
  const { data: classes } = useAsync(() => repository.listClasses(), []);
  const [lens, setLens] = useState<Lens>("subject");
  const className = classes?.find((c) => c.id === classId)?.name ?? "Class";

  return (
    <div className="space-y-4">
      <Link href="/records" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted">
        <ArrowLeftIcon width={18} height={18} /> All classes
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold text-ink">{className}</h1>
        <div className="inline-flex rounded-xl border border-border bg-surface-sunken p-1">
          {(["subject", "student"] as Lens[]).map((l) => (
            <button
              key={l}
              onClick={() => setLens(l)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-semibold transition",
                lens === l ? "bg-surface-raised text-ink shadow-sm" : "text-ink-muted hover:text-ink",
              )}
            >
              {l === "subject" ? "By subject" : "By student"}
            </button>
          ))}
        </div>
      </div>

      {lens === "subject" ? <SubjectMatrix classId={classId} /> : <StudentLens classId={classId} />}
    </div>
  );
}
