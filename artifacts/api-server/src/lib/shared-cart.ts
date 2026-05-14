/* ── Server-side shared cart (tenant-keyed) ──────────────────────────
   In-memory store. One cart per tenant. NULL tenantId = legacy
   Hira & Sons cart (backward-compat). Cleared on server restart
   (acceptable for intra-day scanning).
──────────────────────────────────────────────────────────────────── */

export interface SharedCartItem {
  productId: string;
  name:      string;
  sku:       string;
  price:     number;
  mrp?:      number;
  quantity:  number;
}

/** Map of tenantId → cart. The string "__legacy_null__" is the NULL-tenant bucket. */
const carts = new Map<string, SharedCartItem[]>();

function keyFor(tenantId: string | null): string {
  return tenantId ?? "__legacy_null__";
}

function get(tenantId: string | null): SharedCartItem[] {
  const k = keyFor(tenantId);
  let cart = carts.get(k);
  if (!cart) { cart = []; carts.set(k, cart); }
  return cart;
}

function set(tenantId: string | null, next: SharedCartItem[]): SharedCartItem[] {
  carts.set(keyFor(tenantId), next);
  return next;
}

export function getCartSummary(tenantId: string | null = null) {
  const cart = get(tenantId);
  const items = [...cart];
  const count = items.reduce((s, i) => s + i.quantity, 0);
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  return { items, count, total };
}

export function addOrIncrement(item: Omit<SharedCartItem, "quantity">, tenantId: string | null = null) {
  const cart = get(tenantId);
  const existing = cart.find((i) => i.productId === item.productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...item, quantity: 1 });
  }
  return getCartSummary(tenantId);
}

export function setQty(productId: string, quantity: number, tenantId: string | null = null) {
  const cart = get(tenantId);
  if (quantity <= 0) {
    set(tenantId, cart.filter((i) => i.productId !== productId));
  } else {
    const item = cart.find((i) => i.productId === productId);
    if (item) item.quantity = quantity;
  }
  return getCartSummary(tenantId);
}

export function removeItem(productId: string, tenantId: string | null = null) {
  const cart = get(tenantId);
  set(tenantId, cart.filter((i) => i.productId !== productId));
  return getCartSummary(tenantId);
}

export function replaceCart(items: SharedCartItem[], tenantId: string | null = null) {
  set(tenantId, items.map((i) => ({ ...i })));
  return getCartSummary(tenantId);
}

export function clearCart(tenantId: string | null = null) {
  set(tenantId, []);
  return getCartSummary(tenantId);
}
