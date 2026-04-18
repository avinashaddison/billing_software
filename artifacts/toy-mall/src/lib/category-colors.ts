export type CategoryStyle = {
  bg: string;
  border: string;
  text: string;
  badge: string;
  dot: string;
};

const CATEGORY_MAP: Record<string, CategoryStyle> = {
  "Remote Cars":     { bg: "bg-red-50 dark:bg-red-950/30",     border: "border-red-300 dark:border-red-800",     text: "text-red-700 dark:text-red-300",     badge: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",     dot: "bg-red-500"    },
  "Remote Control":  { bg: "bg-red-50 dark:bg-red-950/30",     border: "border-red-300 dark:border-red-800",     text: "text-red-700 dark:text-red-300",     badge: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",     dot: "bg-red-500"    },
  "Teddy Bears":     { bg: "bg-pink-50 dark:bg-pink-950/30",   border: "border-pink-300 dark:border-pink-800",   text: "text-pink-700 dark:text-pink-300",   badge: "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300",   dot: "bg-pink-500"   },
  "Plush Toys":      { bg: "bg-pink-50 dark:bg-pink-950/30",   border: "border-pink-300 dark:border-pink-800",   text: "text-pink-700 dark:text-pink-300",   badge: "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300",   dot: "bg-pink-500"   },
  "Building Blocks": { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-300 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300", dot: "bg-amber-500"  },
  "Drones":          { bg: "bg-sky-50 dark:bg-sky-950/30",     border: "border-sky-300 dark:border-sky-800",     text: "text-sky-700 dark:text-sky-300",     badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",     dot: "bg-sky-500"    },
  "Dolls":           { bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-300 dark:border-purple-800", text: "text-purple-700 dark:text-purple-300", badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300", dot: "bg-purple-500" },
  "Action Figures":  { bg: "bg-blue-50 dark:bg-blue-950/30",   border: "border-blue-300 dark:border-blue-800",   text: "text-blue-700 dark:text-blue-300",   badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",   dot: "bg-blue-500"   },
  "Board Games":     { bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-300 dark:border-green-800", text: "text-green-700 dark:text-green-300", badge: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300", dot: "bg-green-500"  },
  "Puzzles":         { bg: "bg-teal-50 dark:bg-teal-950/30",   border: "border-teal-300 dark:border-teal-800",   text: "text-teal-700 dark:text-teal-300",   badge: "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300",   dot: "bg-teal-500"   },
  "Outdoor Toys":    { bg: "bg-lime-50 dark:bg-lime-950/30",   border: "border-lime-300 dark:border-lime-800",   text: "text-lime-700 dark:text-lime-300",   badge: "bg-lime-100 text-lime-700 dark:bg-lime-900/50 dark:text-lime-300",   dot: "bg-lime-500"   },
};

const FALLBACK_COLORS: CategoryStyle[] = [
  { bg: "bg-violet-50 dark:bg-violet-950/30", border: "border-violet-300 dark:border-violet-800", text: "text-violet-700 dark:text-violet-300", badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300", dot: "bg-violet-500" },
  { bg: "bg-rose-50 dark:bg-rose-950/30",     border: "border-rose-300 dark:border-rose-800",     text: "text-rose-700 dark:text-rose-300",     badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",     dot: "bg-rose-500"   },
  { bg: "bg-cyan-50 dark:bg-cyan-950/30",     border: "border-cyan-300 dark:border-cyan-800",     text: "text-cyan-700 dark:text-cyan-300",     badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300",     dot: "bg-cyan-500"   },
  { bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-300 dark:border-orange-800", text: "text-orange-700 dark:text-orange-300", badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300", dot: "bg-orange-500" },
];

const cache = new Map<string, CategoryStyle>();

export function getCategoryStyle(category: string): CategoryStyle {
  if (CATEGORY_MAP[category]) return CATEGORY_MAP[category];
  if (cache.has(category)) return cache.get(category)!;
  const idx = [...category].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % FALLBACK_COLORS.length;
  const style = FALLBACK_COLORS[idx];
  cache.set(category, style);
  return style;
}

export const CATEGORY_EMOJI: Record<string, string> = {
  "Remote Cars": "🚗", "Remote Control": "🚗",
  "Teddy Bears": "🧸", "Plush Toys": "🧸",
  "Building Blocks": "🧱", "Drones": "🚁",
  "Dolls": "🪆", "Action Figures": "🦸",
  "Board Games": "🎲", "Puzzles": "🧩",
  "Outdoor Toys": "⚽",
};

export function getCategoryEmoji(category: string): string {
  return CATEGORY_EMOJI[category] ?? "🎁";
}

export type CategoryHex = { strip: string; badge: string; text: string };

const CATEGORY_HEX_MAP: Record<string, CategoryHex> = {
  "Remote Cars":     { strip: "#ef4444", badge: "#fee2e2", text: "#b91c1c" },
  "Remote Control":  { strip: "#ef4444", badge: "#fee2e2", text: "#b91c1c" },
  "Teddy Bears":     { strip: "#ec4899", badge: "#fce7f3", text: "#be185d" },
  "Plush Toys":      { strip: "#ec4899", badge: "#fce7f3", text: "#be185d" },
  "Building Blocks": { strip: "#f59e0b", badge: "#fef3c7", text: "#b45309" },
  "Drones":          { strip: "#0ea5e9", badge: "#e0f2fe", text: "#0369a1" },
  "Dolls":           { strip: "#a855f7", badge: "#f3e8ff", text: "#7e22ce" },
  "Action Figures":  { strip: "#3b82f6", badge: "#dbeafe", text: "#1d4ed8" },
  "Board Games":     { strip: "#22c55e", badge: "#dcfce7", text: "#15803d" },
  "Puzzles":         { strip: "#14b8a6", badge: "#ccfbf1", text: "#0f766e" },
  "Outdoor Toys":    { strip: "#84cc16", badge: "#f7fee7", text: "#3f6212" },
};

const HEX_FALLBACKS: CategoryHex[] = [
  { strip: "#8b5cf6", badge: "#ede9fe", text: "#5b21b6" },
  { strip: "#f43f5e", badge: "#ffe4e6", text: "#9f1239" },
  { strip: "#06b6d4", badge: "#cffafe", text: "#0e7490" },
  { strip: "#f97316", badge: "#ffedd5", text: "#c2410c" },
  { strip: "#6366f1", badge: "#e0e7ff", text: "#3730a3" },
  { strip: "#10b981", badge: "#d1fae5", text: "#065f46" },
];

const hexCache = new Map<string, CategoryHex>();

export function getCategoryHex(category: string): CategoryHex {
  if (CATEGORY_HEX_MAP[category]) return CATEGORY_HEX_MAP[category];
  if (hexCache.has(category)) return hexCache.get(category)!;
  const idx = [...category].reduce((a, c) => a + c.charCodeAt(0), 0) % HEX_FALLBACKS.length;
  const hex = HEX_FALLBACKS[idx];
  hexCache.set(category, hex);
  return hex;
}
