import { create } from "zustand";
import { persist } from "zustand/middleware";

type UserRole = "Admin" | "Staff";

interface AuthState {
  role: UserRole;
  userId: string;
  setRole: (role: UserRole) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      role: "Admin",
      userId: "user-1",
      setRole: (role) => set({ role }),
    }),
    {
      name: "toy-mall-auth",
    }
  )
);
