export const RESOURCES = [
  { key: "dashboard",  label: "Dashboard",        description: "View sales overview & stats" },
  { key: "products",   label: "Products",          description: "Browse & manage inventory" },
  /* Create-only slice of Products: lets a data-entry staff member add new
     items without edit/delete rights. Binary — see BINARY_RESOURCES. */
  { key: "productEntry", label: "Product Entry",   description: "Add new products only — no edit, delete or stock changes" },
  /* The Entry Data page and every stock move on EXISTING products (Scan
     page's Stock IN mode, Quick Adjust). Labelled after the page — owners
     look for the nav item's name, not "stock". Read = open the page, scan,
     see recent entries and batch history (and hand unknown codes to Product
     Entry); Write = add or remove stock. Split from `scan` so a cashier can
     bill without changing stock, and a data-entry staff member can hold
     Product Entry + view without either. Mirrors the server's
     requireWrite("stockEntry") on POST /products/:id/stock. */
  { key: "stockEntry", label: "Entry Data",        description: "Read: view stock entries & batch history · Write: add or remove stock" },
  { key: "scan",       label: "Scan & Billing",    description: "Process sales at the counter" },
  { key: "billing",    label: "Bills History",     description: "View past bills & receipts" },
  { key: "todayBilling", label: "Today's Bills & Totals", description: "Owner approval to view today's bills and live sales totals. Does not change checkout access." },
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
export const BINARY_RESOURCES: ReadonlySet<ResourceKey> = new Set<ResourceKey>(["productEntry", "todayBilling"]);

/** Default permissions for a new staff member */
export const DEFAULT_STAFF_PERMISSIONS: Permissions = {
  dashboard:  "read",
  products:   "read",
  productEntry: "none",
  stockEntry: "write",
  scan:       "write",
  billing:    "read",
  todayBilling: "none",
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

/**
 * Resources whose `read` level opens a product's movement timeline (every
 * stock-in, sale and return with date, time, staff and bill). Mirrors the
 * server's `requireRead("suppliers", "logs")` on GET /api/products/:id/timeline:
 * the Stock Check sheet (Suppliers) and the Stock Logs page both show this
 * history, so either grant is enough. The Product page can be opened with
 * `products: read` alone, which does NOT cover it — gate the tracking card
 * on this list or products-only staff get a card that 403s.
 */
export const TIMELINE_READ_RESOURCES: readonly ResourceKey[] = ["suppliers", "logs"];

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
