import { create } from "zustand";
import { persist } from "zustand/middleware";

const BASE_URL = (typeof window !== "undefined" && import.meta.env.BASE_URL?.replace(/\/$/, "")) || "";

export interface StoreSettings {
  name: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  gst: string;
  logoEmoji: string;
  logoUrl: string;
  appSubtitle: string;
  footerNote: string;
  termsAndConditions: string[];
  upiId: string;
  dynamicQrMode: boolean;
  labelShowPrice: boolean;
  scannerThresholdMs: number;
  receiptPaperWidth: "58mm" | "80mm";
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

export const useStoreSettings = create<StoreSettingsStore>()(
  persist(
    (set, get) => ({
      name:          "Your Shop Name",
      tagline:       "Set your tagline in Settings",
      phone:         "",
      email:         "",
      address:       "",
      gst:           "",
      logoEmoji:     "🏪",
      logoUrl:       "",
      appSubtitle:   "Billing & Inventory",
      footerNote:    "Thank you for your business.",
      termsAndConditions: [
        "No Cash Refund.",
        "Goods once sold will not be returned or exchanged.",
      ],
      upiId:         "",
      dynamicQrMode: false,
      labelShowPrice: true,
      scannerThresholdMs: 100,
      receiptPaperWidth: "80mm",

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
            // Merge server values on top of local — server is authoritative
            set({ ...body.data, _hydrated: true });
          } else {
            set({ _hydrated: true });
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
