export const RESOURCES = [
  { key: "dashboard",  label: "Dashboard",        description: "View sales overview & stats" },
  { key: "products",   label: "Products",          description: "Browse & manage inventory" },
  /* Create-only slice of Products: lets a data-entry staff member add new
     items without edit/delete rights. Binary — see BINARY_RESOURCES. */
  { key: "productEntry", label: "Product Entry",   description: "Add new products only — no edit, delete or stock changes" },
  /* Moving inventory on EXISTING products (Entry Data page, Scan page's
     Stock IN mode, Quick Adjust). Split from `scan` so a cashier can bill
     without being able to change stock, and a data-entry staff member can
     hold Product Entry without this. Mirrors the server's
     requireWrite("stockEntry") on POST /products/:id/stock. */
  { key: "stockEntry", label: "Stock Entry",       description: "Add or remove stock of existing products" },
  { key: "scan",       label: "Scan & Billing",    description: "Process sales at the counter" },
  { key: "billing",    label: "Bills History",     description: "View past bills & receipts" },
  { key: "logs",       label: "Stock Logs",        description: "View stock movement history" },
  { key: "stockAlert", label: "Stock Alert",       description: "Live stock, low-stock alerts & movement" },
  { key: "productReports", label: "Product Reports", description: "Product sales, ranking & stock performance" },
  { key: "reports",    label: "Reports",           description: "Revenue analytics & EOD report" },
  { key: "analytics",  label: "Analytics",         description: "Sales trends & SKU performance" },
  { key: "customers",  label: "Customers",         description: "Customer purchase history" },
  { key: "categories", label: "Categories",        description: "Manage product categories" },
  { key: "labels",     label: "Labels",            description: "Print QR shelf labels" },
  { key: "suppliers",  label: "Suppliers",         description: "Manage supplier information" },
  { key: "deals",      label: "Today's Deals",     description: "Set up daily offers customers see at checkout" },
  { key: "staff",      label: "Staff Management",  description: "Manage staff & access control" },
  { key: "settings",   label: "Settings",           description: "Configure shop settings" },
] as const;

export type ResourceKey = typeof RESOURCES[number]["key"];
export type AccessLevel  = "none" | "read" | "write";
export type Permissions  = Partial<Record<ResourceKey, AccessLevel>>;

/** Resources that are an on/off ability rather than a page — "read" means
 *  nothing for them, so the permissions dialog offers only None / Write. */
export const BINARY_RESOURCES: ReadonlySet<ResourceKey> = new Set<ResourceKey>(["productEntry"]);

/** Default permissions for a new staff member */
export const DEFAULT_STAFF_PERMISSIONS: Permissions = {
  dashboard:  "read",
  products:   "read",
  productEntry: "none",
  stockEntry: "write",
  scan:       "write",
  billing:    "read",
  logs:       "read",
  stockAlert: "read",
  productReports: "none",
  reports:    "none",
  analytics:  "none",
  customers:  "none",
  categories: "none",
  labels:     "none",
  suppliers:  "none",
  deals:      "read",
  staff:      "none",
};

/** Owner always has full access */
export const OWNER_PERMISSIONS: Permissions = Object.fromEntries(
  RESOURCES.map((r) => [r.key, "write"])
) as Permissions;

export function hasAccess(
  permissions: Permissions,
  resource: ResourceKey,
  level: AccessLevel = "read"
): boolean {
  const perm = permissions[resource] ?? "none";
  if (level === "none")  return true;
  if (level === "read")  return perm === "read" || perm === "write";
  if (level === "write") return perm === "write";
  return false;
}

/**
 * Resources whose `write` level lets a staff member CREATE a product.
 * Mirrors the server's `requireAnyWrite("products", "productEntry")` on
 * POST /api/products: full catalog rights create too, and the narrower
 * "Product Entry" permission lets a data-entry staff member add new items
 * without edit/delete rights (those stay `products: write`).
 * Keep this list identical to the server's or buttons/routes will disagree
 * with the 403 it returns.
 */
export const PRODUCT_CREATE_RESOURCES: readonly ResourceKey[] = ["products", "productEntry"];

/** Map page path → resource key */
export const PATH_RESOURCE: Record<string, ResourceKey> = {
  "/settings":   "settings",
  "/dashboard":  "dashboard",
  "/products":   "products",
  /* Creation is really any-of PRODUCT_CREATE_RESOURCES — the route itself is
     gated by useCanCreateProducts(), not by this single key. */
  "/products/new": "products",
  "/stock-entry": "stockEntry",
  "/product":    "products",
  "/scan":       "scan",
  "/billing":    "billing",
  "/bill":       "billing",
  "/logs":       "logs",
  "/today-out":  "logs",
  "/stock-alert": "stockAlert",
  "/product-report": "productReports",
  "/report":     "reports",
  "/analytics":  "analytics",
  "/customers":  "customers",
  "/categories": "categories",
  "/labels":     "labels",
  "/suppliers":  "suppliers",
  "/suppliers/report": "suppliers",
  "/suppliers/stock-check": "suppliers",
  "/deals":      "deals",
  "/staff":      "staff",
};
