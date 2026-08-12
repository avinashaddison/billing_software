/**
 * Admin console design system.
 *
 * This console is a control room for one person looking after many shops, so it
 * is set like a ledger rather than decorated like a dashboard: hairline rules
 * instead of boxes, type carrying the hierarchy, numbers aligned in tabular
 * figures, and colour reserved for the few states that actually demand a
 * decision. Nothing in here casts a shadow, wears a gradient, or sits in a
 * tinted pill — if something is coloured, it means the operator has to act.
 *
 * Every admin screen builds from these primitives so the whole console reads as
 * one surface. Reach for a primitive before writing a bespoke box.
 */
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/* ── Tone is a meaning, not a colour ──────────────────────────────
   Four tones exist and each answers "does this need me?". Tailwind needs whole
   class names, so they are looked up, never assembled from fragments. */
export type Tone = "neutral" | "positive" | "warn" | "danger";

const TONE_TEXT: Record<Tone, string> = {
  neutral:  "text-muted-foreground",
  positive: "text-emerald-600 dark:text-emerald-400",
  warn:     "text-amber-600 dark:text-amber-500",
  danger:   "text-destructive",
};

const TONE_DOT: Record<Tone, string> = {
  neutral:  "bg-muted-foreground/40",
  positive: "bg-emerald-500",
  warn:     "bg-amber-500",
  danger:   "bg-destructive",
};

const TONE_RULE: Record<Tone, string> = {
  neutral:  "border-border",
  positive: "border-emerald-500",
  warn:     "border-amber-500",
  danger:   "border-destructive",
};

/* ── Formatting ───────────────────────────────────────────────────
   Shared so every screen renders money and counts identically. */
export const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const count  = (n: number) => n.toLocaleString("en-IN");

/** Money shown EXACTLY as held — never rounds. Use wherever the figure on screen
 *  is the figure that will be saved (editable previews, price settings), because
 *  rupees()' rounding would quietly misreport ₹999.50 as ₹1,000. */
export const amountExact = (n: number) =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/* ── Page furniture ───────────────────────────────────────────────── */

export function PageHeader({
  title, meta, actions,
}: { title: string; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b pb-5">
      <div className="min-w-0">
        <h1 className="text-[22px] font-medium leading-tight tracking-tight">{title}</h1>
        {meta && <p className="mt-1.5 text-[13px] text-muted-foreground">{meta}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** The only heading style between the page title and body copy. */
export function SectionLabel({
  children, action,
}: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {children}
      </h2>
      {action}
    </div>
  );
}

/* ── Metrics ──────────────────────────────────────────────────────
   One framed strip split by hairlines. Four separate cards for four numbers is
   three borders more than the information needs. The gap-px over a border-
   coloured background keeps the rules exact however the grid wraps. */
export function MetricRow({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const grid = cols === 2 ? "sm:grid-cols-2" : cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4";
  return (
    <div className={`grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border ${grid}`}>
      {children}
    </div>
  );
}

export function Metric({
  label, value, hint, tone = "neutral",
}: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone }) {
  return (
    <div className="bg-background p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={`mt-2.5 break-words text-[26px] font-medium leading-none tracking-tight tabular-nums ${
        tone === "neutral" ? "" : TONE_TEXT[tone]
      }`}>
        {value}
      </p>
      {hint && <p className="mt-2 text-xs leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

/* ── Containers ───────────────────────────────────────────────────── */

export function Panel({
  title, action, children, className = "",
}: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-lg border ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          {typeof title === "string"
            ? <h3 className="text-[13px] font-medium">{title}</h3>
            : title}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** Hairline-separated list body. Pair with Row, or supply your own children. */
export function Rows({ children }: { children: ReactNode }) {
  return <div className="divide-y">{children}</div>;
}

export function Row({
  label, sub, value, tone = "neutral", onClick,
}: {
  label: ReactNode; sub?: ReactNode; value?: ReactNode;
  tone?: Tone; onClick?: () => void;
}) {
  const body = (
    <>
      <div className="min-w-0">
        <div className="truncate text-sm">{label}</div>
        {sub && <div className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</div>}
      </div>
      {value !== undefined && (
        <div className={`shrink-0 text-sm tabular-nums ${tone === "neutral" ? "" : TONE_TEXT[tone]}`}>
          {value}
        </div>
      )}
    </>
  );

  if (!onClick) {
    return <div className="flex items-center justify-between gap-4 px-4 py-3">{body}</div>;
  }
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/40"
    >
      {body}
    </button>
  );
}

/* ── Status ───────────────────────────────────────────────────────
   A dot and a word. No filled pill: a screen of tinted badges is exactly what
   stops any single one of them from meaning anything. */
export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium ${TONE_TEXT[tone]}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[tone]}`} />
      {children}
    </span>
  );
}

/** An advisory line. A left rule reads as an annotation; a filled box reads as
    an alarm, and most of these are not alarms. */
export function Notice({
  tone = "warn", children,
}: { tone?: Tone; children: ReactNode }) {
  return (
    <div className={`border-l-2 py-1.5 pl-3.5 text-[13px] leading-relaxed text-muted-foreground ${TONE_RULE[tone]}`}>
      {children}
    </div>
  );
}

export function EmptyState({
  icon: Icon, title, hint, action,
}: { icon?: LucideIcon; title: string; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-6 py-14 text-center">
      {Icon && <Icon className="mx-auto mb-3 h-5 w-5 text-muted-foreground/50" strokeWidth={1.5} />}
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Full-width error state for a failed load. */
export function LoadError({ message }: { message?: string }) {
  return (
    <div className="rounded-lg border border-destructive/40 px-5 py-6">
      <p className="text-sm font-medium text-destructive">Could not load this section</p>
      <p className="mt-1 text-[13px] text-muted-foreground">{message ?? "Unknown error"}</p>
    </div>
  );
}

/** Search / filter strip that sits above a list. */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>;
}

/** Text-only filter chip. Selected state is weight and ink, not a fill. */
export function FilterChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
        active
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
