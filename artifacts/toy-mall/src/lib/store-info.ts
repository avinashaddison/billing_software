import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface StoreSettings {
  name: string;
  tagline: string;
  phone: string;
  address: string;
  gst: string;
  logoEmoji: string;
  appSubtitle: string;
  footerNote: string;
  upiId: string;
  dynamicQrMode: boolean;
  labelShowPrice: boolean;
  scannerThresholdMs: number;
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
      address:       "Near Old Bus Stand, Ranchi, Jharkhand - 834001",
      gst:           "",
      logoEmoji:     "🧸",
      appSubtitle:   "Billing Management",
      footerNote:    "Goods once sold will not be returned or exchanged.",
      upiId:         "",
      dynamicQrMode: false,
      labelShowPrice: true,
      scannerThresholdMs: 100,
      update: (patch) => set(patch),
    }),
    { name: "toy-mall-store-settings-v1" }
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
