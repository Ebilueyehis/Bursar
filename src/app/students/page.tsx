"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { can } from "@/lib/domain/constants";
import {
  Button,
  EmptyState,
  Input,
  LoadingBlock,
  Money,
  StatusPill,
  cn,
} from "@/components/ui";
import { ChevronRightIcon, PlusIcon, StudentsIcon, UploadIcon } from "@/components/icons";
import { Avatar } from "@/app/debtors/page";

export default function StudentsPage() {
  const { term, role } = useViewer();
  const { data, loading } = useAsync(
    () => repository.listStudentAccounts(term),
    [term],
  );
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const list = q
      ? data.filter((a) =>
          `${a.student.firstName} ${a.student.lastName} ${a.className} ${a.student.admissionNo} ${a.guardian.fullName}`
            .toLowerCase()
            .includes(q),
        )
      : data;
    return [...list].sort((a, b) =>
      a.student.lastName.localeCompare(b.student.lastName),
    );
  }, [data, query]);

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Student records
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {data ? `${data.length} students` : "…"}
          </p>
        </div>
        {can(role, "manage_students") && (
          <div className="flex gap-2">
            {can(role, "import_students") && (
              <Link href="/students/import">
                <Button variant="secondary" className="min-h-10 px-3 text-sm">
                  <UploadIcon width={18} height={18} />
                  Import
                </Button>
              </Link>
            )}
            <Link href="/students/new">
              <Button className="min-h-10 px-3 text-sm">
                <PlusIcon width={18} height={18} />
                Add student
              </Button>
            </Link>
          </div>
        )}
      </div>

      {loading && !data ? (
        <LoadingBlock label="Loading student records…" />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<StudentsIcon width={32} height={32} />}
          title="No students yet"
          description="Import a class from a spreadsheet, or add students one at a time."
        />
      ) : (
        <>
          <Input
            type="search"
            placeholder="Search name, class, admission no…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mb-3"
          />
          <ul className="space-y-2.5">
            {filtered.map((a) => (
              <li key={a.student.id}>
                <Link
                  href={`/students/${a.student.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3.5 transition hover:bg-surface-sunken"
                >
                  <Avatar first={a.student.firstName} last={a.student.lastName} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">
                      {a.student.firstName} {a.student.lastName}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {a.className} · {a.student.admissionNo}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {a.outstanding > 0 ? (
                      <Money kobo={a.outstanding} tone="danger" className="text-sm" />
                    ) : (
                      <StatusPill tone="paid">Paid</StatusPill>
                    )}
                  </div>
                  <ChevronRightIcon width={18} height={18} className="text-ink-faint" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
