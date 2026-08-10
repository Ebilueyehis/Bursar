"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useViewer } from "@/lib/viewer";
import type { Permission } from "@/lib/domain/constants";
import { ROLE_LABELS, TERMS, can, termLabel } from "@/lib/domain/constants";
import type { Role } from "@/lib/domain/types";
import { cn } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useOnline } from "@/lib/useOnline";
import {
  DashboardIcon,
  LedgerIcon,
  PlusIcon,
  RecordsIcon,
  StudentsIcon,
} from "@/components/icons";

interface NavItem {
  href: string;
  label: string;
  icon: typeof DashboardIcon;
  /** When set, the item only shows for roles that hold this permission. */
  permission?: Permission;
}

/** Primary tabs — sidebar on desktop, the outer items of the mobile bottom bar. */
const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: DashboardIcon },
  { href: "/students", label: "Students", icon: StudentsIcon },
  { href: "/records", label: "Records", icon: RecordsIcon, permission: "view_grades" },
  { href: "/payments", label: "Payments", icon: LedgerIcon, permission: "view_ledger" },
];

/** Screen titles keyed by their route base, longest match wins. */
const TITLES: { base: string; title: string }[] = [
  { base: "/students", title: "Students" },
  { base: "/payments", title: "Payments" },
  { base: "/records", title: "Records" },
  { base: "/entry", title: "New Entry" },
  { base: "/profile", title: "Profile & settings" },
  { base: "/", title: "Dashboard" },
];

function titleFor(pathname: string): string {
  const hit = TITLES.filter((t) =>
    t.base === "/" ? pathname === "/" : pathname.startsWith(t.base),
  ).sort((a, b) => b.base.length - a.base.length)[0];
  return hit?.title ?? "Bursar";
}

function visibleNav(items: NavItem[], role: Role): NavItem[] {
  return items.filter((i) => !i.permission || can(role, i.permission));
}

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

function initials(name: string): string {
  return name
    ? name.split(/\s+/).filter(Boolean).slice(-2).map((n) => n[0]).join("").toUpperCase()
    : "•";
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
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-4 md:px-8 md:pb-10 md:pt-6">
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
  const { school, role, actorName } = useViewer();

  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-[#16212e] px-3 py-5 text-[#EDEFF2] md:flex">
      <div className="flex items-center gap-2.5 px-2">
        <Logo dark />
        <div className="leading-tight">
          <p className="font-display text-lg font-extrabold tracking-tight text-white">
            Bursar
          </p>
          <p className="mt-0.5 max-w-40 truncate text-xs text-[#9aa4b2]">
            {school?.name}
          </p>
        </div>
      </div>

      <nav className="mt-7 flex flex-col gap-0.5">
        {visibleNav(PRIMARY_NAV, role).map((item) => (
          <SidebarLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      <div className="mt-auto pt-6">
        <Link
          href="/profile"
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition",
            isActive(pathname, "/profile")
              ? "bg-white/[0.08]"
              : "hover:bg-white/[0.05]",
          )}
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-white/15 text-[11px] font-bold text-white">
            {initials(actorName)}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold text-white">
              {actorName || "Account"}
            </span>
            <span className="block text-xs text-[#9aa4b2]">{ROLE_LABELS[role]}</span>
          </span>
        </Link>
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

// --- Top bar (responsive) ----------------------------------------------------

function TopBar() {
  const pathname = usePathname();
  const { actorName, role, school } = useViewer();
  const online = useOnline();
  const showEntry = can(role, "record_payment");
  const title = titleFor(pathname);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-2.5 md:px-8">
        {/* Mobile brand (sidebar is hidden) */}
        <div className="flex items-center gap-2.5 md:hidden">
          <Logo />
          <p className="max-w-28 truncate text-sm font-semibold text-ink">
            {school?.name ?? "Bursar"}
          </p>
        </div>

        {/* Desktop greeting + screen title */}
        <div className="hidden min-w-0 md:block">
          {actorName && (
            <p className="text-xs font-medium text-ink-faint">
              {greeting()}, {firstName(actorName)}
            </p>
          )}
          <h2 className="truncate font-display text-xl font-bold text-ink">{title}</h2>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {!online && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-tint px-2.5 py-1 text-[11px] font-semibold uppercase text-warning">
              <span className="size-1.5 rounded-full bg-warning" />
              Offline
            </span>
          )}
          <TermBadge />
          {showEntry && (
            <Link
              href="/entry"
              className="hidden items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-on-primary transition hover:bg-primary-hover md:inline-flex"
            >
              <PlusIcon width={17} height={17} />
              New Entry
            </Link>
          )}
          <UserChip name={actorName} role={role} />
        </div>
      </div>
    </header>
  );
}

function Logo({ dark }: { dark?: boolean }) {
  return (
    <span
      className={cn(
        "flex size-8 items-center justify-center rounded-lg",
        dark ? "bg-white/15 text-white" : "bg-ink text-white",
      )}
    >
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

// --- Subscription-style term badge -------------------------------------------

function TermBadge() {
  const { term, setTerm, session } = useViewer();
  const year = (session?.name ?? "").replace("/", " / ");

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-border bg-surface-raised py-1 pl-1 pr-2 [&::-webkit-details-marker]:hidden">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary-tint text-primary">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
            <rect x="3.5" y="5" width="17" height="16" rx="2" />
            <path d="M3.5 9.5h17M8 3v4M16 3v4" />
          </svg>
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-[13px] font-semibold text-ink">
            {termLabel(term)}
          </span>
          {year && (
            <span className="block text-[11px] tabular-nums text-ink-faint">{year}</span>
          )}
        </span>
        <svg className="text-ink-faint" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="absolute right-0 z-30 mt-1 w-44 rounded-lg border border-border bg-surface-raised p-1 shadow-lg">
        <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          Switch term
        </p>
        {TERMS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTerm(t.value)}
            className={cn(
              "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm",
              term === t.value
                ? "bg-primary-tint font-semibold text-primary"
                : "text-ink hover:bg-surface-sunken",
            )}
          >
            {t.label}
            {term === t.value && (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </details>
  );
}

// --- User chip: avatar to profile, with sign out -----------------------------

function UserChip({ name, role }: { name: string; role: Role }) {
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <details className="group relative">
      <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-full bg-primary-tint text-[11px] font-bold text-primary [&::-webkit-details-marker]:hidden">
        {initials(name)}
      </summary>
      <div className="absolute right-0 z-30 mt-1 w-52 rounded-lg border border-border bg-surface-raised p-1 shadow-lg">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-semibold text-ink">{name || "Account"}</p>
          <p className="text-xs text-ink-faint">{ROLE_LABELS[role]}</p>
        </div>
        <Link
          href="/profile"
          className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-ink hover:bg-surface-sunken"
        >
          Profile & settings
        </Link>
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
  const showEntry = can(role, "record_payment");
  const items = visibleNav(PRIMARY_NAV, role);

  // Dashboard · Students · (+New) · Records · Payments — the plus sits centre.
  // Profile lives only in the top-right header chip, not in this bar.
  const left = items.slice(0, 2);
  const right = items.slice(2);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="relative mx-auto flex max-w-3xl items-stretch justify-around">
        {left.map((item) => (
          <BottomLink key={item.href} item={item} pathname={pathname} />
        ))}

        {showEntry ? (
          <Link
            href="/entry"
            aria-label="New Entry"
            className="relative flex w-16 shrink-0 items-center justify-center"
          >
            <span className="absolute -top-6 flex size-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg ring-4 ring-background transition hover:bg-primary-hover">
              <PlusIcon width={26} height={26} />
            </span>
          </Link>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {right.map((item) => (
          <BottomLink key={item.href} item={item} pathname={pathname} />
        ))}
      </div>
    </nav>
  );
}

function BottomLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
        active ? "text-primary" : "text-ink-muted",
      )}
    >
      <Icon width={22} height={22} />
      {item.label}
    </Link>
  );
}
