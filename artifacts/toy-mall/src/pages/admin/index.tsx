import { useState } from "react";
import { useAdminMe } from "./api";
import { LoginScreen } from "./LoginScreen";
import { Loader2, LayoutDashboard, Building2, IndianRupee, DatabaseBackup, ScrollText, LogOut, Menu, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import Dashboard from "./Dashboard";
import ShopsList from "./ShopsList";
import Pricing from "./Pricing";
import Backups from "./Backups";
import AuditLog from "./AuditLog";

type Section = "dashboard" | "shops" | "pricing" | "backups" | "audit";

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "shops",     label: "Shops",     icon: Building2 },
  { key: "pricing",   label: "Pricing",   icon: IndianRupee },
  { key: "backups",   label: "Backups",   icon: DatabaseBackup },
  { key: "audit",     label: "Audit Log", icon: ScrollText },
] as const;

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
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!me) {
    return <LoginScreen onAuthed={() => refetch()} />;
  }

  const SidebarContent = (
    <div className="flex flex-col h-full bg-card/50 backdrop-blur-xl border-r">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shrink-0">
          <ShieldCheck className="w-6 h-6" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight">Addison Bill</p>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-0.5">Console</p>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4">
        <div className="space-y-1 py-2">
          {NAV.map((item) => {
            const active = section === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setSection(item.key);
                  setNavOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </div>
      </ScrollArea>

      <div className="p-4 mt-auto border-t">
        <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 rounded-xl mb-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold uppercase shrink-0">
            {me.email.slice(0, 1)}
          </div>
          <p className="text-xs font-medium truncate text-muted-foreground">{me.email}</p>
        </div>
        <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={logout}>
          <LogOut className="w-4 h-4 mr-2" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-72 shrink-0 h-[100dvh] sticky top-0">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {navOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setNavOpen(false)} />
          <aside className="relative w-72 h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        {/* Mobile Header */}
        <div className="lg:hidden sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b p-4 flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => setNavOpen(true)}>
            <Menu className="w-4 h-4" />
          </Button>
          <p className="font-semibold">{NAV.find((n) => n.key === section)?.label}</p>
        </div>

        {/* Content Area */}
        <ScrollArea className="flex-1">
          <div className="p-6 md:p-10 max-w-7xl mx-auto w-full">
            {section === "dashboard" && <Dashboard onNavigate={setSection} />}
            {section === "shops" && <ShopsList />}
            {section === "pricing" && <Pricing />}
            {section === "backups" && <Backups />}
            {section === "audit" && <AuditLog />}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
