/**
 * Sidebar header (logo card) theme presets.
 *
 * Picked by the shop owner from Settings → "Sidebar Header Theme".
 * Each preset re-skins the gradient card behind the logo + shop name
 * without changing any structure or content.
 */

export type LogoBgTheme =
  | "indigo"
  | "sunset"
  | "emerald"
  | "royal"
  | "ocean"
  | "saffron"
  | "midnight"
  | "rose";

export interface SidebarTheme {
  /** Human-readable label shown in Settings */
  label: string;
  /** Tailwind classes for the outer card: bg-gradient-to-br from-X via-Y to-Z */
  outer: string;
  /** Three stacked radial-gradient overlays — inline style.background string */
  radial: string;
  /** Top-left ambient blob */
  blob1: string;
  /** Bottom-right ambient blob */
  blob2: string;
  /** Sparkle accent color in the top-right corner */
  sparkle: string;
  /** Gradient classes for the "Addison Bill Media" subtitle text-clip */
  accentText: string;
  /** Outer-glow gradient for the logo tile */
  glow: string;
  /** Hairline accent under the card */
  hairline: string;
  /** Small swatch gradient used in the Settings picker (one-line CSS) */
  swatch: string;
}

export const SIDEBAR_THEMES: Record<LogoBgTheme, SidebarTheme> = {
  indigo: {
    label: "Indigo (default)",
    outer: "from-slate-900 via-indigo-900 to-slate-900",
    radial:
      "radial-gradient(120% 80% at 0% 0%, rgba(139,92,246,0.45) 0%, transparent 50%), " +
      "radial-gradient(100% 70% at 100% 100%, rgba(56,189,248,0.30) 0%, transparent 55%), " +
      "radial-gradient(60% 60% at 80% 0%, rgba(236,72,153,0.20) 0%, transparent 60%)",
    blob1: "bg-violet-500/40",
    blob2: "bg-cyan-400/25",
    sparkle: "text-amber-200/70",
    accentText: "from-violet-200 via-fuchsia-200 to-cyan-200",
    glow: "from-fuchsia-400 via-violet-400 to-cyan-400",
    hairline: "via-violet-400/40",
    swatch:
      "linear-gradient(135deg, #0f172a 0%, #312e81 50%, #0f172a 100%)",
  },
  sunset: {
    label: "Sunset",
    outer: "from-rose-900 via-orange-900 to-amber-900",
    radial:
      "radial-gradient(120% 80% at 0% 0%, rgba(244,63,94,0.55) 0%, transparent 50%), " +
      "radial-gradient(100% 70% at 100% 100%, rgba(251,146,60,0.40) 0%, transparent 55%), " +
      "radial-gradient(60% 60% at 80% 0%, rgba(253,224,71,0.25) 0%, transparent 60%)",
    blob1: "bg-rose-500/40",
    blob2: "bg-amber-400/30",
    sparkle: "text-amber-100/80",
    accentText: "from-amber-200 via-rose-200 to-orange-200",
    glow: "from-rose-400 via-orange-400 to-amber-400",
    hairline: "via-rose-400/40",
    swatch:
      "linear-gradient(135deg, #881337 0%, #7c2d12 50%, #78350f 100%)",
  },
  emerald: {
    label: "Emerald",
    outer: "from-emerald-950 via-teal-900 to-cyan-950",
    radial:
      "radial-gradient(120% 80% at 0% 0%, rgba(16,185,129,0.50) 0%, transparent 50%), " +
      "radial-gradient(100% 70% at 100% 100%, rgba(34,211,238,0.35) 0%, transparent 55%), " +
      "radial-gradient(60% 60% at 80% 0%, rgba(132,204,22,0.20) 0%, transparent 60%)",
    blob1: "bg-emerald-500/40",
    blob2: "bg-cyan-400/25",
    sparkle: "text-emerald-100/80",
    accentText: "from-emerald-200 via-teal-200 to-cyan-200",
    glow: "from-emerald-400 via-teal-400 to-cyan-400",
    hairline: "via-emerald-400/40",
    swatch:
      "linear-gradient(135deg, #022c22 0%, #134e4a 50%, #083344 100%)",
  },
  royal: {
    label: "Royal Purple",
    outer: "from-violet-950 via-purple-900 to-fuchsia-950",
    radial:
      "radial-gradient(120% 80% at 0% 0%, rgba(168,85,247,0.50) 0%, transparent 50%), " +
      "radial-gradient(100% 70% at 100% 100%, rgba(236,72,153,0.35) 0%, transparent 55%), " +
      "radial-gradient(60% 60% at 80% 0%, rgba(99,102,241,0.25) 0%, transparent 60%)",
    blob1: "bg-purple-500/40",
    blob2: "bg-fuchsia-400/25",
    sparkle: "text-fuchsia-100/80",
    accentText: "from-violet-200 via-fuchsia-200 to-pink-200",
    glow: "from-violet-400 via-purple-400 to-fuchsia-400",
    hairline: "via-purple-400/40",
    swatch:
      "linear-gradient(135deg, #2e1065 0%, #581c87 50%, #4a044e 100%)",
  },
  ocean: {
    label: "Ocean",
    outer: "from-sky-950 via-blue-900 to-cyan-950",
    radial:
      "radial-gradient(120% 80% at 0% 0%, rgba(56,189,248,0.50) 0%, transparent 50%), " +
      "radial-gradient(100% 70% at 100% 100%, rgba(14,165,233,0.35) 0%, transparent 55%), " +
      "radial-gradient(60% 60% at 80% 0%, rgba(34,211,238,0.25) 0%, transparent 60%)",
    blob1: "bg-sky-500/40",
    blob2: "bg-cyan-400/25",
    sparkle: "text-sky-100/80",
    accentText: "from-sky-200 via-cyan-200 to-blue-200",
    glow: "from-sky-400 via-blue-400 to-cyan-400",
    hairline: "via-sky-400/40",
    swatch:
      "linear-gradient(135deg, #082f49 0%, #1e3a8a 50%, #083344 100%)",
  },
  saffron: {
    label: "Saffron (Bharat)",
    outer: "from-orange-700 via-rose-700 to-red-800",
    radial:
      "radial-gradient(120% 80% at 0% 0%, rgba(251,146,60,0.55) 0%, transparent 50%), " +
      "radial-gradient(100% 70% at 100% 100%, rgba(244,63,94,0.40) 0%, transparent 55%), " +
      "radial-gradient(60% 60% at 80% 0%, rgba(253,224,71,0.25) 0%, transparent 60%)",
    blob1: "bg-orange-400/40",
    blob2: "bg-rose-400/30",
    sparkle: "text-amber-100/85",
    accentText: "from-amber-100 via-orange-100 to-rose-100",
    glow: "from-amber-400 via-orange-400 to-rose-400",
    hairline: "via-amber-300/50",
    swatch:
      "linear-gradient(135deg, #c2410c 0%, #be123c 50%, #991b1b 100%)",
  },
  midnight: {
    label: "Midnight",
    outer: "from-slate-950 via-slate-900 to-black",
    radial:
      "radial-gradient(120% 80% at 0% 0%, rgba(71,85,105,0.45) 0%, transparent 50%), " +
      "radial-gradient(100% 70% at 100% 100%, rgba(100,116,139,0.25) 0%, transparent 55%), " +
      "radial-gradient(60% 60% at 80% 0%, rgba(148,163,184,0.18) 0%, transparent 60%)",
    blob1: "bg-slate-500/30",
    blob2: "bg-slate-400/20",
    sparkle: "text-slate-200/70",
    accentText: "from-slate-200 via-slate-300 to-slate-200",
    glow: "from-slate-500 via-slate-400 to-slate-500",
    hairline: "via-slate-500/40",
    swatch:
      "linear-gradient(135deg, #020617 0%, #0f172a 50%, #000000 100%)",
  },
  rose: {
    label: "Rose Gold",
    outer: "from-rose-900 via-pink-900 to-fuchsia-950",
    radial:
      "radial-gradient(120% 80% at 0% 0%, rgba(244,63,94,0.50) 0%, transparent 50%), " +
      "radial-gradient(100% 70% at 100% 100%, rgba(236,72,153,0.35) 0%, transparent 55%), " +
      "radial-gradient(60% 60% at 80% 0%, rgba(251,113,133,0.25) 0%, transparent 60%)",
    blob1: "bg-rose-500/40",
    blob2: "bg-pink-400/25",
    sparkle: "text-rose-100/80",
    accentText: "from-rose-200 via-pink-200 to-fuchsia-200",
    glow: "from-rose-400 via-pink-400 to-fuchsia-400",
    hairline: "via-rose-400/40",
    swatch:
      "linear-gradient(135deg, #881337 0%, #831843 50%, #4a044e 100%)",
  },
};

export const DEFAULT_LOGO_BG_THEME: LogoBgTheme = "indigo";

export function getSidebarTheme(theme: string | undefined | null): SidebarTheme {
  if (theme && theme in SIDEBAR_THEMES) {
    return SIDEBAR_THEMES[theme as LogoBgTheme];
  }
  return SIDEBAR_THEMES[DEFAULT_LOGO_BG_THEME];
}
