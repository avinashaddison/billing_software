import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  update: (patch: Partial<StoreSettings>) => void;
}

export const useStoreSettings = create<StoreSettingsStore>()(
  persist(
    (set) => ({
      name:          "Hira & Sons Gift Shop",
      tagline:       "The Complete Toy Store",
      phone:         "+91 94318 01793",
      email:         "",
      address:       "Near Old Bus Stand, Ranchi, Jharkhand - 834001",
      gst:           "",
      logoEmoji:     "🧸",
      logoUrl:       "",
      appSubtitle:   "Billing Management",
      footerNote:    "Goods once sold will not be returned or exchanged.",
      termsAndConditions: [
        "No Cash Refund.",
        "Goods once sold will not be returned or exchanged.",
        "Subject to Ranchi jurisdiction.",
      ],
      upiId:         "",
      dynamicQrMode: false,
      labelShowPrice: true,
      scannerThresholdMs: 100,
      receiptPaperWidth: "80mm",
      update: (patch) => set(patch),
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
