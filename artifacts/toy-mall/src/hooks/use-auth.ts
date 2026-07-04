import { create } from "zustand";
import { persist } from "zustand/middleware";
import { OWNER_PERMISSIONS, type Permissions } from "@/lib/permissions";
import { useStoreSettings } from "@/lib/store-info";

export type StaffRole = "owner" | "staff";

interface AuthState {
  isLoggedIn:  boolean;
  staffId:     string | null;
  staffName:   string;
  role:        StaffRole | null;
  permissions: Permissions;
  priorScannerThresholdMs: number | null;

  login:  (data: { id: string; name: string; role: StaffRole; permissions: Permissions }) => void;
  logout: () => void;

  /* legacy compat */
  userId:  string;
  setRole: (r: "Admin" | "Staff") => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      isLoggedIn:  false,
      staffId:     null,
      staffName:   "",
      role:        null,
      permissions: {},
      priorScannerThresholdMs: null,
      userId:      "user-1",
      setRole:     () => {},

      login: ({ id, name, role, permissions }) => {
        const currentThreshold = useStoreSettings.getState().scannerThresholdMs;
        set({
          isLoggedIn:  true,
          staffId:     id,
          staffName:   name,
          role,
          userId:      id,
          permissions: role === "owner" ? OWNER_PERMISSIONS : permissions,
          priorScannerThresholdMs: currentThreshold,
        });
        /* Cookie scope just changed — re-fetch the tenant's store settings
           so the Dashboard header doesn't flash "Your Shop Name" before
           the user manually refreshes. Fire-and-forget; if it fails the
           persisted defaults stay visible. */
        void useStoreSettings.getState().hydrateFromServer();
      },

      logout: () => {
        const { priorScannerThresholdMs } = get();
        if (priorScannerThresholdMs !== null) {
          useStoreSettings.getState().update({ scannerThresholdMs: priorScannerThresholdMs });
        }
        set({
          isLoggedIn:  false,
          staffId:     null,
          staffName:   "",
          role:        null,
          permissions: {},
          priorScannerThresholdMs: null,
          userId:      "user-1",
        });
        /* Drop the persisted store-settings cache so the next sign-in (possibly
           a different tenant on the same browser) hydrates from scratch
           instead of flashing the previous tenant's name/logo/etc.
           Also drop the cart and the offline-bill queue: these are NOT
           tenant-scoped keys, so on a shared device they would otherwise leak
           one shop's cart into the next shop's session (and the offline queue
           could sync bills under the wrong account). */
        try {
          localStorage.removeItem("toy-mall-store-settings-v1");
          localStorage.removeItem("toy-mall-cart");
          localStorage.removeItem("hira-sons-offline-queue-v1");
        } catch { /* ignore */ }
      },
    }),
    { name: "toy-mall-auth-v2" }
  )
);

/** Returns effective access level for a resource */
export function usePermission(resource: string): "none" | "read" | "write" {
  const { role, permissions } = useAuth();
  if (role === "owner") return "write";
  return (permissions as Record<string, "none" | "read" | "write">)[resource] ?? "none";
}
