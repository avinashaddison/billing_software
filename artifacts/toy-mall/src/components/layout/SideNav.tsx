import { Fragment } from "react";
import { Link, useLocation } from "wouter";
import { Home, Package, PackagePlus, ScanLine, Clock, User, Sun, Moon, IndianRupee, FileText, Users, Tag, Truck, Layers, Users2, ShoppingCart, LogOut, Settings2, Sparkles, PencilLine, AlertTriangle, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { useCart } from "@/contexts/cart-context";
import { useAuth } from "@/hooks/use-auth";
import { type Permissions } from "@/lib/permissions";
import { useStoreSettings } from "@/lib/store-info";
import { getSidebarTheme } from "@/lib/sidebar-themes";
import { UpdateBanner } from "@/components/layout/UpdateBanner";

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
  const theme = getSidebarTheme(store.logoBgTheme);

  const perm    = (resource: string) => getLevel(role, permissions, resource);
  const visible = (resource: string) => perm(resource) !== "none";

  /* See BottomNav for context. When already on /checkout, wouter's Link
     doesn't remount Checkout — so the URL flag wouldn't open the dialog.
     Fire an event in that case to nudge the open-state directly. */
  const isOnCheckout = location === "/checkout";
  const handleManualClick = (e: React.MouseEvent) => {
    if (isOnCheckout) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("checkout:open-manual"));
    }
  };

  /* Profile intentionally NOT here — it lives in the footer chip (clickable),
   * which both avoids the two-paths-to-same-page redundancy and frees a slot
   * in the main nav for the busier daily-driver pages. */
  const navItems = [
    { name: "Dashboard",   href: "/dashboard",         icon: Home,        highlight: false, resource: "dashboard" },
    { name: "Products",    href: "/products",          icon: Package,     highlight: false, resource: "products"  },
    /* Stock-in workstation. Separate from Scan (billing-first) and Logs
       (read-only history) — this is where stock actually comes IN. */
    { name: "Entry Data",  href: "/stock-entry",       icon: PackagePlus, highlight: false, resource: "scan"      },
    { name: "Scan",        href: "/scan",              icon: ScanLine,    highlight: true,  resource: "scan"      },
    /* Manual Bill — deep-links to /checkout with ?manual=1 so the dialog
       auto-opens on arrival. Sits next to the bread-and-butter Billing
       link because it creates a bill the same way. */
    { name: "Manual Bill", href: "/checkout?manual=1", icon: PencilLine,  highlight: false, resource: "billing"   },
    { name: "Billing",     href: "/billing",           icon: IndianRupee, highlight: false, resource: "billing"   },
    { name: "Logs",        href: "/logs",              icon: Clock,       highlight: false, resource: "logs"      },
  ].filter((item) => !item.resource || visible(item.resource));

  const extraItems = [
    { name: "Today's Deals", href: "/deals",       icon: Sparkles,      resource: "deals"      },
    { name: "Stock Alert",   href: "/stock-alert", icon: AlertTriangle, resource: "stockAlert" },
    { name: "Analytics",     href: "/analytics",   icon: BarChart3,     resource: "analytics"  },
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
      <div className={`relative m-2 mb-3 px-3.5 pt-2.5 pb-2.5 rounded-2xl overflow-hidden bg-gradient-to-br ${theme.outer} text-white shadow-lg shadow-indigo-950/30 ring-1 ring-white/5`}>
        {/* Conic-style gradient sheen — premium ambient depth */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-px opacity-90"
          style={{ background: theme.radial }}
        />
        {/* Soft animated breathing blob */}
        <div className={`pointer-events-none absolute -top-12 -left-10 w-32 h-32 rounded-full ${theme.blob1} blur-3xl animate-pulse`} style={{ animationDuration: "6s" }} />
        <div className={`pointer-events-none absolute -bottom-10 -right-8 w-28 h-28 rounded-full ${theme.blob2} blur-3xl animate-pulse`} style={{ animationDuration: "7s", animationDelay: "1.5s" }} />

        {/* Subtle grid overlay (premium dashboard vibe) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)," +
              "linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* Sparkle accent */}
        <span aria-hidden className={`absolute top-2.5 right-3 ${theme.sparkle} text-[9px] animate-pulse`} style={{ animationDuration: "3.5s" }}>✦</span>

        <div className="relative flex items-center gap-3 group">
          {/* Logo — glass card */}
          <div className="relative shrink-0">
            {/* Soft outer glow */}
            <div className={`absolute -inset-1 rounded-2xl bg-gradient-to-br ${theme.glow} opacity-50 blur-md transition-opacity duration-500 group-hover:opacity-80`} />
            {/* Glass tile */}
            <div className="relative w-9 h-9 rounded-xl bg-white/95 backdrop-blur flex items-center justify-center shadow-xl shadow-indigo-950/40 ring-1 ring-white/50">
              {store.logoUrl ? (
                <img src={store.logoUrl} alt="" className="w-6 h-6 object-contain drop-shadow-sm" />
              ) : (
                <span className="text-lg leading-none transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 drop-shadow-sm">
                  {store.logoEmoji}
                </span>
              )}
              {/* Glossy highlight */}
              <span className="pointer-events-none absolute inset-x-1 top-0.5 h-1/3 rounded-t-lg bg-gradient-to-b from-white/70 to-transparent" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-[12px] font-black tracking-tight leading-[1.2] text-white drop-shadow-sm whitespace-nowrap truncate" title={store.name}>
              {store.name}
            </h1>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
              </span>
              <p className={`text-[9px] font-black tracking-[0.18em] uppercase truncate bg-gradient-to-r ${theme.accentText} bg-clip-text text-transparent`}>
                Addison Bill Media
              </p>
            </div>
          </div>
        </div>

        {/* Decorative bottom edge */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-3 bg-gradient-to-b from-transparent to-background/0" />
      </div>
      {/* Hairline accent — sits inside the gap below the floating header card */}
      <div aria-hidden className={`mx-3 h-px bg-gradient-to-r from-transparent ${theme.hairline} to-transparent`} />

      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            location === item.href ||
            (item.href !== "/" && location.startsWith(item.href) && !item.highlight);
          const Icon = item.icon;

          if (item.highlight) {
            /* Scan is a primary CTA but it must NEVER outshine the actually
             * active page. When you're elsewhere we use a soft "primary
             * outline" treatment — still distinctive, no longer claims to be
             * the current page. Full bright fill only when location matches. */
            const scanActive = location === item.href || location.startsWith(item.href);
            return (
              <Link key={item.name} href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-xl font-bold transition-all my-2 relative active:scale-[0.98]",
                  scanActive
                    ? "bg-primary text-primary-foreground shadow-md hover:opacity-90"
                    : "bg-primary/10 text-primary ring-1 ring-primary/20 hover:bg-primary/15"
                )}
                data-testid={`nav-${item.name.toLowerCase()}`}>
                <Icon size={20} strokeWidth={scanActive ? 2.5 : 2} />
                <span className="flex-1">{item.name}</span>
                {count > 0 && (
                  <span className={cn(
                    "min-w-[20px] h-5 text-[10px] font-black rounded-full flex items-center justify-center px-1",
                    scanActive ? "bg-red-500 text-white" : "bg-primary text-primary-foreground"
                  )}>
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
              onClick={item.name === "Manual Bill" ? handleManualClick : undefined}
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

        {/* Real divider + extra pages — the old single-label group was too easy
         * to miss visually. A hairline + a confident label reads as a section. */}
        <div className="pt-3 mt-2 border-t border-border/60">
          <p className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">More</p>
          {extraItems.map((item) => {
            const isActive = location === item.href || location.startsWith(item.href);
            const Icon = item.icon;

            /* Today's Deals: full red gradient ONLY when on /deals. Otherwise
             * a quiet rose-tinted link that doesn't compete with the active
             * page (the old design read as an alert because of the bright
             * always-on gradient). The pulse dot stays — it's the actual
             * "something new" signal and earns its red. */
            if (item.resource === "deals") {
              return (
                <Link key={item.name} href={item.href}
                  className={cn(
                    "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all",
                    isActive
                      ? "bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 text-white font-black shadow-md shadow-rose-500/25"
                      : "text-rose-600 dark:text-rose-300 hover:bg-rose-500/10"
                  )}>
                  <Icon size={17} strokeWidth={isActive ? 2.5 : 2}
                    className={cn(
                      "transition-transform duration-200",
                      !isActive && "group-hover:scale-110"
                    )} />
                  <span className="flex-1">{item.name}</span>
                  {/* Live pulse dot — the only "alert" element left */}
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                      isActive ? "bg-yellow-200" : "bg-rose-400"
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
        {/* Logged-in user — clickable chip becomes the Profile entry point
         * (we removed Profile from main nav). Sign-out stays as a small icon
         * on the right so it doesn't get triggered by the chip tap. */}
        <div className="flex items-center gap-1">
          <Link href="/profile"
            className={cn(
              "flex-1 flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors min-w-0",
              location === "/profile" || location.startsWith("/profile")
                ? "bg-primary/10"
                : "hover:bg-muted"
            )}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 ${role === "owner" ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" : "bg-primary/10 text-primary"}`}>
              {staffName ? staffName.slice(0, 2).toUpperCase() : <User size={14} />}
            </div>
            <div className="flex-1 min-w-0">
              {/* If staffName is literally just the role ("Owner"/"Staff"),
               * we'd render "Owner / Owner" which is silly. Collapse to a
               * single line in that case. */}
              {(() => {
                const roleLabel = role === "owner" ? "Owner" : "Staff";
                const nameIsJustRole = staffName?.trim().toLowerCase() === roleLabel.toLowerCase();
                return nameIsJustRole ? (
                  <>
                    <p className="text-xs font-bold text-foreground truncate">{roleLabel}</p>
                    <p className="text-[10px] text-muted-foreground">Tap to edit profile</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-bold text-foreground truncate">{staffName || "Unknown"}</p>
                    <p className="text-[10px] text-muted-foreground">{roleLabel}</p>
                  </>
                );
              })()}
            </div>
          </Link>
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
        {role === "owner" && <UpdateBanner />}

        {/* Developer credit */}
        <div className="mt-1 px-2 py-2.5 rounded-xl bg-gradient-to-r from-violet-500/10 via-blue-500/10 to-cyan-500/10 border border-violet-500/20">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-0.5">Developed by</p>
          <p className="text-[11px] font-black bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-400 bg-clip-text text-transparent leading-tight">
            Addison Bill Media
          </p>
        </div>
      </div>
    </aside>
  );
}
