export const RESOURCES = [
  { key: "dashboard",  label: "Dashboard",        description: "View sales overview & stats" },
  { key: "products",   label: "Products",          description: "Browse & manage inventory" },
  { key: "scan",       label: "Scan & Billing",    description: "Process sales & stock-in" },
  { key: "billing",    label: "Bills History",     description: "View past bills & receipts" },
  { key: "logs",       label: "Stock Logs",        description: "View stock movement history" },
  { key: "stockAlert", label: "Stock Alert",       description: "Live stock, low-stock alerts & movement" },
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

/** Default permissions for a new staff member */
export const DEFAULT_STAFF_PERMISSIONS: Permissions = {
  dashboard:  "read",
  products:   "read",
  scan:       "write",
  billing:    "read",
  logs:       "read",
  stockAlert: "read",
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

/** Map page path → resource key */
export const PATH_RESOURCE: Record<string, ResourceKey> = {
  "/settings":   "settings",
  "/dashboard":  "dashboard",
  "/products":   "products",
  "/products/new": "products",
  "/stock-entry": "scan",
  "/product":    "products",
  "/scan":       "scan",
  "/billing":    "billing",
  "/bill":       "billing",
  "/logs":       "logs",
  "/today-out":  "logs",
  "/stock-alert": "stockAlert",
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
