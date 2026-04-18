import { Link, useLocation } from "wouter";
import { Home, Package, ScanLine, Clock, User, IndianRupee, ShoppingCart, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/contexts/cart-context";
import { useAuth } from "@/hooks/use-auth";
import { type Permissions } from "@/lib/permissions";

function getLevel(role: string | null, permissions: Permissions, resource: string): "none" | "read" | "write" {
  if (role === "owner") return "write";
  return (permissions as Record<string, "none" | "read" | "write">)[resource] ?? "none";
}

export function BottomNav() {
  const [location] = useLocation();
  const { count, total } = useCart();
  const { role, permissions } = useAuth();

  const visible = (resource: string) => getLevel(role, permissions, resource) !== "none";

  const allItems = [
    { name: "Home",    href: "/",        icon: Home,       resource: "dashboard" },
    { name: "Products",href: "/products", icon: Package,    resource: "products"  },
    { name: "Scan",    href: "/scan",     icon: ScanLine,   resource: "scan",    highlight: true },
    { name: "Billing", href: "/billing",  icon: IndianRupee,resource: "billing"  },
    { name: "Logs",    href: "/logs",     icon: Clock,      resource: "logs"     },
    { name: "Profile", href: "/profile",  icon: User,       resource: null       },
  ];

  const navItems = allItems.filter((item) => !item.resource || visible(item.resource));

  const isOnCheckout = location === "/checkout";

  return (
    <>
      {/* ── Ongoing Checkout strip — floats above bottom nav, always mounted for smooth exit anim ── */}
      <Link
        href="/checkout"
        aria-hidden={count === 0}
        tabIndex={count === 0 ? -1 : 0}
        className={cn(
          "md:hidden fixed left-0 right-0 z-[49] flex items-center gap-3 px-4 py-3",
          "transition-all duration-300 ease-in-out",
          count > 0
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-3 pointer-events-none",
          isOnCheckout ? "bg-green-700 text-white" : "bg-primary text-primary-foreground",
        )}
        style={{ bottom: "64px" }}
      >
        {/* Live pulse dot */}
        <div className="relative shrink-0 w-2 h-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-ping absolute" />
          <div className="w-2 h-2 rounded-full bg-green-400" />
        </div>

        {/* Cart icon + label */}
        <ShoppingCart className="w-4 h-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black leading-none">Ongoing</p>
          <p className="text-[10px] font-medium opacity-80 mt-0.5 truncate">
            {count} item{count !== 1 ? "s" : ""} in cart
          </p>
        </div>

        {/* Running total */}
        <p className="font-black text-sm tabular-nums shrink-0">
          ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <ArrowRight className="w-4 h-4 shrink-0 opacity-80" />
      </Link>

      {/* ── Main bottom nav ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-around h-16 px-1">
          {navItems.map((item) => {
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href) && !item.highlight);
            const Icon = item.icon;

            if (item.highlight) {
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className="relative -top-4 flex flex-col items-center justify-center group"
                  data-testid={`nav-${item.name.toLowerCase()}`}
                >
                  <div className="relative">
                    <div className="w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg group-active:scale-95 transition-transform">
                      <Icon size={26} />
                    </div>
                    {count > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 shadow-md">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] mt-1 font-semibold text-primary">Scan</span>
                </Link>
              );
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
                data-testid={`nav-${item.name.toLowerCase()}`}
              >
                <Icon size={19} strokeWidth={isActive ? 2.5 : 2} />
                <span className={cn("text-[9px] leading-none", isActive ? "font-black" : "font-medium")}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
