import { Fragment } from "react";
import { Link, useLocation } from "wouter";
import { Home, Package, ScanLine, Clock, User, Plus, Sun, Moon, IndianRupee, FileText, Users, Tag, Truck, Layers, Users2, ShoppingCart, LogOut, Settings2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { useCart } from "@/contexts/cart-context";
import { useAuth } from "@/hooks/use-auth";
import { type Permissions } from "@/lib/permissions";
import { useStoreSettings } from "@/lib/store-info";

function getLevel(role: string | null, permissions: Permissions, resource: string): "none" | "read" | "write" {
  if (role === "owner") return "write";
  return (permissions as Record<string, "none" | "read" | "write">)[resource] ?? "none";
}

export function SideNav() {
  const [location, setLocation] = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const { count } = useCart();
  const { role, permissions, staffName, logout } = useAuth();

  const handleLogout = () => { logout(); setLocation("/login"); };
  const store = useStoreSettings();

  const perm    = (resource: string) => getLevel(role, permissions, resource);
  const visible = (resource: string) => perm(resource) !== "none";

  const navItems = [
    { name: "Dashboard", href: "/",          icon: Home,     highlight: false, resource: "dashboard" },
    { name: "Products",  href: "/products",  icon: Package,  highlight: false, resource: "products"  },
    { name: "Scan",      href: "/scan",      icon: ScanLine, highlight: true,  resource: "scan"      },
    { name: "Billing",   href: "/billing",   icon: IndianRupee,  highlight: false, resource: "billing"   },
    { name: "Logs",      href: "/logs",      icon: Clock,    highlight: false, resource: "logs"      },
    { name: "Profile",   href: "/profile",   icon: User,     highlight: false, resource: null        },
  ].filter((item) => !item.resource || visible(item.resource));

  const extraItems = [
    { name: "Today's Deals", href: "/deals",      icon: Sparkles,  resource: "deals"     },
    { name: "Reports",       href: "/report",     icon: FileText,  resource: "reports"   },
    { name: "Customers",     href: "/customers",  icon: Users,     resource: "customers" },
    { name: "Categories",    href: "/categories", icon: Layers,    resource: "categories"},
    { name: "Labels",        href: "/labels",     icon: Tag,       resource: "labels"    },
    { name: "Suppliers",     href: "/suppliers",  icon: Truck,     resource: "suppliers" },
    { name: "Staff",         href: "/staff",      icon: Users2,    resource: "staff"     },
    ...(role === "owner" ? [{ name: "Settings", href: "/settings", icon: Settings2, resource: "staff" as const }] : []),
  ].filter((item) => visible(item.resource));

  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-background border-r border-border shrink-0 sticky top-0 h-screen">
      <div className="relative px-4 py-3.5 border-b border-border overflow-hidden">
        {/* Soft accent line at top */}
        <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />

        <div className="relative flex items-center gap-3 group">
          {/* Logo */}
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-400 opacity-30 blur-lg transition-opacity duration-500 group-hover:opacity-50" />
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-400 flex items-center justify-center shadow-md shadow-blue-500/25 ring-1 ring-white/25">
              <span className="text-lg leading-none transition-transform duration-300 group-hover:scale-110">
                {store.logoEmoji}
              </span>
              <span className="pointer-events-none absolute inset-x-1 top-0.5 h-1/3 rounded-t-lg bg-gradient-to-b from-white/30 to-transparent" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-[12.5px] font-black tracking-tight leading-[1.15] text-foreground">
              {store.name}
            </h1>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              <p className="text-[9px] text-muted-foreground font-bold tracking-[0.1em] uppercase truncate">
                {store.appSubtitle}
              </p>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            location === item.href ||
            (item.href !== "/" && location.startsWith(item.href) && !item.highlight);
          const Icon = item.icon;

          if (item.highlight) {
            return (
              <Link key={item.name} href={item.href}
                className="flex items-center gap-3 px-3 py-3 rounded-xl bg-primary text-primary-foreground font-bold shadow-md hover:opacity-90 active:scale-[0.98] transition-all my-2 relative"
                data-testid={`nav-${item.name.toLowerCase()}`}>
                <Icon size={20} />
                <span className="flex-1">{item.name}</span>
                {count > 0 && (
                  <span className="min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </Link>
            );
          }

          /* Billing item — append Ongoing Checkout sub-link when cart has items */
          if (item.href === "/billing" && count > 0) {
            const isCheckoutActive = location === "/checkout";
            return (
              <Fragment key={item.name}>
                <Link href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-xl font-semibold transition-all",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  data-testid="nav-billing">
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  <span>{item.name}</span>
                </Link>
                <Link href="/checkout"
                  className={cn(
                    "flex items-center gap-2 pl-8 pr-3 py-2 rounded-xl font-semibold text-sm transition-all",
                    isCheckoutActive
                      ? "bg-green-500/10 text-green-600 dark:text-green-400"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  data-testid="nav-ongoing-checkout">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                  <ShoppingCart size={15} strokeWidth={isCheckoutActive ? 2.5 : 2} />
                  <span className="flex-1">Ongoing</span>
                  <span className="min-w-[18px] h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1">
                    {count > 99 ? "99+" : count}
                  </span>
                </Link>
              </Fragment>
            );
          }

          return (
            <Link key={item.name} href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-xl font-semibold transition-all",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              data-testid={`nav-${item.name.toLowerCase()}`}>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span>{item.name}</span>
            </Link>
          );
        })}

        {/* Divider + extra pages */}
        <div className="pt-2">
          <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">More</p>
          {extraItems.map((item) => {
            const isActive = location === item.href || location.startsWith(item.href);
            const Icon = item.icon;

            /* Special-case Today's Deals: red/orange/pink gradient pill so it
               draws the eye and feels "hot". Smooth pulsing fire icon. */
            if (item.resource === "deals") {
              return (
                <Link key={item.name} href={item.href}
                  className={cn(
                    "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl font-black text-sm overflow-hidden",
                    "transition-all duration-300 ease-out my-1",
                    isActive
                      ? "bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/30 scale-[1.02]"
                      : "bg-gradient-to-r from-red-500/[0.08] via-rose-500/[0.08] to-pink-500/[0.08] text-rose-600 dark:text-rose-300 hover:from-red-500/[0.18] hover:via-rose-500/[0.18] hover:to-pink-500/[0.18] hover:shadow-md hover:shadow-rose-500/20 hover:scale-[1.02]"
                  )}>
                  {/* Subtle ambient glow */}
                  <span aria-hidden className={cn(
                    "absolute inset-0 -z-0 rounded-xl bg-gradient-to-r from-red-400 via-rose-400 to-pink-400 blur-md transition-opacity duration-300",
                    isActive ? "opacity-40" : "opacity-0 group-hover:opacity-25"
                  )} />
                  {/* Shimmer sweep on hover */}
                  <span aria-hidden className="absolute inset-y-0 -inset-x-2 -z-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />

                  <span className="relative">
                    <Icon size={17} strokeWidth={2.5} className={cn("transition-transform duration-300", !isActive && "group-hover:scale-110 group-hover:rotate-6")} />
                  </span>
                  <span className="relative flex-1">{item.name}</span>
                  {/* Live pulse dot */}
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full",
                      isActive ? "bg-yellow-200 opacity-75" : "bg-rose-400 opacity-70"
                    )} />
                    <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full",
                      isActive ? "bg-yellow-300" : "bg-rose-500"
                    )} />
                  </span>
                </Link>
              );
            }

            return (
              <Link key={item.name} href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold transition-all text-sm",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}>
                <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="px-3 py-4 border-t border-border space-y-2">
        {/* Logged-in user + Sign Out */}
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 ${role === "owner" ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" : "bg-primary/10 text-primary"}`}>
            {staffName ? staffName.slice(0, 2).toUpperCase() : <User size={14} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground truncate">{staffName || "Unknown"}</p>
            <p className="text-[10px] text-muted-foreground capitalize">{role === "owner" ? "Owner" : "Staff"}</p>
          </div>
          <button onClick={handleLogout}
            title="Sign Out"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors shrink-0">
            <LogOut size={14} />
          </button>
        </div>

        <button onClick={toggleTheme}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-semibold text-sm"
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
          {isDark ? "Light Mode" : "Dark Mode"}
        </button>
        {visible("products") && perm("products") === "write" && (
          <Link href="/products/new"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted text-foreground font-semibold text-sm hover:bg-muted/70 transition-colors"
            data-testid="nav-add-product">
            <Plus size={16} />
            Add Product
          </Link>
        )}

        {/* Developer credit */}
        <div className="mt-1 px-2 py-2.5 rounded-xl bg-gradient-to-r from-violet-500/10 via-blue-500/10 to-cyan-500/10 border border-violet-500/20">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-0.5">Developed by</p>
          <p className="text-[11px] font-black bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-400 bg-clip-text text-transparent leading-tight">
            AddisonX Media
          </p>
        </div>
      </div>
    </aside>
  );
}
