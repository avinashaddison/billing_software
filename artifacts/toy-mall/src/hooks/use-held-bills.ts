import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type CartItem } from "@/contexts/cart-context";
import { useAuth } from "@/hooks/use-auth";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export interface HeldBill {
  id: string;
  customerName: string | null;
  note: string | null;
  items: CartItem[];
  itemCount: number;
  total: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveCartSnapshot {
  items: CartItem[];
  revision: number;
  count: number;
  total: number;
}

export class HeldBillRequestError extends Error {
  cart?: ActiveCartSnapshot;
}

async function handleResponse(res: Response) {
  const raw = res.status === 204 ? "" : await res.text();
  if (!res.ok) {
    let msg = raw || res.statusText || "Request failed";
    let cart: ActiveCartSnapshot | undefined;
    try {
      const data = JSON.parse(raw) as { error?: unknown; cart?: ActiveCartSnapshot };
      if (typeof data.error === "string" && data.error) msg = data.error;
      if (data.cart) cart = data.cart;
    } catch { /* non-JSON error body — use the text above */ }
    const error = new HeldBillRequestError(msg);
    error.cart = cart;
    throw error;
  }
  if (res.status === 204) return;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Server returned an invalid response");
  }
}

export function useHeldBills() {
  const isLoggedIn = useAuth((state) => state.isLoggedIn);
  const staffId = useAuth((state) => state.staffId);
  return useQuery({
    queryKey: ["held-bills", staffId],
    enabled: isLoggedIn,
    queryFn: async (): Promise<HeldBill[]> => {
      const res = await fetch(`${BASE_URL}/api/held-bills`);
      const data = await handleResponse(res);
      return data.heldBills || [];
    },
  });
}

export function useHoldBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { customerName?: string; note?: string; expectedRevision: number }) => {
      const res = await fetch(`${BASE_URL}/api/held-bills`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await handleResponse(res);
      return data as { heldBill: HeldBill; revision: number };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["held-bills"] });
    },
  });
}

export function useResumeHeldBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, expectedRevision }: { id: string; expectedRevision: number }) => {
      const res = await fetch(`${BASE_URL}/api/held-bills/${id}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRevision }),
      });
      const data = await handleResponse(res);
      return data as { heldBill: HeldBill; items: CartItem[]; revision: number };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["held-bills"] });
    },
  });
}

export function useDiscardHeldBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${BASE_URL}/api/held-bills/${id}`, {
        method: "DELETE",
      });
      await handleResponse(res);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["held-bills"] });
    },
  });
}