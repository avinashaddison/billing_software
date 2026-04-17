import { Link, useLocation } from "wouter";
import { Home, Package, ScanLine, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { name: "Dashboard", href: "/", icon: Home },
    { name: "Products", href: "/products", icon: Package },
    { name: "Scan", href: "/scan", icon: ScanLine, highlight: true },
    { name: "Logs", href: "/logs", icon: Clock },
    { name: "Profile", href: "/profile", icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t pb-safe border-border">
      <div className="flex items-center justify-around h-16 px-2 max-w-md mx-auto relative">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href) && !item.highlight);
          const Icon = item.icon;

          if (item.highlight) {
            return (
              <Link key={item.name} href={item.href} className="relative -top-4 flex flex-col items-center justify-center group" data-testid={`nav-${item.name.toLowerCase()}`}>
                <div className="w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg group-active:scale-95 transition-transform">
                  <Icon size={28} />
                </div>
                <span className="text-[10px] mt-1 font-semibold text-primary">Scan</span>
              </Link>
            );
          }

          return (
            <Link key={item.name} href={item.href} className={cn("flex flex-col items-center justify-center w-16 h-full space-y-1 transition-colors", isActive ? "text-primary" : "text-muted-foreground")} data-testid={`nav-${item.name.toLowerCase()}`}>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className={cn("text-[10px]", isActive ? "font-bold" : "font-medium")}>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
