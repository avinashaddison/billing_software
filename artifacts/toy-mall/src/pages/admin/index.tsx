import { useState } from "react";
import { useAdminMe } from "./api";
import { LoginScreen } from "./LoginScreen";
import {
  Loader2, LayoutDashboard, Building2, IndianRupee, DatabaseBackup,
  ScrollText, LogOut, Menu, Wallet, Megaphone, Activity, Bell,
  ChevronDown, Star, SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import Dashboard from "./Dashboard";
import ShopsList from "./ShopsList";
import Pricing from "./Pricing";
import Backups from "./Backups";
import AuditLog from "./AuditLog";
import Money from "./Money";
import Notices from "./Notices";
import Health from "./Health";

type Section = "dashboard" | "shops" | "money" | "notices" | "pricing" | "backups" | "health" | "audit";

type NavItem = { key: Section; label: string; icon: LucideIcon };

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "",
    items: [
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { key: "shops",     label: "Shops",     icon: Building2 },
    ],
  },
  {
    label: "Operate",
    items: [
      { key: "money",   label: "Money",   icon: Wallet },
      { key: "notices", label: "Notices", icon: Megaphone },
      { key: "pricing", label: "Pricing", icon: IndianRupee },
    ],
  },
  {
    label: "Maintain",
    items: [
      { key: "backups", label: "Backups",   icon: DatabaseBackup },
      { key: "health",  label: "Health",    icon: Activity },
      { key: "audit",   label: "Audit log", icon: ScrollText },
    ],
  },
];

const NAV_FLAT = NAV_GROUPS.flatMap((g) => g.items);

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function firstName(email: string): string {
  return email.split("@")[0]?.split(".")[0] ?? email;
}
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function AdminConsole() {
  const { data: me, isLoading, refetch } = useAdminMe();
  const [section, setSection] = useState<Section>("dashboard");
  const [navOpen, setNavOpen] = useState(false);

  const logout = async () => {
    const BASE = (typeof window !== "undefined" && import.meta.env.BASE_URL?.replace(/\/$/, "")) || "";
    await fetch(`${BASE}/api/platform/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    refetch();
  };

  if (isLoading) {
    return (
      <div className="admin-console flex min-h-[100dvh] items-center justify-center bg-[#F8F7FF]">
        <Loader2 className="h-5 w-5 animate-spin text-violet-400" strokeWidth={1.75} />
      </div>
    );
  }

  if (!me) {
    return <LoginScreen onAuthed={() => refetch()} />;
  }

  const name = capitalize(firstName(me.email));

  const SidebarContent = (
    <div className="flex h-full flex-col bg-[#1E1B4B]">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-900/40">
          <Building2 className="h-5 w-5 text-white" strokeWidth={2} />
        </div>
        <div>
          <p className="text-[14px] font-bold tracking-tight text-white">Addison Bill</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300/70">
            Console
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3">
        <nav className="space-y-1 pb-4">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className={group.label ? "pt-4" : ""}>
              {group.label && (
                <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300/50">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = section === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        setSection(item.key);
                        setNavOpen(false);
                      }}
                      className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150 ${
                        active
                          ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-900/30"
                          : "text-violet-200/70 hover:bg-white/5 hover:text-violet-100"
                      }`}
                    >
                      <item.icon
                        className={`h-4 w-4 shrink-0 transition-colors ${active ? "text-white" : "text-violet-300/60 group-hover:text-violet-200"}`}
                        strokeWidth={1.75}
                      />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Pro upgrade card */}
      <div className="mx-3 mb-3 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/10 p-4 ring-1 ring-amber-400/20">
        <div className="mb-2 flex items-center gap-2">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <span className="text-[12px] font-semibold text-amber-300">Addison Bill Pro</span>
        </div>
        <p className="mb-3 text-[11px] leading-relaxed text-violet-200/60">
          Unlock advanced reports, multi-user access &amp; priority support.
        </p>
        <button className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-500 px-3 py-2 text-[12px] font-semibold text-white shadow-md shadow-violet-900/30 transition-opacity hover:opacity-90">
          Upgrade Now →
        </button>
      </div>

      {/* User + sign out */}
      <div className="border-t border-white/10 px-3 py-3">
        <p className="truncate px-3 pb-2 text-[11px] text-violet-300/50">{me.email}</p>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-violet-200/60 transition-colors hover:bg-white/5 hover:text-violet-100"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          Sign out
        </button>
      </div>
    </div>
  );

  const currentLabel = NAV_FLAT.find((n) => n.key === section)?.label ?? "";

  return (
    <div className="admin-console flex min-h-[100dvh] bg-[#F5F4FF] text-foreground">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-[100dvh] w-64 shrink-0 lg:block">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setNavOpen(false)} />
          <aside className="relative w-64 animate-in slide-in-from-left duration-200">
            {SidebarContent}
          </aside>
        </div>
      )}

      <main className="flex h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-violet-100/60 bg-white/80 px-6 py-3.5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 lg:hidden"
              onClick={() => setNavOpen(true)}
            >
              <Menu className="h-4 w-4" strokeWidth={1.75} />
            </Button>
            <div className="hidden lg:block">
              <h2 className="text-[17px] font-bold tracking-tight text-gray-900">
                {greeting()}, {name} 👋
              </h2>
              <p className="text-[12px] text-gray-400">Here's what's happening across your shops today.</p>
            </div>
            {/* Mobile: just show section name */}
            <p className="text-[14px] font-semibold text-gray-900 lg:hidden">{currentLabel}</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter */}
            <button className="hidden items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-medium text-gray-600 shadow-sm transition-colors hover:border-violet-300 hover:text-violet-700 sm:flex">
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
              Filter
            </button>

            {/* Bell */}
            <button className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white shadow-sm transition-colors hover:border-violet-300">
              <Bell className="h-4 w-4 text-gray-500" strokeWidth={1.75} />
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-violet-600" />
            </button>

            {/* Avatar chip */}
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white py-1 pl-1 pr-2 shadow-sm">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-[11px] font-bold text-white">
                {name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="text-[12px] font-semibold leading-tight text-gray-900">{name}</p>
                <p className="text-[10px] capitalize leading-tight text-gray-400">{me.role}</p>
              </div>
              <ChevronDown className="h-3 w-3 text-gray-400" strokeWidth={2} />
            </div>
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-5 py-7 md:px-8">
            {section === "dashboard" && <Dashboard onNavigate={setSection} />}
            {section === "shops"     && <ShopsList />}
            {section === "money"     && <Money />}
            {section === "notices"   && <Notices />}
            {section === "health"    && <Health />}
            {section === "pricing"   && <Pricing />}
            {section === "backups"   && <Backups />}
            {section === "audit"     && <AuditLog />}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
