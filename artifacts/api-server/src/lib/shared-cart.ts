/* ── Server-side shared cart ─────────────────────────────────────────
   In-memory store. Single shared cart for the store session.
   Cleared on server restart (acceptable for intra-day scanning).
──────────────────────────────────────────────────────────────────── */

export interface SharedCartItem {
  productId: string;
  name:      string;
  sku:       string;
  price:     number;
  quantity:  number;
}

let cart: SharedCartItem[] = [];

export function getCartSummary() {
  const items = [...cart];
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  return { items, count, total };
}

export function addOrIncrement(item: Omit<SharedCartItem, "quantity">) {
  const existing = cart.find((i) => i.productId === item.productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...item, quantity: 1 });
  }
  return getCartSummary();
}

export function setQty(productId: string, quantity: number) {
  if (quantity <= 0) {
    cart = cart.filter((i) => i.productId !== productId);
  } else {
    const item = cart.find((i) => i.productId === productId);
    if (item) item.quantity = quantity;
  }
  return getCartSummary();
}

export function removeItem(productId: string) {
  cart = cart.filter((i) => i.productId !== productId);
  return getCartSummary();
}

export function replaceCart(items: SharedCartItem[]) {
  cart = items.map((i) => ({ ...i }));
  return getCartSummary();
}

export function clearCart() {
  cart = [];
  return getCartSummary();
}
