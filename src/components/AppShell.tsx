"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useViewer } from "@/lib/viewer";
import { ROLE_LABELS, TERMS, can } from "@/lib/domain/constants";
import type { Role, TermName } from "@/lib/domain/types";
import { cn } from "@/components/ui";
import { useOnline } from "@/lib/useOnline";
import {
  DashboardIcon,
  DebtorsIcon,
  PlusIcon,
  ReportIcon,
  StudentsIcon,
} from "@/components/icons";

export function AppShell({ children }: { children: ReactNode }) {
  const { ready } = useViewer();
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col bg-background">
      <TopBar />
      <main className="flex-1 px-4 pb-28 pt-4">{ready ? children : null}</main>
      <BottomNav />
    </div>
  );
}

function TopBar() {
  const { school, session, role, setRole, term, setTerm } = useViewer();
  const online = useOnline();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="flex items-center gap-2.5">
          <Logo />
          <div className="leading-tight">
            <p className="text-sm font-bold text-ink">Bursar</p>
            <p className="max-w-40 truncate text-xs text-ink-muted">
              {school?.name ?? "…"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!online && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-tint px-2.5 py-1 text-xs font-semibold text-warning">
              <span className="size-1.5 rounded-full bg-warning" />
              Offline
            </span>
          )}
          <RoleSwitcher role={role} onChange={setRole} />
        </div>
      </div>

      {/* Term selector — global filter over the current session */}
      <div className="flex items-center gap-2 px-4 pb-2.5 pt-2">
        <div className="flex rounded-lg bg-surface-sunken p-0.5">
          {TERMS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTerm(t.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-semibold transition",
                term === t.value
                  ? "bg-surface text-ink shadow-sm"
                  : "text-ink-muted",
              )}
            >
              {t.label.replace(" term", "")}
            </button>
          ))}
        </div>
        <span className="text-xs text-ink-faint">{session?.name}</span>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-on-primary">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M6 4h9a4 4 0 0 1 0 8H6zM6 12h10a4 4 0 0 1 0 8H6zM6 4v16"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** Prototype-only role switcher. In production the role is fixed by sign-in. */
function RoleSwitcher({
  role,
  onChange,
}: {
  role: Role;
  onChange: (r: Role) => void;
}) {
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <span className="size-2 rounded-full bg-primary" />
        {ROLE_LABELS[role]}
      </summary>
      <div className="absolute right-0 z-30 mt-1 w-52 rounded-lg border border-border bg-surface p-1 shadow-lg">
        <p className="px-3 py-1.5 text-xs text-ink-faint">View Bursar as…</p>
        {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
          <button
            key={r}
            onClick={(e) => {
              onChange(r);
              (e.currentTarget.closest("details") as HTMLDetailsElement).open =
                false;
            }}
            className={cn(
              "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-surface-sunken",
              r === role ? "font-semibold text-primary" : "text-ink",
            )}
          >
            {ROLE_LABELS[r]}
            {r === role && <span className="text-primary">✓</span>}
          </button>
        ))}
      </div>
    </details>
  );
}

// --- Bottom navigation -------------------------------------------------------

interface NavItem {
  href: string;
  label: string;
  icon: typeof DashboardIcon;
}

function BottomNav() {
  const pathname = usePathname();
  const { role } = useViewer();

  const items: NavItem[] = [
    { href: "/", label: "Dashboard", icon: DashboardIcon },
    { href: "/debtors", label: "Owing", icon: DebtorsIcon },
    { href: "/students", label: "Students", icon: StudentsIcon },
    { href: "/reports", label: "Reports", icon: ReportIcon },
  ];
  const showRecord = can(role, "record_payment");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-2xl border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="relative grid grid-cols-4">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
                active ? "text-primary" : "text-ink-muted",
              )}
            >
              <Icon width={22} height={22} />
              {item.label}
            </Link>
          );
        })}

        {showRecord && (
          <Link
            href="/pay"
            aria-label="Record payment"
            className="absolute -top-6 left-1/2 flex size-14 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg ring-4 ring-background transition hover:bg-primary-hover"
          >
            <PlusIcon width={26} height={26} />
          </Link>
        )}
      </div>
    </nav>
  );
}
