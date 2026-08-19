import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export type LineDiscountType = "percent" | "amount";

export interface CartItem {
  productId: string;
  sku:       string;
  name:      string;
  quantity:  number;
  price:     number;
  mrp?:      number;
  /** Per-line discount percent (0-100). Used when discountType is undefined or "percent". */
  discountPercent?: number;
  /** Per-line FLAT discount in rupees, applied per unit. Used when discountType is "amount". */
  discountAmount?: number;
  /** Which discount mode is active for this line. Default: "percent". */
  discountType?: LineDiscountType;
  /** True when this is a MANUAL / non-inventory line (e.g. customer's own
   *  gift, ad-hoc service charge). Manual lines have no SKU, no stock, no
   *  MRP, and don't sync to the shared cart. The `productId` for manual
   *  items is a client-generated string prefixed with "manual-" so it
   *  remains a stable React key without colliding with real product UUIDs. */
  isManual?: boolean;
}

interface CartContextType {
  items:            CartItem[];
  count:            number;
  total:            number;
  addItem:          (item: Omit<CartItem, "quantity">) => void;
  /** Add a manual / non-inventory line (gift wrap, customer's own item,
   *  ad-hoc service). Each call creates a NEW line — manual items are
   *  never deduplicated, since two "Custom" entries with the same name
   *  may legitimately represent two different things at the same price. */
  addCustomItem:    (input: { name: string; price: number; quantity?: number }) => void;
  removeItem:       (productId: string) => void;
  updateQty:        (productId: string, qty: number) => void;
  setLineDiscount:  (productId: string, type: LineDiscountType, value: number) => void;
  clearCart:        () => void;
  prepareCart:      () => Promise<number>;
  replaceCart:      (items: CartItem[], revision: number) => void;
  syncFromServer:   (items: CartItem[], revision: number) => void;
}

/** Effective per-unit price after applying any line discount (% or flat ₹). */
export function effectivePrice(item: {
  price: number;
  discountPercent?: number;
  discountAmount?: number;
  discountType?: LineDiscountType;
}): number {
  const type = item.discountType ?? "percent";
  if (type === "amount") {
    const amt = item.discountAmount ?? 0;
    if (amt <= 0) return item.price;
    return Math.max(0, item.price - amt);
  }
  const pct = item.discountPercent ?? 0;
  if (pct <= 0) return item.price;
  if (pct >= 100) return 0;
  return Math.max(0, item.price * (1 - pct / 100));
}

const CartContext = createContext<CartContextType | null>(null);

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const LS_KEY     = "toy-mall-cart";
const SESSION_MS = 8 * 60 * 60 * 1000; // 8 hours

interface PersistedCart {
  items:     CartItem[];
  savedAt:   number;
}

function loadFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed: PersistedCart = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > SESSION_MS) {
      localStorage.removeItem(LS_KEY);
      return [];
    }
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

function saveToStorage(items: CartItem[]) {
  try {
    if (items.length === 0) {
      localStorage.removeItem(LS_KEY);
    } else {
      const payload: PersistedCart = { items, savedAt: Date.now() };
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
    }
  } catch {
    /* storage quota exceeded or private browsing — ignore */
  }
}

interface CartSummary {
  items: CartItem[];
  revision: number;
  count: number;
  total: number;
}

async function readCartResponse(response: Response): Promise<CartSummary> {
  const raw = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(response.ok ? "Server returned an invalid cart response" : (raw || response.statusText));
  }
  if (!response.ok) {
    const errorData = data as { error?: unknown; cart?: CartSummary };
    const error = new Error(
      typeof errorData.error === "string" ? errorData.error : "Cart sync failed",
    ) as Error & { cart?: CartSummary };
    if (errorData.cart) error.cart = errorData.cart;
    throw error;
  }
  return data as CartSummary;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const initialItemsRef = useRef<CartItem[] | null>(null);
  if (initialItemsRef.current === null) initialItemsRef.current = loadFromStorage();
  const [items, setItems] = useState<CartItem[]>(initialItemsRef.current);
  const itemsRef = useRef(items);
  const revisionRef = useRef(0);
  const serverItemsRef = useRef<CartItem[]>([]);
  const syncTailRef = useRef<Promise<void>>(Promise.resolve());
  const pendingSyncsRef = useRef(0);
  const syncFailureRef = useRef(false);
  const serverChangedWhileSyncingRef = useRef(false);

  const setLocalItems = useCallback((next: CartItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const acceptServerCart = useCallback((summary: CartSummary, updateVisible: boolean) => {
    revisionRef.current = summary.revision;
    serverItemsRef.current = summary.items;
    if (updateVisible) setLocalItems(summary.items);
  }, [setLocalItems]);

  const queueServerMutation = useCallback((
    method: string,
    path: string,
    body: object = {},
  ) => {
    pendingSyncsRef.current += 1;
    const run = async () => {
      let shouldReconcile = false;
      try {
        const response = await fetch(`${BASE_URL}/api/shared-cart${path}`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, expectedRevision: revisionRef.current }),
        });
        const summary = await readCartResponse(response);
        acceptServerCart(summary, false);
        serverChangedWhileSyncingRef.current = false;
        shouldReconcile = true;
      } catch (error) {
        const conflict = (error as Error & { cart?: CartSummary }).cart;
        if (conflict) {
          acceptServerCart(conflict, true);
          serverChangedWhileSyncingRef.current = false;
          toast.warning("Cart changed on another device. Latest cart loaded; repeat your action.");
          shouldReconcile = true;
        } else {
          syncFailureRef.current = true;
        }
      } finally {
        pendingSyncsRef.current -= 1;
        if (pendingSyncsRef.current === 0) {
          if (syncFailureRef.current) {
            if (serverChangedWhileSyncingRef.current) {
              setLocalItems(serverItemsRef.current);
              toast.warning("Some cart changes could not sync. Latest shared cart loaded.");
            }
          } else if (shouldReconcile) {
            setLocalItems(serverItemsRef.current);
          }
          serverChangedWhileSyncingRef.current = false;
        }
      }
    };
    const queued = syncTailRef.current.then(run);
    syncTailRef.current = queued.catch(() => {});
    return queued;
  }, [acceptServerCart, setLocalItems]);

  /* ── Persist to localStorage whenever items change ─────────────── */
  useEffect(() => {
    saveToStorage(items);
  }, [items]);

  /* ── Clear the in-memory cart on logout ────────────────────────────
     CartProvider wraps the whole app (it doesn't unmount on logout), so
     without this the previous user's cart would still be in memory when a
     different shop signs in on the same device. logout() also clears the
     localStorage copy; this covers the live state. */
  const isLoggedIn = useAuth((s) => s.isLoggedIn);
  const prevLoggedIn = useRef(isLoggedIn);
  useEffect(() => {
    if (prevLoggedIn.current && !isLoggedIn) {
      setLocalItems([]);
      revisionRef.current = 0;
      serverItemsRef.current = [];
      syncFailureRef.current = false;
      serverChangedWhileSyncingRef.current = false;
    }
    prevLoggedIn.current = isLoggedIn;
  }, [isLoggedIn, setLocalItems]);

  /* ── On sign-in: load any in-progress cart from the server ─────────
     This lets a PC open the Ongoing Checkout page and see what mobile
     has already scanned. The server wins when it has items; a local
     persisted cart only repopulates a freshly restarted empty server.
  ─────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!isLoggedIn) return;
    fetch(`${BASE_URL}/api/shared-cart`)
      .then(readCartResponse)
      .then((summary) => {
        if (summary.items.length > 0 || itemsRef.current.length === 0) {
          acceptServerCart(summary, true);
        } else {
          // The in-memory server cart was likely reset. Restore this device's
          // persisted cart only if the revision still matches.
          acceptServerCart(summary, false);
          void queueServerMutation("PUT", "", { items: itemsRef.current });
        }
      })
      .catch(() => { /* server may not be ready yet — ignore */ });
  }, [isLoggedIn, acceptServerCart, queueServerMutation]);

  /* SSE carries the complete cart, including manual lines and discounts.
     While local mutations are queued, remember the newest server snapshot
     without overwriting optimistic UI; the queue response reconciles it. */
  const syncFromServer = useCallback((serverItems: CartItem[], revision: number) => {
    if (!Number.isInteger(revision) || revision < revisionRef.current) return;
    if (pendingSyncsRef.current > 0) serverChangedWhileSyncingRef.current = true;
    acceptServerCart(
      { items: serverItems, revision, count: 0, total: 0 },
      pendingSyncsRef.current === 0,
    );
  }, [acceptServerCart]);


  /* ── Cart mutations — optimistic local update + server sync ─────── */

  const addItem = useCallback((incoming: Omit<CartItem, "quantity">) => {
    const existing = itemsRef.current.find((item) => item.productId === incoming.productId);
    const next = existing
      ? itemsRef.current.map((item) =>
          item.productId === incoming.productId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      : [...itemsRef.current, { ...incoming, quantity: 1 }];
    setLocalItems(next);
    void queueServerMutation("POST", "/add", incoming);
  }, [queueServerMutation, setLocalItems]);

  const addCustomItem = useCallback(
    ({ name, price, quantity = 1 }: { name: string; price: number; quantity?: number }) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const safePrice = Math.max(0, Number.isFinite(price) ? price : 0);
      const safeQty   = Math.max(1, Math.floor(Number.isFinite(quantity) ? quantity : 1));
      // Stable client-side ID — prefixed with "manual-" so we can detect it
      // anywhere in the cart pipeline. crypto.randomUUID is available in
      // every supported browser (and Node 19+, for the rare SSR case).
      const id = `manual-${
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      }`;
      const item: CartItem = {
        productId: id,
        sku: "—",
        name: trimmed,
        quantity: safeQty,
        price: safePrice,
        isManual: true,
      };
      setLocalItems([...itemsRef.current, item]);
      void queueServerMutation("POST", "/add", item);
    },
    [queueServerMutation, setLocalItems],
  );

  const removeItem = useCallback((productId: string) => {
    setLocalItems(itemsRef.current.filter((item) => item.productId !== productId));
    void queueServerMutation("DELETE", `/${encodeURIComponent(productId)}`);
  }, [queueServerMutation, setLocalItems]);

  const updateQty = useCallback((productId: string, qty: number) => {
    if (qty <= 0) {
      setLocalItems(itemsRef.current.filter((item) => item.productId !== productId));
      void queueServerMutation("DELETE", `/${encodeURIComponent(productId)}`);
    } else {
      setLocalItems(itemsRef.current.map((item) =>
        item.productId === productId ? { ...item, quantity: qty } : item
      ));
      void queueServerMutation("PATCH", `/${encodeURIComponent(productId)}`, { quantity: qty });
    }
  }, [queueServerMutation, setLocalItems]);

  const setLineDiscount = useCallback((productId: string, type: LineDiscountType, value: number) => {
    const v = Number.isFinite(value) ? value : 0;
    const current = itemsRef.current.find((item) => item.productId === productId);
    if (!current) return;
    const patch = type === "amount"
      ? {
          discountType: "amount" as const,
          discountAmount: Math.max(0, Math.min(current.price, v)),
          discountPercent: 0,
        }
      : {
          discountType: "percent" as const,
          discountPercent: Math.max(0, Math.min(100, v)),
          discountAmount: 0,
        };
    setLocalItems(itemsRef.current.map((item) =>
      item.productId === productId
        ? {
            ...item,
            ...patch,
            discountAmount: patch.discountAmount || undefined,
            discountPercent: patch.discountPercent || undefined,
          }
        : item
    ));
    void queueServerMutation("PATCH", `/${encodeURIComponent(productId)}`, patch);
  }, [queueServerMutation, setLocalItems]);

  const clearCart = useCallback(() => {
    setLocalItems([]);
    void queueServerMutation("DELETE", "");
  }, [queueServerMutation, setLocalItems]);

  const prepareCart = useCallback(async () => {
    await syncTailRef.current;
    const response = await fetch(`${BASE_URL}/api/shared-cart`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: itemsRef.current,
        expectedRevision: revisionRef.current,
      }),
    });
    try {
      const summary = await readCartResponse(response);
      acceptServerCart(summary, true);
      syncFailureRef.current = false;
      serverChangedWhileSyncingRef.current = false;
      return summary.revision;
    } catch (error) {
      const conflict = (error as Error & { cart?: CartSummary }).cart;
      if (conflict) {
        acceptServerCart(conflict, true);
        syncFailureRef.current = false;
        serverChangedWhileSyncingRef.current = false;
      }
      throw error;
    }
  }, [acceptServerCart]);

  const replaceCart = useCallback((newItems: CartItem[], revision: number) => {
    acceptServerCart(
      {
        items: newItems,
        revision,
        count: newItems.reduce((sum, item) => sum + item.quantity, 0),
        total: newItems.reduce(
          (sum, item) => sum + effectivePrice(item) * item.quantity,
          0,
        ),
      },
      true,
    );
  }, [acceptServerCart]);

  const count = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const total = useMemo(
    () => items.reduce((sum, i) => sum + effectivePrice(i) * i.quantity, 0),
    [items]
  );

  const value = useMemo(
    () => ({ items, count, total, addItem, addCustomItem, removeItem, updateQty, setLineDiscount, clearCart, prepareCart, replaceCart, syncFromServer }),
    [items, count, total, addItem, addCustomItem, removeItem, updateQty, setLineDiscount, clearCart, prepareCart, replaceCart, syncFromServer]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
