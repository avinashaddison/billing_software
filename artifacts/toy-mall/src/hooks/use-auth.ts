import { create } from "zustand";
import { persist } from "zustand/middleware";
import { OWNER_PERMISSIONS, type Permissions } from "@/lib/permissions";

export type StaffRole = "owner" | "staff";

interface AuthState {
  isLoggedIn:  boolean;
  staffId:     string | null;
  staffName:   string;
  role:        StaffRole | null;
  permissions: Permissions;

  login:  (data: { id: string; name: string; role: StaffRole; permissions: Permissions }) => void;
  logout: () => void;

  /* legacy compat */
  userId:  string;
  setRole: (r: "Admin" | "Staff") => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      isLoggedIn:  false,
      staffId:     null,
      staffName:   "",
      role:        null,
      permissions: {},
      userId:      "user-1",
      setRole:     () => {},

      login: ({ id, name, role, permissions }) =>
        set({
          isLoggedIn:  true,
          staffId:     id,
          staffName:   name,
          role,
          userId:      id,
          permissions: role === "owner" ? OWNER_PERMISSIONS : permissions,
        }),

      logout: () =>
        set({
          isLoggedIn:  false,
          staffId:     null,
          staffName:   "",
          role:        null,
          permissions: {},
          userId:      "user-1",
        }),
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
