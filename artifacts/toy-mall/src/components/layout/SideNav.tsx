import { Fragment } from "react";
import { Link, useLocation } from "wouter";
import { Home, Package, ScanLine, Clock, User, Plus, Sun, Moon, IndianRupee, FileText, Users, Tag, Truck, Layers, Users2, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { useCart } from "@/contexts/cart-context";
import { useAuth } from "@/hooks/use-auth";
import { type Permissions } from "@/lib/permissions";

function getLevel(role: string | null, permissions: Permissions, resource: string): "none" | "read" | "write" {
  if (role === "owner") return "write";
  return (permissions as Record<string, "none" | "read" | "write">)[resource] ?? "none";
}

export function SideNav() {
  const [location] = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const { count } = useCart();
  const { role, permissions } = useAuth();

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
    { name: "Reports",    href: "/report",     icon: FileText, resource: "reports"   },
    { name: "Customers",  href: "/customers",  icon: Users,    resource: "customers"  },
    { name: "Categories", href: "/categories", icon: Layers,   resource: "categories" },
    { name: "Labels",     href: "/labels",     icon: Tag,      resource: "labels"    },
    { name: "Suppliers",  href: "/suppliers",  icon: Truck,    resource: "suppliers"  },
    { name: "Staff",      href: "/staff",      icon: Users2,   resource: "staff"     },
  ].filter((item) => visible(item.resource));

  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-background border-r border-border shrink-0 sticky top-0 h-screen">
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-sm shadow-primary/30">
            <span className="text-base leading-none">🧸</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-[13px] font-black tracking-tight text-foreground leading-tight whitespace-nowrap">VishwaKarma Complex</h1>
            <p className="text-[10px] text-muted-foreground font-medium mt-px">Billing Management</p>
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
                  <span className="flex-1">Ongoing Checkout</span>
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
