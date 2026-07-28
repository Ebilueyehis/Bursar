import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { formatNairaSmart } from "@/lib/money";

/** Tiny classnames joiner — avoids pulling in a dependency for this. */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// --- Button -----------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-hover",
  secondary:
    "bg-surface text-ink border border-border-strong hover:bg-surface-sunken",
  ghost: "text-primary hover:bg-primary-tint",
  danger: "bg-danger text-white hover:opacity-90",
};

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cn(
        // 48px min height = comfortable phone tap target
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        buttonVariants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// --- Card --------------------------------------------------------------------

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(16,32,27,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

// --- Money -------------------------------------------------------------------

/** The money display. Always tabular so figures line up in a column. */
export function Money({
  kobo,
  className,
  tone = "ink",
}: {
  kobo: number;
  className?: string;
  tone?: "ink" | "muted" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    ink: "text-ink",
    muted: "text-ink-muted",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  }[tone];
  return (
    <span className={cn("tabular font-semibold", toneClass, className)}>
      {formatNairaSmart(kobo)}
    </span>
  );
}

// --- Status pill -------------------------------------------------------------

type PillTone = "paid" | "partial" | "unpaid" | "neutral";

export function StatusPill({
  tone,
  children,
}: {
  tone: PillTone;
  children: ReactNode;
}) {
  const styles: Record<PillTone, string> = {
    paid: "bg-success-tint text-success",
    partial: "bg-warning-tint text-warning",
    unpaid: "bg-danger-tint text-danger",
    neutral: "bg-surface-sunken text-ink-muted",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        styles[tone],
      )}
    >
      {children}
    </span>
  );
}

// --- Page header -------------------------------------------------------------

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

// --- Empty / loading ---------------------------------------------------------

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
      {icon && <div className="mb-3 text-ink-faint">{icon}</div>}
      <p className="font-semibold text-ink">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-sm text-ink-muted">{description}</p>
      )}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "size-6 animate-spin rounded-full border-2 border-border border-t-primary",
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-ink-muted">
      <Spinner />
      <p className="text-sm">{label}</p>
    </div>
  );
}

// --- Form fields -------------------------------------------------------------

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-sm text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-sm text-ink-muted">{hint}</span>
      ) : null}
    </label>
  );
}

const fieldBase =
  "w-full rounded-lg border border-border-strong bg-surface px-3.5 min-h-12 text-base text-ink placeholder:text-ink-faint focus:border-primary";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, props.className)} {...props} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(fieldBase, "py-3 min-h-24", props.className)}
      {...props}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldBase, "appearance-none pr-10", props.className)} {...props} />
  );
}
