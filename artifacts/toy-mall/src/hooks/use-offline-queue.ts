/* ── Offline bill queue ───────────────────────────────────────────
   When the device is offline, bills are saved to localStorage.
   When connectivity returns, they are automatically synced to the API.
──────────────────────────────────────────────────────────────── */
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";

const BASE_URL   = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const STORAGE_KEY = "hira-sons-offline-queue-v1";

export interface QueuedBill {
  localId:      string;
  items:        { productId: string; quantity: number; price: number; mrp?: number }[];
  paymentMode:  string;
  customerName?: string;
  customerPhone?: string;
  discount?:    number;
  discountType?: "percent" | "amount";
  total:        number;
  itemsCount:   number;
  queuedAt:     string;
}

function loadQueue(): QueuedBill[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveQueue(q: QueuedBill[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
}

export function useOfflineQueue() {
  const [queue, setQueue]   = useState<QueuedBill[]>(loadQueue);
  const syncingRef           = useRef(false);

  const refresh = useCallback(() => setQueue(loadQueue()), []);

  /* Add a bill to the offline queue */
  const enqueue = useCallback((bill: Omit<QueuedBill, "localId" | "queuedAt">) => {
    const entry: QueuedBill = {
      ...bill,
      localId:  crypto.randomUUID(),
      queuedAt: new Date().toISOString(),
    };
    const next = [...loadQueue(), entry];
    saveQueue(next);
    setQueue(next);
    toast.warning(
      `📶 Offline — bill saved (₹${bill.total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}) · will sync when connected`,
      { duration: 6000 }
    );
  }, []);

  /* Try to sync all queued bills to the server */
  const syncAll = useCallback(async () => {
    if (syncingRef.current) return;
    const pending = loadQueue();
    if (!pending.length) return;

    syncingRef.current = true;
    let synced = 0;
    let failed = 0;
    const remaining: QueuedBill[] = [];

    for (const bill of pending) {
      try {
        const res = await fetch(`${BASE_URL}/api/bills/checkout`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            items:         bill.items,
            paymentMode:   bill.paymentMode,
            customerName:  bill.customerName,
            customerPhone: bill.customerPhone,
            discount:      bill.discount,
            discountType:  bill.discountType,
          }),
        });
        if (res.ok) { synced++; } else { remaining.push(bill); failed++; }
      } catch {
        remaining.push(bill);
        failed++;
      }
    }

    saveQueue(remaining);
    setQueue(remaining);
    syncingRef.current = false;

    if (synced > 0) {
      toast.success(
        `✅ Synced ${synced} offline bill${synced !== 1 ? "s" : ""} successfully`,
        { duration: 4000 }
      );
    }
    if (failed > 0) {
      toast.error(`${failed} bill${failed !== 1 ? "s" : ""} could not sync — will retry`);
    }
  }, []);

  /* Auto-sync when coming back online */
  useEffect(() => {
    const handle = () => { refresh(); setTimeout(syncAll, 1000); };
    window.addEventListener("online", handle);
    return () => window.removeEventListener("online", handle);
  }, [syncAll, refresh]);

  /* Attempt sync on mount if online and queue has items */
  useEffect(() => {
    if (navigator.onLine && loadQueue().length > 0) {
      setTimeout(syncAll, 2000);
    }
  }, [syncAll]);

  return { queue, pendingCount: queue.length, enqueue, syncAll };
}
