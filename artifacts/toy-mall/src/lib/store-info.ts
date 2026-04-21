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
}

interface StoreSettingsStore extends StoreSettings {
  update: (patch: Partial<StoreSettings>) => void;
}

export const useStoreSettings = create<StoreSettingsStore>()(
  persist(
    (set) => ({
      name:        "VishwaKarma Complex",
      tagline:     "The Complete Toy Store",
      phone:       "+91 94318 01793",
      address:     "Near Old Bus Stand, Ranchi, Jharkhand - 834001",
      gst:         "",
      logoEmoji:   "🧸",
      appSubtitle: "Billing Management",
      footerNote:  "Goods once sold will not be returned or exchanged.",
      update: (patch) => set(patch),
    }),
    { name: "toy-mall-store-settings-v1" }
  )
);

export const STORE_INFO = {
  get name()        { return useStoreSettings.getState().name; },
  get tagline()     { return useStoreSettings.getState().tagline; },
  get phone()       { return useStoreSettings.getState().phone; },
  get address()     { return useStoreSettings.getState().address; },
  get gst()         { return useStoreSettings.getState().gst; },
  get logoEmoji()   { return useStoreSettings.getState().logoEmoji; },
  get appSubtitle() { return useStoreSettings.getState().appSubtitle; },
  get footerNote()  { return useStoreSettings.getState().footerNote; },
};
