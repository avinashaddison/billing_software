import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  OWNER_PERMISSIONS, PRODUCT_CREATE_RESOURCES, TIMELINE_READ_RESOURCES, type Permissions,
} from "@/lib/permissions";
import { useStoreSettings } from "@/lib/store-info";
import { queryClient } from "@/lib/query-client";

export type StaffRole = "owner" | "staff";

interface AuthState {
  isLoggedIn:  boolean;
  staffId:     string | null;
  staffName:   string;
  role:        StaffRole | null;
  permissions: Permissions;
  priorScannerThresholdMs: number | null;

  login:  (data: { id: string; name: string; role: StaffRole; permissions: Permissions }) => void;
  /* Replace the persisted permission map with the server's current one
     (same staff, same role). Used by the boot-time session probe so a grant
     changed — or a permission key added by a release — reaches devices that
     stay signed in for weeks without a fresh PIN login. */
  syncPermissions: (permissions: Permissions) => void;
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
        /* Every cached API response is shaped for the account that fetched
           it (owner views carry cost prices and customer phones that staff
           views omit). Drop the previous sign-in's copies before this
           account's pages mount, so a staff member signing in after the
           owner on a shared tablet is never served the owner's cache while
           the background refetch is still in flight. */
        queryClient.clear();
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

      syncPermissions: (permissions) => {
        const { isLoggedIn, role } = get();
        if (!isLoggedIn || role === "owner") return;   // owners are all-write by role
        set({ permissions });
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
        /* Same reasoning as in login(): nothing fetched under the old
           session may survive into the next one. */
        queryClient.clear();
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

/**
 * Can this user create a product? Mirrors the server gate on
 * POST /api/products (`requireAnyWrite("products", "productEntry")`): full
 * catalog rights OR the "Product Entry" permission. Use this — not
 * `usePermission("products")` — for the New Product route/buttons, otherwise
 * entry-only staff either lose the button or get a form that 403s on save.
 */
export function useCanCreateProducts(): boolean {
  const { role, permissions } = useAuth();
  if (role === "owner") return true;
  const map = permissions as Record<string, "none" | "read" | "write">;
  return PRODUCT_CREATE_RESOURCES.some((r) => map[r] === "write");
}

/**
 * Can this user open a product's movement timeline? Mirrors the server gate
 * on GET /api/products/:id/timeline (`requireRead("suppliers", "logs")`).
 * The Product page is reachable with `products: read` alone, so its tracking
 * card must check this, not the page's own permission.
 */
export function useCanViewTimeline(): boolean {
  const { role, permissions } = useAuth();
  if (role === "owner") return true;
  const map = permissions as Record<string, "none" | "read" | "write">;
  return TIMELINE_READ_RESOURCES.some((r) => map[r] === "read" || map[r] === "write");
}
