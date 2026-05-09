import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from "react";

export interface CartItem {
  productId: string;
  sku:       string;
  name:      string;
  quantity:  number;
  price:     number;
  mrp?:      number;
  /** Per-line discount percent (0-100). Applied on top of any existing sale price. */
  discountPercent?: number;
}

interface CartContextType {
  items:            CartItem[];
  count:            number;
  total:            number;
  addItem:          (item: Omit<CartItem, "quantity">) => void;
  removeItem:       (productId: string) => void;
  updateQty:        (productId: string, qty: number) => void;
  setLineDiscount:  (productId: string, percent: number) => void;
  clearCart:        () => void;
  syncFromServer:   (items: CartItem[]) => void;
}

/** Effective per-unit price after applying any line discount. */
export function effectivePrice(item: { price: number; discountPercent?: number }): number {
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
  ─────────────────────────────────────────────────────────────────── */
  const syncFromServer = useCallback((serverItems: CartItem[]) => {
    setItems((prev) => {
      const prevCount  = prev.reduce((s, i) => s + i.quantity, 0);
      const srvCount   = serverItems.reduce((s, i) => s + i.quantity, 0);
      const prevTotal  = prev.reduce((s, i) => s + i.price * i.quantity, 0);
      const srvTotal   = serverItems.reduce((s, i) => s + i.price * i.quantity, 0);
      // Skip if state is already identical (avoids echo from own SSE broadcast)
      if (prevCount === srvCount && Math.abs(prevTotal - srvTotal) < 0.01) return prev;
      return serverItems;
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

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
    serverSync("DELETE", `/${encodeURIComponent(productId)}`);
  }, []);

  const updateQty = useCallback((productId: string, qty: number) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.productId !== productId));
      serverSync("DELETE", `/${encodeURIComponent(productId)}`);
    } else {
      setItems((prev) =>
        prev.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i))
      );
      serverSync("PATCH", `/${encodeURIComponent(productId)}`, { quantity: qty });
    }
  }, []);

  const setLineDiscount = useCallback((productId: string, percent: number) => {
    const clamped = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
    setItems((prev) =>
      prev.map((i) =>
        i.productId === productId
          ? { ...i, discountPercent: clamped > 0 ? clamped : undefined }
          : i,
      )
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
    () => ({ items, count, total, addItem, removeItem, updateQty, setLineDiscount, clearCart, syncFromServer }),
    [items, count, total, addItem, removeItem, updateQty, setLineDiscount, clearCart, syncFromServer]
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
