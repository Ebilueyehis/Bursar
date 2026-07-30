"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useViewer } from "@/lib/viewer";
import type { Permission } from "@/lib/domain/constants";
import { ROLE_LABELS, TERMS, can } from "@/lib/domain/constants";
import type { Role } from "@/lib/domain/types";
import { cn } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useOnline } from "@/lib/useOnline";
import {
  DashboardIcon,
  DebtorsIcon,
  ExpenseIcon,
  FeesIcon,
  LedgerIcon,
  PlusIcon,
  ReportIcon,
  StaffIcon,
  StudentsIcon,
} from "@/components/icons";

interface NavItem {
  href: string;
  label: string;
  icon: typeof DashboardIcon;
  /** When set, the item only shows for roles that hold this permission. */
  permission?: Permission;
}

/** The everyday tabs — also the mobile bottom bar. */
const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: DashboardIcon },
  { href: "/debtors", label: "Owing", icon: DebtorsIcon },
  { href: "/students", label: "Students", icon: StudentsIcon },
  { href: "/ledger", label: "Ledger", icon: LedgerIcon, permission: "view_ledger" },
];

/** Money-out & admin — desktop sidebar; reached from Ledger on mobile. */
const SECONDARY_NAV: NavItem[] = [
  { href: "/fees", label: "Fees", icon: FeesIcon, permission: "edit_fees" },
  { href: "/expenses", label: "Expenses", icon: ExpenseIcon, permission: "manage_expenses" },
  { href: "/staff", label: "Staff", icon: StaffIcon, permission: "manage_staff" },
  { href: "/reports", label: "Reports", icon: ReportIcon, permission: "view_reports" },
];

function visibleNav(items: NavItem[], role: Role): NavItem[] {
  return items.filter((i) => !i.permission || can(role, i.permission));
}

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Public / auth routes render without the app chrome (sidebar, nav). */
const BARE_ROUTES = ["/login", "/onboarding", "/register", "/auth"];

export function AppShell({ children }: { children: ReactNode }) {
  const { ready } = useViewer();
  const pathname = usePathname();

  if (BARE_ROUTES.some((r) => pathname.startsWith(r))) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-dvh bg-background md:flex">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-4 md:px-8 md:pb-10">
          {ready ? children : null}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}

// --- Desktop sidebar ---------------------------------------------------------

function Sidebar() {
  const pathname = usePathname();
  const { school, role } = useViewer();
  const showRecord = can(role, "record_payment");

  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-ink px-3 py-5 text-[#EDEFF2] md:flex">
      <div className="px-2">
        <p className="font-display text-lg font-extrabold tracking-tight text-white">
          Bursar
        </p>
        <p className="mt-0.5 truncate text-xs text-[#9aa4b2]">{school?.name}</p>
      </div>

      <nav className="mt-6 flex flex-col gap-0.5">
        {visibleNav(PRIMARY_NAV, role).map((item) => (
          <SidebarLink key={item.href} item={item} pathname={pathname} />
        ))}

        {visibleNav(SECONDARY_NAV, role).length > 0 && (
          <>
            <p className="mt-5 mb-1 px-3 font-mono text-[10px] uppercase tracking-wider text-[#6b7686]">
              Money out & admin
            </p>
            {visibleNav(SECONDARY_NAV, role).map((item) => (
              <SidebarLink key={item.href} item={item} pathname={pathname} />
            ))}
          </>
        )}
      </nav>

      {showRecord && (
        <Link
          href="/pay"
          className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition hover:bg-primary-hover"
        >
          <PlusIcon width={18} height={18} />
          Record payment
        </Link>
      )}

      <div className="mt-auto space-y-3 pt-6">
        <TermSelector variant="dark" />
        <UserChip variant="dark" />
      </div>
    </aside>
  );
}

function SidebarLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition",
        active
          ? "border-l-[3px] border-warning bg-white/[0.08] pl-2 font-semibold text-white"
          : "text-[#C7CCD4] hover:bg-white/[0.05]",
      )}
    >
      <Icon width={18} height={18} />
      {item.label}
    </Link>
  );
}

// --- Mobile top bar ----------------------------------------------------------

function TopBar() {
  const { school } = useViewer();
  const online = useOnline();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur md:hidden">
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="flex items-center gap-2.5">
          <Logo />
          <div className="leading-tight">
            <p className="font-display text-sm font-extrabold text-ink">Bursar</p>
            <p className="max-w-40 truncate text-xs text-ink-muted">
              {school?.name ?? "…"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!online && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-tint px-2.5 py-1 font-mono text-[11px] font-semibold uppercase text-warning">
              <span className="size-1.5 rounded-full bg-warning" />
              Offline
            </span>
          )}
          <UserChip variant="light" />
        </div>
      </div>
      <div className="px-4 pb-2.5 pt-2">
        <TermSelector variant="light" />
      </div>
    </header>
  );
}

function Logo() {
  return (
    <span className="flex size-8 items-center justify-center rounded-lg bg-ink text-white">
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

// --- Shared: term selector ---------------------------------------------------

function TermSelector({ variant }: { variant: "light" | "dark" }) {
  const { term, setTerm, session } = useViewer();
  const dark = variant === "dark";
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex rounded-lg p-0.5",
          dark ? "bg-white/10" : "bg-surface-sunken",
        )}
      >
        {TERMS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTerm(t.value)}
            className={cn(
              "rounded-md px-2.5 py-1 font-mono text-[11px] font-semibold uppercase transition",
              term === t.value
                ? dark
                  ? "bg-white/15 text-white"
                  : "bg-surface-raised text-ink shadow-sm"
                : dark
                  ? "text-[#9aa4b2]"
                  : "text-ink-muted",
            )}
          >
            {t.label.replace(" term", "")}
          </button>
        ))}
      </div>
      <span className={cn("text-xs", dark ? "text-[#9aa4b2]" : "text-ink-faint")}>
        {session?.name}
      </span>
    </div>
  );
}

// --- Shared: user chip + sign out --------------------------------------------

function UserChip({ variant }: { variant: "light" | "dark" }) {
  const { actorName, role } = useViewer();
  const dark = variant === "dark";
  const initials = actorName
    ? actorName
        .split(" ")
        .filter(Boolean)
        .slice(-2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "•";

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <details className="group relative">
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-2 rounded-full border px-2 py-1 text-xs font-semibold [&::-webkit-details-marker]:hidden",
          dark ? "border-white/15 text-[#EDEFF2]" : "border-border bg-surface-raised text-ink",
        )}
      >
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-[10px] font-bold",
            dark ? "bg-white/15 text-white" : "bg-primary-tint text-primary",
          )}
        >
          {initials}
        </span>
        <span className="max-w-24 truncate">{actorName || "Account"}</span>
      </summary>
      <div
        className={cn(
          "absolute z-30 mt-1 w-52 rounded-lg border border-border bg-surface-raised p-1 shadow-lg",
          dark ? "bottom-full mb-1 left-0" : "right-0",
        )}
      >
        <div className="px-3 py-2">
          <p className="truncate text-sm font-semibold text-ink">{actorName}</p>
          <p className="text-xs text-ink-faint">{ROLE_LABELS[role]}</p>
        </div>
        <button
          onClick={signOut}
          className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-danger hover:bg-surface-sunken"
        >
          Sign out
        </button>
      </div>
    </details>
  );
}

// --- Mobile bottom navigation ------------------------------------------------

function BottomNav() {
  const pathname = usePathname();
  const { role } = useViewer();
  const showRecord = can(role, "record_payment");
  const items = visibleNav(PRIMARY_NAV, role);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div
        className="relative mx-auto grid max-w-3xl"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active = isActive(pathname, item.href);
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
