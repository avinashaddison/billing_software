import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_LOGO_BG_THEME, type LogoBgTheme } from "@/lib/sidebar-themes";

const BASE_URL = (typeof window !== "undefined" && import.meta.env.BASE_URL?.replace(/\/$/, "")) || "";

export interface StoreSettings {
  name: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  gst: string;
  /** GST tax rate as a percentage (e.g. 5, 12, 18, 28). Treated as
   *  inclusive tax — the bill total already contains it. Set to 0 to
   *  hide the breakdown from receipts entirely. */
  gstRatePercent: number;
  logoEmoji: string;
  logoUrl: string;
  /** Background theme for the sidebar header logo card. */
  logoBgTheme: LogoBgTheme;
  appSubtitle: string;
  footerNote: string;
  termsAndConditions: string[];
  upiId: string;
  dynamicQrMode: boolean;
  labelShowPrice: boolean;
  scannerThresholdMs: number;
  receiptPaperWidth: "58mm" | "80mm";
  /** Festive bulb-laari decoration at the top of every page. Owner toggles
   *  from Settings → Customization. Default on for the festive feel; turn
   *  off if it feels too busy or for a clinical look. */
  bulbLaariEnabled: boolean;
  // Header Customization Settings
  headerLayout?: "split" | "single";
  headerFontFamily?: "Cinzel" | "Playfair Display" | "Inter" | "Courier New" | "Georgia" | "Montserrat" | "Sacramento" | "Great Vibes" | "Lora" | "Rubik" | "Oswald";
  headerBrandFontFamily?: "Cinzel" | "Playfair Display" | "Inter" | "Courier New" | "Georgia" | "Montserrat" | "Sacramento" | "Great Vibes" | "Lora" | "Rubik" | "Oswald";
  headerSubtitleFontFamily?: "Cinzel" | "Playfair Display" | "Inter" | "Courier New" | "Georgia" | "Montserrat" | "Sacramento" | "Great Vibes" | "Lora" | "Rubik" | "Oswald";
  headerTaglineFontFamily?: "Cinzel" | "Playfair Display" | "Inter" | "Courier New" | "Georgia" | "Montserrat" | "Sacramento" | "Great Vibes" | "Lora" | "Rubik" | "Oswald";
  headerAddressPhoneFontFamily?: "Cinzel" | "Playfair Display" | "Inter" | "Courier New" | "Georgia" | "Montserrat" | "Sacramento" | "Great Vibes" | "Lora" | "Rubik" | "Oswald";
  headerBrandFontSize?: number;
  headerSubtitleFontSize?: number;
  headerTaglineFontSize?: number;
  headerAddressPhoneFontSize?: number;
  headerLogoSize?: number;
  headerColorTheme?: "black" | "gold-navy";
  headerShowOrnaments?: boolean;
}

interface StoreSettingsStore extends StoreSettings {
  /** Hydrated = server values have been loaded at least once this session */
  _hydrated: boolean;
  /** Update locally only — used by the server-hydrate effect to avoid loops */
  applyServerPatch: (patch: Partial<StoreSettings>) => void;
  /** Update locally + write through to the server (best-effort) */
  update: (patch: Partial<StoreSettings>) => void;
  /** One-shot fetch from server. Call once on app mount. */
  hydrateFromServer: () => Promise<void>;
}

/**
 * Field-level defaults used as the base of every fresh hydration. Hydration
 * always REPLACES (not merges) so leftover state from a previous tenant's
 * session can't leak through into a new client's Settings screen.
 */
const SETTINGS_DEFAULTS: StoreSettings = {
  name:               "Your Shop Name",
  tagline:            "",
  phone:              "",
  email:              "",
  address:            "",
  gst:                "",
  gstRatePercent:     0,
  logoEmoji:          "🏪",
  logoUrl:            "",
  logoBgTheme:        DEFAULT_LOGO_BG_THEME,
  appSubtitle:        "",
  footerNote:         "",
  termsAndConditions: [],
  upiId:              "",
  dynamicQrMode:      false,
  labelShowPrice:     true,
  scannerThresholdMs: 100,
  receiptPaperWidth:  "80mm",
  bulbLaariEnabled:   true,
  headerLayout:       "split",
  headerFontFamily:   "Playfair Display",
  headerBrandFontFamily: "Playfair Display",
  headerSubtitleFontFamily: "Playfair Display",
  headerTaglineFontFamily: "Playfair Display",
  headerAddressPhoneFontFamily: "Inter",
  headerBrandFontSize: 28,
  headerSubtitleFontSize: 25,
  headerTaglineFontSize: 13,
  headerAddressPhoneFontSize: 12,
  headerLogoSize:     96,
  headerColorTheme:   "black",
  headerShowOrnaments: false,
};

export const useStoreSettings = create<StoreSettingsStore>()(
  persist(
    (set, get) => ({
      ...SETTINGS_DEFAULTS,

      _hydrated: false,
      applyServerPatch: (patch) => set({ ...patch, _hydrated: true }),
      update: (patch) => {
        // 1. update local state immediately (optimistic, fast UI)
        set(patch);
        // 2. push the FULL settings blob to the server (best-effort fire-and-forget)
        const full = { ...get(), ...patch };
        // Drop computed/transient keys before sending
        const {
          _hydrated: _h, applyServerPatch: _a, update: _u, hydrateFromServer: _hf,
          ...payload
        } = full as StoreSettingsStore;
        void _h; void _a; void _u; void _hf;
        try {
          fetch(`${BASE_URL}/api/settings`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }).catch(() => { /* network blip — local is still saved */ });
        } catch { /* ignore */ }
      },
      hydrateFromServer: async () => {
        try {
          const res = await fetch(`${BASE_URL}/api/settings`);
          if (!res.ok) return;
          const body = await res.json();
          if (body && body.data && typeof body.data === "object") {
            /* REPLACE (not merge) — start from defaults so any field missing
               from the server response goes back to its default instead of
               keeping a value cached from the previous tenant's session. */
            set({ ...SETTINGS_DEFAULTS, ...body.data, _hydrated: true });
          } else {
            /* No row yet for this tenant → reset to defaults entirely. */
            set({ ...SETTINGS_DEFAULTS, _hydrated: true });
          }
        } catch {
          // Server unreachable — keep local cache, no error to the user
          set({ _hydrated: true });
        }
      },
    }),
    { name: "toy-mall-store-settings-v1" }
  )
);

export interface StaffScannerPref {
  thresholdMs: number;
  deviceName?: string;
  confirmedAt: string;
}

interface PerStaffScannerStore {
  prefs: Record<string, StaffScannerPref>;
  setPref: (staffId: string, pref: StaffScannerPref) => void;
  getPref: (staffId: string) => StaffScannerPref | null;
}

export const usePerStaffScannerPrefs = create<PerStaffScannerStore>()(
  persist(
    (set, get) => ({
      prefs: {},
      setPref: (staffId, pref) =>
        set((s) => ({ prefs: { ...s.prefs, [staffId]: pref } })),
      getPref: (staffId) => get().prefs[staffId] ?? null,
    }),
    { name: "toy-mall-scanner-prefs-v1" }
  )
);

export const STORE_INFO = {
  get name()          { return useStoreSettings.getState().name; },
  get tagline()       { return useStoreSettings.getState().tagline; },
  get phone()         { return useStoreSettings.getState().phone; },
  get address()       { return useStoreSettings.getState().address; },
  get gst()           { return useStoreSettings.getState().gst; },
  get logoEmoji()     { return useStoreSettings.getState().logoEmoji; },
  get appSubtitle()   { return useStoreSettings.getState().appSubtitle; },
  get footerNote()    { return useStoreSettings.getState().footerNote; },
  get upiId()         { return useStoreSettings.getState().upiId; },
  get dynamicQrMode()      { return useStoreSettings.getState().dynamicQrMode; },
  get labelShowPrice()     { return useStoreSettings.getState().labelShowPrice; },
  get scannerThresholdMs() { return useStoreSettings.getState().scannerThresholdMs ?? 100; },
};
