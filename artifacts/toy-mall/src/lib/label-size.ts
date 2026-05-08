export const MM_TO_PX = 3.7795275591;

export type LabelSize = { w: number; h: number };

export const LABEL_PRESETS = [
  { label: "50×25mm", w: 50, h: 25 },
  { label: "40×20mm", w: 40, h: 20 },
  { label: "60×30mm", w: 60, h: 30 },
] as const;

const LS_KEY = "toy-mall-label-size";

export function loadLabelSize(): LabelSize {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.w === "number" && typeof parsed.h === "number" && parsed.w > 0 && parsed.h > 0) {
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return { w: 50, h: 25 };
}

export function saveLabelSize(size: LabelSize) {
  localStorage.setItem(LS_KEY, JSON.stringify(size));
}

export function isPresetSize(size: LabelSize) {
  return LABEL_PRESETS.some((p) => p.w === size.w && p.h === size.h);
}
