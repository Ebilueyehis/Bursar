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
// Verbs describe the action, not the system: "Record payment", never "Submit".

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover border border-transparent",
  secondary: "bg-transparent text-ink border border-ink hover:bg-ink/5",
  ghost: "bg-slate-tint text-ink border border-transparent hover:bg-slate-tint/70",
  danger: "bg-danger text-white border border-transparent hover:opacity-90",
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
        // 44px min height = comfortable phone tap target
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
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
        "rounded-lg border border-border bg-surface p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

// --- Money -------------------------------------------------------------------
// Always IBM Plex Mono so figures line up in a fixed-width column.

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
    muted: "text-ink-faint",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  }[tone];
  return (
    <span className={cn("money font-semibold", toneClass, className)}>
      {formatNairaSmart(kobo)}
    </span>
  );
}

// --- Status stamp ------------------------------------------------------------
// Shaped like a receipt stamp (bordered, mono, uppercase), not a gradient pill.

type PillTone = "paid" | "partial" | "unpaid" | "neutral";

export function StatusPill({
  tone,
  children,
}: {
  tone: PillTone;
  children: ReactNode;
}) {
  const styles: Record<PillTone, string> = {
    paid: "text-success bg-success-tint",
    partial: "text-warning bg-warning-tint",
    unpaid: "text-danger bg-danger-tint",
    neutral: "text-slate bg-slate-tint",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-current px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        "font-mono",
        styles[tone],
      )}
    >
      {children}
    </span>
  );
}

// --- Receipt card (signature element) ---------------------------------------
// Torn-edge card via the .receipt class in globals.css.

export function Receipt({
  receiptNo,
  date,
  children,
  className,
}: {
  receiptNo?: string;
  date?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("receipt p-5", className)}>
      {(receiptNo || date) && (
        <div className="mb-3 flex justify-between border-b border-dashed border-border pb-3 font-mono text-[11px] uppercase tracking-wide text-ink-faint">
          <span>{receiptNo}</span>
          <span>{date}</span>
        </div>
      )}
      {children}
    </div>
  );
}

export function ReceiptLine({
  label,
  sub,
  amount,
}: {
  label: ReactNode;
  sub?: ReactNode;
  amount?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between py-1 text-sm">
      <div>
        <div className="text-ink">{label}</div>
        {sub && <div className="text-xs text-ink-faint">{sub}</div>}
      </div>
      {amount && <div className="money font-semibold text-ink">{amount}</div>}
    </div>
  );
}

// --- Banner ------------------------------------------------------------------
// Errors state what's still safe. Success stays understated.

export function Banner({
  tone,
  title,
  children,
}: {
  tone: "error" | "success" | "info";
  title?: string;
  children?: ReactNode;
}) {
  const styles = {
    error: "bg-danger-tint border-danger",
    success: "bg-success-tint border-success",
    info: "bg-slate-tint border-slate",
  }[tone];
  return (
    <div className={cn("rounded-lg border-l-4 px-4 py-3 text-sm text-ink", styles)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <p className={cn(title && "mt-0.5", "text-ink-muted")}>{children}</p>}
    </div>
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
        <h1 className="text-2xl font-extrabold text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
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
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
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
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
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
  "w-full rounded-lg border border-border bg-surface-raised px-3.5 min-h-11 text-base text-ink placeholder:text-ink-faint focus:border-primary";

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
