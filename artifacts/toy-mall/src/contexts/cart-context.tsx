import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

export interface CartItem {
  productId: string;
  sku:       string;
  name:      string;
  quantity:  number;
  price:     number;
}

interface CartContextType {
  items:      CartItem[];
  count:      number;
  total:      number;
  addItem:    (item: Omit<CartItem, "quantity">) => void;
  removeItem: (productId: string) => void;
  updateQty:  (productId: string, qty: number) => void;
  clearCart:  () => void;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

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
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const updateQty = useCallback((productId: string, qty: number) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.productId !== productId));
    } else {
      setItems((prev) =>
        prev.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i))
      );
    }
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const count = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const total = useMemo(() => items.reduce((sum, i) => sum + i.price * i.quantity, 0), [items]);

  const value = useMemo(
    () => ({ items, count, total, addItem, removeItem, updateQty, clearCart }),
    [items, count, total, addItem, removeItem, updateQty, clearCart]
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
