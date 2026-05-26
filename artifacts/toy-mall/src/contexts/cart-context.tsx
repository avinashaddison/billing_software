import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from "react";

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
  syncFromServer:   (items: CartItem[]) => void;
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

/** Fire-and-forget server sync — never blocks the UI */
function serverSync(method: string, path: string, body?: unknown) {
  fetch(`${BASE_URL}/api/shared-cart${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => { /* server sync is best-effort */ });
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => loadFromStorage());

  /* ── Persist to localStorage whenever items change ─────────────── */
  useEffect(() => {
    saveToStorage(items);
  }, [items]);

  /* ── On mount: load any in-progress cart from the server ───────────
     This lets a PC open the Ongoing Checkout page and see what mobile
     has already scanned, even before any SSE event fires.
     localStorage is the primary source; server fills in if empty.
  ─────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    fetch(`${BASE_URL}/api/shared-cart`)
      .then((r) => r.json())
      .then((data: { items: CartItem[] }) => {
        if (Array.isArray(data.items) && data.items.length > 0) {
          setItems((prev) => {
            // If we already have local items (localStorage or already scanned),
            // keep local state and let it remain authoritative.
            if (prev.length > 0) return prev;
            return data.items;
          });
        }
      })
      .catch(() => { /* server may not be ready yet — ignore */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── syncFromServer ────────────────────────────────────────────────
     Called by use-realtime.ts when a cart_updated SSE event arrives.
     Compares count + total to avoid re-renders when we're the source
     of the event (echo-loop prevention).

     Manual / non-inventory lines (productId starts with "manual-") are
     preserved across server syncs — they're device-local by design and
     wouldn't be present in the shared cart payload, so we re-attach
     them on top of whatever the server sent.

     Important: we treat local state as authoritative when the server
     has FEWER (but non-zero) items than us.  This avoids two problems:

     1. Fast-scanning race: items A and B are scanned in quick succession.
        The SSE echo for item A arrives before item B's serverSync request
        reaches the server.  Server broadcasts [A], but local already has
        [A, B].  Without this guard, B would be silently dropped.

     2. Server-restart data loss (common on Render free tier): the server's
        in-memory shared-cart is wiped on restart.  The next scan only
        puts that ONE item in the server, which would otherwise overwrite
        the full local cart that localStorage preserved.

     srvCount === 0 still clears local (someone else completed checkout).
  ─────────────────────────────────────────────────────────────────── */
  const syncFromServer = useCallback((serverItems: CartItem[]) => {
    setItems((prev) => {
      const localManual = prev.filter((i) => i.productId.startsWith("manual-"));
      // Compare ONLY the catalogue portion against the server payload.
      const prevCatalogue  = prev.filter((i) => !i.productId.startsWith("manual-"));
      const prevCount  = prevCatalogue.reduce((s, i) => s + i.quantity, 0);
      const srvCount   = serverItems.reduce((s, i) => s + i.quantity, 0);
      const prevTotal  = prevCatalogue.reduce((s, i) => s + i.price * i.quantity, 0);
      const srvTotal   = serverItems.reduce((s, i) => s + i.price * i.quantity, 0);
      // Skip if state is already identical (avoids echo from own SSE broadcast)
      if (prevCount === srvCount && Math.abs(prevTotal - srvTotal) < 0.01) return prev;
      // Server is non-empty but behind local → server hasn't caught up yet
      // (fast-scan race or post-restart stale state).  Keep local so we don't
      // lose items that were already committed to localStorage.
      if (srvCount > 0 && srvCount < prevCount) return prev;
      // srvCount === 0 → explicit checkout/clear on another tab or device.
      // srvCount > prevCount → another device added items (cross-device add).
      // In both cases, server is authoritative; catalogue lines are replaced.
      return [...serverItems, ...localManual];
    });
  }, []);


  /* ── Cart mutations — optimistic local update + server sync ─────── */

  const addItem = useCallback((incoming: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === incoming.productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === incoming.productId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...incoming, quantity: 1 }];
    });
    serverSync("POST", "/add", {
      productId: incoming.productId,
      name:      incoming.name,
      sku:       incoming.sku,
      price:     incoming.price,
      mrp:       incoming.mrp,
    });
  }, []);

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
      setItems((prev) => [
        ...prev,
        {
          productId: id,
          sku:       "—",
          name:      trimmed,
          quantity:  safeQty,
          price:     safePrice,
          isManual:  true,
        },
      ]);
      // Manual lines stay LOCAL to this device. The shared-cart endpoint
      // is keyed by productId and assumes a real catalogue row; pushing
      // a "manual-…" id there would either be rejected or echo back to
      // other devices that can't render it. Keep it on-device.
    },
    [],
  );

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
    // Manual lines are device-local — no shared-cart row to delete.
    if (!productId.startsWith("manual-")) {
      serverSync("DELETE", `/${encodeURIComponent(productId)}`);
    }
  }, []);

  const updateQty = useCallback((productId: string, qty: number) => {
    const isManual = productId.startsWith("manual-");
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.productId !== productId));
      if (!isManual) serverSync("DELETE", `/${encodeURIComponent(productId)}`);
    } else {
      setItems((prev) =>
        prev.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i))
      );
      if (!isManual) serverSync("PATCH", `/${encodeURIComponent(productId)}`, { quantity: qty });
    }
  }, []);

  const setLineDiscount = useCallback((productId: string, type: LineDiscountType, value: number) => {
    const v = Number.isFinite(value) ? value : 0;
    setItems((prev) =>
      prev.map((i) => {
        if (i.productId !== productId) return i;
        if (type === "amount") {
          const amt = Math.max(0, Math.min(i.price, v));
          return {
            ...i,
            discountType:    "amount",
            discountAmount:  amt > 0 ? amt : undefined,
            discountPercent: undefined,
          };
        }
        const pct = Math.max(0, Math.min(100, v));
        return {
          ...i,
          discountType:    "percent",
          discountPercent: pct > 0 ? pct : undefined,
          discountAmount:  undefined,
        };
      })
    );
    /* Line discount is local-only for now; not synced to shared cart since other
       devices wouldn't know to render it consistently. Bills capture it on checkout. */
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    serverSync("DELETE", "");
  }, []);

  const count = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const total = useMemo(
    () => items.reduce((sum, i) => sum + effectivePrice(i) * i.quantity, 0),
    [items]
  );

  const value = useMemo(
    () => ({ items, count, total, addItem, addCustomItem, removeItem, updateQty, setLineDiscount, clearCart, syncFromServer }),
    [items, count, total, addItem, addCustomItem, removeItem, updateQty, setLineDiscount, clearCart, syncFromServer]
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
