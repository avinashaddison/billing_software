import { Link, useLocation } from "wouter";
import { Home, Package, ScanLine, Clock, User, Plus, Sun, Moon, Receipt, FileText, Users, Tag, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { useCart } from "@/contexts/cart-context";
import { useAuth } from "@/hooks/use-auth";

export function SideNav() {
  const [location] = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const { count } = useCart();
  const { role } = useAuth();
  const isAdmin = role === "Admin";

  const navItems = [
    { name: "Dashboard", href: "/",          icon: Home,     highlight: false },
    { name: "Products",  href: "/products",  icon: Package,  highlight: false },
    { name: "Scan",      href: "/scan",      icon: ScanLine, highlight: true  },
    { name: "Billing",   href: "/billing",   icon: Receipt,  highlight: false },
    { name: "Logs",      href: "/logs",      icon: Clock,    highlight: false },
    { name: "Profile",   href: "/profile",   icon: User,     highlight: false },
  ];

  const extraItems = [
    { name: "Reports",   href: "/report",    icon: FileText },
    { name: "Customers", href: "/customers", icon: Users    },
    { name: "Labels",    href: "/labels",    icon: Tag      },
    ...(isAdmin ? [{ name: "Suppliers", href: "/suppliers", icon: Truck }] : []),
  ];

  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-background border-r border-border shrink-0 sticky top-0 h-screen">
      <div className="px-5 py-6 border-b border-border">
        <h1 className="text-xl font-black tracking-tight text-foreground">ToyMall</h1>
        <p className="text-xs text-muted-foreground font-medium mt-0.5">Inventory System</p>
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
        <Link href="/products/new"
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted text-foreground font-semibold text-sm hover:bg-muted/70 transition-colors"
          data-testid="nav-add-product">
          <Plus size={16} />
          Add Product
        </Link>
      </div>
    </aside>
  );
}
