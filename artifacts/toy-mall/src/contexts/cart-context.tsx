import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from "react";

export interface CartItem {
  productId: string;
  sku:       string;
  name:      string;
  quantity:  number;
  price:     number;
}

interface CartContextType {
  items:          CartItem[];
  count:          number;
  total:          number;
  addItem:        (item: Omit<CartItem, "quantity">) => void;
  removeItem:     (productId: string) => void;
  updateQty:      (productId: string, qty: number) => void;
  clearCart:      () => void;
  syncFromServer: (items: CartItem[]) => void;
}

const CartContext = createContext<CartContextType | null>(null);

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/** Fire-and-forget server sync — never blocks the UI */
function serverSync(method: string, path: string, body?: unknown) {
  fetch(`${BASE_URL}/api/shared-cart${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => { /* server sync is best-effort */ });
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  /* ── On mount: load any in-progress cart from the server ───────────
     This lets a PC open the Ongoing Checkout page and see what mobile
     has already scanned, even before any SSE event fires.
  ─────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    fetch(`${BASE_URL}/api/shared-cart`)
      .then((r) => r.json())
      .then((data: { items: CartItem[] }) => {
        if (Array.isArray(data.items) && data.items.length > 0) {
          setItems((prev) => {
            // If we already have local items (e.g., user started scanning before
            // the fetch returned), keep local state and push it to the server.
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

  const clearCart = useCallback(() => {
    setItems([]);
    serverSync("DELETE", "");
  }, []);

  const count = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const total = useMemo(() => items.reduce((sum, i) => sum + i.price * i.quantity, 0), [items]);

  const value = useMemo(
    () => ({ items, count, total, addItem, removeItem, updateQty, clearCart, syncFromServer }),
    [items, count, total, addItem, removeItem, updateQty, clearCart, syncFromServer]
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
