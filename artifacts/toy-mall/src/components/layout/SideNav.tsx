import { Fragment, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Home, Package, ScanLine, Clock, User, Sun, Moon, IndianRupee, FileText, Users, Tag, Truck, Layers, Users2, ShoppingCart, LogOut, Settings2, Sparkles, KeyRound } from "lucide-react";
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

  // Pull license status so the License Key button can show a Pro badge
  // when activated. Re-fetches after navigation in case the user just
  // activated a key on /license.
  const [licenseMode, setLicenseMode] = useState<string | null>(null);
  useEffect(() => {
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    fetch(`${base}/api/license/status`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setLicenseMode(d?.mode ?? null))
      .catch(() => { /* ignore */ });
  }, [location]);
  const isLicensed = licenseMode === "licensed";

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
      <div className="relative px-4 pt-4 pb-3 overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 text-white">
        {/* Conic-style gradient sheen — premium ambient depth */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-px opacity-90"
          style={{
            background:
              "radial-gradient(120% 80% at 0% 0%, rgba(139,92,246,0.45) 0%, transparent 50%), " +
              "radial-gradient(100% 70% at 100% 100%, rgba(56,189,248,0.30) 0%, transparent 55%), " +
              "radial-gradient(60% 60% at 80% 0%, rgba(236,72,153,0.20) 0%, transparent 60%)",
          }}
        />
        {/* Soft animated breathing blob */}
        <div className="pointer-events-none absolute -top-12 -left-10 w-32 h-32 rounded-full bg-violet-500/40 blur-3xl animate-pulse" style={{ animationDuration: "6s" }} />
        <div className="pointer-events-none absolute -bottom-10 -right-8 w-28 h-28 rounded-full bg-cyan-400/25 blur-3xl animate-pulse" style={{ animationDuration: "7s", animationDelay: "1.5s" }} />

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
        <span aria-hidden className="absolute top-2.5 right-3 text-amber-200/70 text-[9px] animate-pulse" style={{ animationDuration: "3.5s" }}>✦</span>

        <div className="relative flex items-center gap-3 group">
          {/* Logo — glass card */}
          <div className="relative shrink-0">
            {/* Soft outer glow */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-fuchsia-400 via-violet-400 to-cyan-400 opacity-50 blur-md transition-opacity duration-500 group-hover:opacity-80" />
            {/* Glass tile */}
            <div className="relative w-11 h-11 rounded-2xl bg-white/95 backdrop-blur flex items-center justify-center shadow-xl shadow-indigo-950/40 ring-1 ring-white/50">
              {store.logoUrl ? (
                <img src={store.logoUrl} alt="" className="w-7 h-7 object-contain drop-shadow-sm" />
              ) : (
                <span className="text-xl leading-none transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 drop-shadow-sm">
                  {store.logoEmoji}
                </span>
              )}
              {/* Glossy highlight */}
              <span className="pointer-events-none absolute inset-x-1 top-0.5 h-1/3 rounded-t-xl bg-gradient-to-b from-white/70 to-transparent" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="text-[13px] font-black tracking-tight leading-[1.15] text-white drop-shadow-sm truncate">
                {store.name}
              </h1>
              {isLicensed && (
                <span className="inline-flex items-center gap-0.5 px-1 py-px rounded-md bg-gradient-to-r from-amber-400 to-orange-500 text-[8px] font-black tracking-wider shadow-md shadow-amber-500/40 shrink-0">
                  <Sparkles className="w-1.5 h-1.5" strokeWidth={3} />
                  PRO
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
              </span>
              <p className="text-[9px] font-black tracking-[0.18em] uppercase truncate bg-gradient-to-r from-violet-200 via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
                AddisonX Media
              </p>
            </div>
          </div>
        </div>

        {/* Decorative bottom edge */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-3 bg-gradient-to-b from-transparent to-background/0" />
      </div>
      {/* Hairline accent — premium thin metallic gradient */}
      <div aria-hidden className="h-px bg-gradient-to-r from-transparent via-violet-400/70 to-transparent" />

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
        {role === "owner" && (
          <Link href="/license"
            className="relative flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-sm hover:from-emerald-500/20 hover:to-teal-500/20 transition-colors"
            data-testid="nav-license">
            <KeyRound size={16} />
            <span className="flex-1">License Key</span>
            {isLicensed && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-[9px] font-black uppercase tracking-wider shadow-sm shadow-violet-500/40">
                <Sparkles className="w-2 h-2" strokeWidth={3} />
                Pro
              </span>
            )}
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
