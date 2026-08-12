import { useState } from "react";
import { useAdminMe } from "./api";
import { LoginScreen } from "./LoginScreen";
import {
  Loader2, LayoutDashboard, Building2, IndianRupee, DatabaseBackup,
  ScrollText, LogOut, Menu, Wallet, Megaphone, Activity,
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

/* Grouped by the job being done — watch, run, verify — so the rail reads as
 * three decisions instead of eight equally-weighted buttons. */
type NavItem = { key: Section; label: string; icon: LucideIcon };

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
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
      <div className="admin-console flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.75} />
      </div>
    );
  }

  if (!me) {
    return <LoginScreen onAuthed={() => refetch()} />;
  }

  const SidebarContent = (
    <div className="flex h-full flex-col border-r bg-background">
      <div className="px-5 py-6">
        <p className="text-[13px] font-medium tracking-tight">Addison Bill</p>
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Console
        </p>
      </div>

      <ScrollArea className="flex-1 px-2.5">
        <nav className="space-y-6 pb-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-2.5 pb-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
                {group.label}
              </p>
              <div className="space-y-px">
                {group.items.map((item) => {
                  const active = section === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        setSection(item.key);
                        setNavOpen(false);
                      }}
                      className={`relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors ${
                        active
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      {/* The accent colour appears exactly once per screen:
                          on the thing you are currently looking at. */}
                      <span
                        className={`absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-opacity ${
                          active ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className="border-t px-2.5 py-3">
        <p className="truncate px-2.5 pb-2 text-xs text-muted-foreground">{me.email}</p>
        <button
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="admin-console flex min-h-[100dvh] bg-background text-foreground">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-[100dvh] w-60 shrink-0 lg:block">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-foreground/20" onClick={() => setNavOpen(false)} />
          <aside className="relative w-60 animate-in slide-in-from-left duration-150">
            {SidebarContent}
          </aside>
        </div>
      )}

      <main className="flex h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden">
        <div className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background px-3 py-2.5 lg:hidden">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setNavOpen(true)}>
            <Menu className="h-4 w-4" strokeWidth={1.75} />
          </Button>
          <p className="text-[13px] font-medium">
            {NAV_FLAT.find((n) => n.key === section)?.label}
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10 md:py-10">
            {section === "dashboard" && <Dashboard onNavigate={setSection} />}
            {section === "shops" && <ShopsList />}
            {section === "money" && <Money />}
            {section === "notices" && <Notices />}
            {section === "health" && <Health />}
            {section === "pricing" && <Pricing />}
            {section === "backups" && <Backups />}
            {section === "audit" && <AuditLog />}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
