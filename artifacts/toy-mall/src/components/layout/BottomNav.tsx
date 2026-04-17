import { Link, useLocation } from "wouter";
import { Home, Package, ScanLine, Clock, User, Receipt } from "lucide-react";
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
  const { count } = useCart();
  const { role, permissions } = useAuth();

  const visible = (resource: string) => getLevel(role, permissions, resource) !== "none";

  const allItems = [
    { name: "Home",    href: "/",        icon: Home,    resource: "dashboard" },
    { name: "Products",href: "/products", icon: Package, resource: "products"  },
    { name: "Scan",    href: "/scan",     icon: ScanLine,resource: "scan",    highlight: true },
    { name: "Billing", href: "/billing",  icon: Receipt, resource: "billing"  },
    { name: "Logs",    href: "/logs",     icon: Clock,   resource: "logs"     },
    { name: "Profile", href: "/profile",  icon: User,    resource: null       },
  ];

  /* Always show Profile. Filter others by permission. Keep max 6 items for mobile. */
  const navItems = allItems.filter((item) => !item.resource || visible(item.resource));

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border"
         style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
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
                isActive ? "text-primary" : "text-muted-foreground"
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
  );
}
