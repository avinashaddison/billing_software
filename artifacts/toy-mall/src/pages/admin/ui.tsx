/**
 * Admin console design system.
 *
 * Redesigned to match the new visual language: card-based layout with coloured
 * icon badges, subtle shadows, and a violet/indigo accent palette. Every admin
 * screen builds from these primitives so the whole console reads as one surface.
 */
import { useId } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/* ── Tone is a meaning, not a colour ─────────────────────────────── */
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

/* ── Formatting ───────────────────────────────────────────────────── */
export const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const count  = (n: number) => n.toLocaleString("en-IN");

export const amountExact = (n: number) =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/* ── Sparkline ─────────────────────────────────────────────────────
   Lightweight SVG mini-chart — no external library needed.
   Plots only real data points supplied by the caller; if there is
   nothing meaningful to plot it renders nothing rather than inventing
   a shape. */
export function Sparkline({
  data,
  color = "#7C3AED",
  width = 84,
  height = 36,
  label,
}: {
  /** Real observations, oldest first (e.g. daily revenue). */
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  /** What the points measure — surfaced as tooltip + accessible name. */
  label?: string;
}) {
  const gradId = useId();
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pad = 3;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    // A flat series (all equal) draws a centred line, not a bottom-hugging one.
    const y = max === min
      ? height / 2
      : height - pad - ((v - min) / (max - min)) * (height - pad * 2);
    return [x, y] as [number, number];
  });

  // Smooth curve via cubic bezier control points
  const curve = pts.reduce((acc, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`;
    const [px, py] = pts[i - 1]!;
    const cpx = (px + x) / 2;
    return `${acc} C ${cpx} ${py} ${cpx} ${y} ${x} ${y}`;
  }, "");

  const fill =
    `${curve} L ${pts[pts.length - 1]![0]} ${height} L ${pts[0]![0]} ${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {label && <title>{label}</title>}
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${gradId})`} />
      <path d={curve} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Page furniture ───────────────────────────────────────────────── */

export function PageHeader({
  title, meta, actions,
}: { title: string; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[20px] font-bold leading-tight tracking-tight text-gray-900">{title}</h1>
          {meta && (
            <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-violet-100">
              {meta}
            </span>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionLabel({
  children, action, icon: Icon,
}: { children: ReactNode; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-violet-500" strokeWidth={1.75} />}
        <h2 className="text-[14px] font-semibold text-gray-900">{children}</h2>
      </div>
      {action}
    </div>
  );
}

/* ── Metric cards ─────────────────────────────────────────────────
   Individual cards with coloured icon badge + sparkline. */
export function MetricRow({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const grid =
    cols === 2 ? "sm:grid-cols-2"
    : cols === 3 ? "sm:grid-cols-3"
    : "sm:grid-cols-2 lg:grid-cols-4";
  return (
    <div className={`grid grid-cols-1 gap-4 ${grid}`}>
      {children}
    </div>
  );
}

export function Metric({
  label, value, hint, tone = "neutral",
  icon: Icon,
  iconBg = "bg-violet-100",
  iconColor = "text-violet-600",
  spark,
  sparkColor = "#7C3AED",
  sparkLabel,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  /** Real data points, oldest first (e.g. daily revenue). Omit to hide the trend. */
  spark?: number[];
  sparkColor?: string;
  /** What the points measure, e.g. "Daily revenue, last 14 days". */
  sparkLabel?: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          {Icon && (
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
              <Icon className={`h-5 w-5 ${iconColor}`} strokeWidth={1.75} />
            </div>
          )}
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{label}</p>
          <p className={`mt-1.5 break-words text-[26px] font-bold leading-none tracking-tight tabular-nums ${
            tone === "neutral" ? "text-gray-900" : TONE_TEXT[tone]
          }`}>
            {value}
          </p>
          {hint && <p className="mt-1.5 text-[12px] leading-snug text-gray-400">{hint}</p>}
        </div>
        {spark && spark.length >= 2 && (
          <div className="shrink-0 pt-0.5">
            <Sparkline data={spark} color={sparkColor} label={sparkLabel} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Containers ───────────────────────────────────────────────────── */

export function Panel({
  title, action, children, className = "",
}: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          {typeof title === "string"
            ? <h3 className="text-[14px] font-semibold text-gray-900">{title}</h3>
            : title}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Rows({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-gray-50">{children}</div>;
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
        <div className="truncate text-[13px] font-medium text-gray-900">{label}</div>
        {sub && <div className="mt-0.5 truncate text-[12px] text-gray-400">{sub}</div>}
      </div>
      {value !== undefined && (
        <div className={`shrink-0 text-[13px] font-semibold tabular-nums ${tone === "neutral" ? "text-gray-700" : TONE_TEXT[tone]}`}>
          {value}
        </div>
      )}
    </>
  );

  if (!onClick) {
    return <div className="flex items-center justify-between gap-4 px-5 py-3.5">{body}</div>;
  }
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left transition-colors hover:bg-violet-50/50"
    >
      {body}
    </button>
  );
}

/* ── Status ───────────────────────────────────────────────────────── */

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const pill: Record<Tone, string> = {
    neutral:  "bg-gray-100 text-gray-500",
    positive: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    warn:     "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
    danger:   "bg-red-50 text-red-600 ring-1 ring-red-100",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${pill[tone]}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[tone]}`} />
      {children}
    </span>
  );
}

export function Notice({
  tone = "warn", children,
}: { tone?: Tone; children: ReactNode }) {
  const style: Record<Tone, string> = {
    neutral: "bg-gray-50 border-gray-200 text-gray-600",
    positive: "bg-emerald-50 border-emerald-200 text-emerald-700",
    warn: "bg-amber-50 border-amber-200 text-amber-700",
    danger: "bg-red-50 border-red-200 text-red-700",
  };
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px] leading-relaxed ${style[tone]}`}>
      <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[tone]}`} />
      <span>{children}</span>
    </div>
  );
}

export function EmptyState({
  icon: Icon, title, hint, action,
}: { icon?: LucideIcon; title: string; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-6 py-14 text-center">
      {Icon && (
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50">
          <Icon className="h-5 w-5 text-violet-400" strokeWidth={1.5} />
        </div>
      )}
      <p className="text-[13px] font-semibold text-gray-900">{title}</p>
      {hint && <p className="mx-auto mt-1.5 max-w-sm text-[12px] leading-relaxed text-gray-400">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadError({ message }: { message?: string }) {
  return (
    <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-6">
      <p className="text-[13px] font-semibold text-red-700">Could not load this section</p>
      <p className="mt-1 text-[12px] text-red-500">{message ?? "Unknown error"}</p>
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>;
}

export function FilterChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
        active
          ? "bg-violet-600 text-white shadow-sm"
          : "bg-white border border-gray-200 text-gray-500 hover:border-violet-300 hover:text-violet-700"
      }`}
    >
      {children}
    </button>
  );
}
