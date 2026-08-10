"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useViewer } from "@/lib/viewer";
import { useAsync } from "@/lib/useAsync";
import { repository } from "@/lib/data/repository";
import { can } from "@/lib/domain/constants";
import { classLevel, classRank } from "@/lib/classes";
import { exportToXlsx } from "@/lib/export";
import { formatNaira } from "@/lib/money";
import type { StudentAccount } from "@/lib/domain/types";
import {
  Button,
  EmptyState,
  Input,
  LoadingBlock,
  Money,
  Select,
  StatusPill,
  cn,
} from "@/components/ui";
import { PlusIcon, StudentsIcon, UploadIcon } from "@/components/icons";
import { Avatar } from "@/app/debtors/page";

const PAGE_SIZES = [10, 20, 50, 100];

export default function StudentsPage() {
  const router = useRouter();
  const { term, role } = useViewer();
  const { data, loading } = useAsync(
    () => repository.listStudentAccounts(term),
    [term],
  );

  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<"all" | "Primary" | "Secondary">("all");
  const [status, setStatus] = useState<"all" | "owing" | "cleared">("all");
  const [enrollment, setEnrollment] = useState<"active" | "pending">("active");
  const [sortAsc, setSortAsc] = useState(true);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const filtered = data.filter((a) => {
      const matchQ =
        !q ||
        `${a.student.firstName} ${a.student.lastName} ${a.className} ${a.student.admissionNo} ${a.guardian.fullName}`
          .toLowerCase()
          .includes(q);
      const matchL = level === "all" || classLevel(a.className) === level;
      const owing = a.outstanding > 0;
      const matchS =
        status === "all" || (status === "owing" ? owing : !owing);
      const matchE = a.student.status === enrollment;
      return matchQ && matchL && matchS && matchE;
    });
    return filtered.sort((a, b) => {
      const d = classRank(a.className) - classRank(b.className);
      if (d !== 0) return sortAsc ? d : -d;
      // Same class: keep names alphabetical for a stable read.
      return a.student.lastName.localeCompare(b.student.lastName);
    });
  }, [data, query, level, status, enrollment, sortAsc]);

  const pendingCount = (data ?? []).filter((a) => a.student.status === "pending").length;

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  function onExport() {
    exportToXlsx(
      "Students",
      ["Class", "Student", "Admission no", "Guardian", "Phone", "Balance", "Status"],
      rows.map((a) => [
        a.className,
        `${a.student.firstName} ${a.student.lastName}`,
        a.student.admissionNo,
        a.guardian.fullName,
        a.guardian.phone,
        a.outstanding / 100,
        a.outstanding > 0 ? "Owing" : "Cleared",
      ]),
    );
  }

  return (
    <div>
      <div className="mb-3 inline-flex rounded-xl border border-border bg-surface-sunken p-1">
        {(["active", "pending"] as const).map((e) => (
          <button
            key={e}
            onClick={() => resetPage(setEnrollment)(e)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold transition",
              enrollment === e
                ? "bg-surface-raised text-ink shadow-sm"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {e === "active" ? "Active" : `Pending (${pendingCount})`}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 md:min-w-64">
          <Input
            type="search"
            placeholder="Search by student or guardian name"
            value={query}
            onChange={(e) => resetPage(setQuery)(e.target.value)}
          />
        </div>
        <Select
          value={level}
          onChange={(e) => resetPage(setLevel)(e.target.value as typeof level)}
          className="w-auto"
        >
          <option value="all">All levels</option>
          <option value="Secondary">Secondary</option>
          <option value="Primary">Primary</option>
        </Select>
        <Select
          value={status}
          onChange={(e) => resetPage(setStatus)(e.target.value as typeof status)}
          className="w-auto"
        >
          <option value="all">All statuses</option>
          <option value="owing">Owing</option>
          <option value="cleared">Cleared</option>
        </Select>
        <Button variant="ghost" onClick={onExport} disabled={rows.length === 0}>
          <ExportIcon />
          Export
        </Button>
        {can(role, "manage_students") && (
          <>
            {can(role, "import_students") && (
              <Link href="/students/import" className="contents">
                <Button variant="secondary">
                  <UploadIcon width={18} height={18} />
                  Import
                </Button>
              </Link>
            )}
            <Link href="/students/new" className="contents">
              <Button>
                <PlusIcon width={18} height={18} />
                Add student
              </Button>
            </Link>
          </>
        )}
      </div>

      {loading && !data ? (
        <LoadingBlock label="Loading student records…" />
      ) : !data || data.length === 0 ? (
        <div className="flex flex-col items-center gap-4">
          <EmptyState
            icon={<StudentsIcon width={32} height={32} />}
            title="No students yet"
            description="Import a class from a spreadsheet, or add students one at a time."
          />
          {can(role, "manage_students") && (
            <div className="flex flex-wrap justify-center gap-2">
              {can(role, "import_students") && (
                <Link href="/students/import" className="contents">
                  <Button variant="secondary">
                    <UploadIcon width={18} height={18} />
                    Import
                  </Button>
                </Link>
              )}
              <Link href="/students/new" className="contents">
                <Button>
                  <PlusIcon width={18} height={18} />
                  Add student
                </Button>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-border-strong">
                  <th
                    role="button"
                    tabIndex={0}
                    aria-label="Sort by class"
                    onClick={() => setSortAsc((v) => !v)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSortAsc((v) => !v);
                      }
                    }}
                    className="cursor-pointer select-none px-4 py-3 text-xs font-bold text-ink-faint hover:text-ink"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      Class
                      <SortArrow asc={sortAsc} />
                    </span>
                  </th>
                  <Th>Student</Th>
                  <Th>Guardian</Th>
                  <Th>Phone</Th>
                  <Th>Balance</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((a) => (
                  <StudentRow
                    key={a.student.id}
                    account={a}
                    onOpen={() => router.push(`/students/${a.student.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-ink-muted">
            <div className="flex items-center gap-4">
              <span>
                Showing{" "}
                <b className="tabular text-ink">
                  {rows.length === 0 ? 0 : start + 1}
                  {"–"}
                  {Math.min(start + pageSize, rows.length)}
                </b>{" "}
                of <b className="tabular text-ink">{rows.length}</b> students
              </span>
              <label className="flex items-center gap-2 text-xs">
                Rows per page
                <Select
                  value={pageSize}
                  onChange={(e) => resetPage(setPageSize)(Number(e.target.value))}
                  className="w-auto py-1.5"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            <div className="flex items-center gap-1">
              <PagerButton
                disabled={current <= 1}
                onClick={() => setPage(current - 1)}
              >
                Prev
              </PagerButton>
              <span className="px-2 text-xs">
                Page <b className="tabular text-ink">{current}</b> of{" "}
                <b className="tabular text-ink">{totalPages}</b>
              </span>
              <PagerButton
                disabled={current >= totalPages}
                onClick={() => setPage(current + 1)}
              >
                Next
              </PagerButton>
            </div>
          </div>
        </div>
      )}

      {can(role, "manage_students") && (
        <Link
          href="/students/new"
          aria-label="Add student"
          className="fixed bottom-20 right-4 z-30 inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-on-primary shadow-lg transition hover:bg-primary-hover md:bottom-6 md:right-6"
        >
          <PlusIcon width={18} height={18} />
          Add student
        </Link>
      )}
    </div>
  );
}

function StudentRow({
  account: a,
  onOpen,
}: {
  account: StudentAccount;
  onOpen: () => void;
}) {
  return (
    <tr
      onClick={onOpen}
      className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-sunken"
    >
      <Td>{a.className}</Td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <Avatar first={a.student.firstName} last={a.student.lastName} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">
              {a.student.firstName} {a.student.lastName}
            </p>
            <p className="truncate text-xs text-ink-faint">
              {a.student.admissionNo}
            </p>
          </div>
        </div>
      </td>
      <Td>{a.guardian.fullName}</Td>
      <Td className="tabular">{a.guardian.phone}</Td>
      <td className="px-4 py-2.5">
        {a.outstanding > 0 ? (
          <Money kobo={a.outstanding} tone="danger" className="text-sm" />
        ) : (
          <span className="money text-sm text-ink-faint">
            {formatNaira(0)}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5">
        {a.outstanding > 0 ? (
          <StatusPill tone={a.status === "partial" ? "partial" : "unpaid"}>
            Owing
          </StatusPill>
        ) : (
          <StatusPill tone="paid">Cleared</StatusPill>
        )}
      </td>
      <td className="px-4 py-2.5">
        <Link
          href={`/students/${a.student.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-sm font-semibold text-primary hover:underline"
        >
          View
        </Link>
      </td>
    </tr>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-xs font-bold text-ink-faint">{children}</th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("px-4 py-2.5 text-sm text-ink", className)}>{children}</td>
  );
}

function SortArrow({ asc }: { asc: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={cn("transition-transform", !asc && "rotate-180")}
      aria-hidden
    >
      <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />
    </svg>
  );
}

function PagerButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-xs font-semibold text-ink-muted transition enabled:hover:border-primary enabled:hover:text-primary disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ExportIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" />
    </svg>
  );
}
