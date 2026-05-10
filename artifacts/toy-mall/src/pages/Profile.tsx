import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useLocation } from "wouter";
import {
  Shield, LogOut, Sun, Moon, Users2, ChevronRight, Key,
  Volume2, VolumeX, Settings2, Sparkles, Palette, ShieldCheck,
} from "lucide-react";
import { useStoreSettings } from "@/lib/store-info";
import { isSoundMuted, toggleSoundMute } from "@/lib/sounds";

export default function Profile() {
  const { role, staffName, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [, setLocation] = useLocation();
  const [soundMuted, setSoundMuted] = useState(() => isSoundMuted());
  const store = useStoreSettings();

  const initials = staffName
    ? staffName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
    : "??";

  const isOwner = role === "owner";

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const heroGradient = isOwner
    ? "from-amber-500 via-orange-500 to-rose-500"
    : "from-violet-500 via-indigo-500 to-blue-500";
  const heroAccent = isOwner ? "shadow-amber-500/40" : "shadow-violet-500/40";

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 md:px-8 py-3 border-b sticky top-0 bg-background/90 backdrop-blur-md z-10">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <h1 className="text-xl md:text-2xl font-black tracking-tight">Profile</h1>
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 font-bold text-xs transition-colors active:scale-95">
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 md:pb-8">
        <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-5">

          {/* ── Hero card ── */}
          <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${heroGradient} text-white shadow-xl ${heroAccent}`}>
            {/* Ambient blobs */}
            <div aria-hidden className="absolute -top-16 -right-12 w-48 h-48 rounded-full bg-white/15 blur-3xl" />
            <div aria-hidden className="absolute -bottom-16 -left-10 w-44 h-44 rounded-full bg-white/10 blur-3xl" />
            {/* Subtle grid */}
            <div aria-hidden className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "16px 16px" }} />

            <div className="relative px-6 pt-7 pb-6 flex flex-col items-center text-center">
              {/* Avatar with glow */}
              <div className="relative mb-4">
                <div aria-hidden className="absolute -inset-2 rounded-full bg-white/30 blur-md" />
                <div className="relative w-24 h-24 rounded-full bg-white text-foreground flex items-center justify-center text-3xl font-black shadow-2xl ring-4 ring-white/40">
                  <span className={isOwner ? "bg-gradient-to-br from-amber-600 to-rose-500 bg-clip-text text-transparent" : "bg-gradient-to-br from-violet-600 to-indigo-500 bg-clip-text text-transparent"}>
                    {initials}
                  </span>
                  {isOwner && (
                    <span className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center ring-4 ring-white shadow-lg">
                      <Sparkles className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                    </span>
                  )}
                </div>
              </div>

              <h2 className="text-2xl font-black drop-shadow-sm">{staffName || "Unknown"}</h2>
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/25 backdrop-blur-sm border border-white/30 text-xs font-black uppercase tracking-wider">
                {isOwner ? <ShieldCheck className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                {isOwner ? "Owner · Full Access" : "Staff Member"}
              </div>

              {/* Shop name footer in hero */}
              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
                @ {store.name}
              </p>
            </div>
          </div>

          {/* ── Preferences ── */}
          <SectionTitle icon={Palette}>Preferences</SectionTitle>
          <div className="rounded-3xl border bg-card overflow-hidden divide-y divide-border/60">
            <ToggleRow
              icon={isDark ? Sun : Moon}
              tint="violet"
              title="Appearance"
              subtitle={isDark ? "Dark mode is on" : "Light mode is on"}
              checked={isDark}
              onChange={toggleTheme}
              valueLabel={isDark ? "Dark" : "Light"}
            />
            <ToggleRow
              icon={soundMuted ? VolumeX : Volume2}
              tint="emerald"
              title="Sound Effects"
              subtitle={soundMuted ? "Scan & checkout sounds are off" : "Scan beeps and checkout chime are on"}
              checked={!soundMuted}
              onChange={() => { const next = toggleSoundMute(); setSoundMuted(next); }}
              valueLabel={soundMuted ? "Off" : "On"}
            />
          </div>

          {/* ── Shop Management (owner only) ── */}
          {isOwner && (
            <>
              <SectionTitle icon={Settings2}>Shop Management</SectionTitle>
              <div className="rounded-3xl border bg-card overflow-hidden divide-y divide-border/60">
                <NavRow
                  icon={Users2}
                  tint="amber"
                  title="Staff Management"
                  subtitle="Manage staff accounts & permissions"
                  onClick={() => setLocation("/staff")}
                />
                <NavRow
                  icon={Settings2}
                  tint="blue"
                  title="Shop Settings"
                  subtitle="Edit shop name, billing info & logo"
                  onClick={() => setLocation("/settings")}
                />
              </div>
            </>
          )}

          {/* ── Security ── */}
          <SectionTitle icon={ShieldCheck}>Security</SectionTitle>
          <div className="rounded-3xl border bg-card overflow-hidden">
            <div className="p-4 flex items-center gap-3">
              <IconTile icon={Key} tint="slate" />
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm">PIN Security</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {isOwner
                    ? "To reset your PIN, ask another owner to reset it from Staff Management."
                    : "Ask an owner to reset your PIN from Staff Management."}
                </p>
              </div>
            </div>
          </div>

          {/* ── Sign Out — large variant for bottom of page ── */}
          <button
            onClick={handleLogout}
            data-testid="button-logout"
            className="w-full mt-2 flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white font-black text-sm shadow-lg shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/40 transition-all active:scale-[0.98]"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>

          <p className="text-center text-[10px] text-muted-foreground/60 pt-2">
            Counter Billing
          </p>
        </div>
      </div>
    </div>
  );
}

/* ───── reusable bits ───── */

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-1 pt-2">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{children}</p>
    </div>
  );
}

function IconTile({ icon: Icon, tint }: { icon: React.ElementType; tint: "violet" | "emerald" | "amber" | "blue" | "slate" }) {
  const tints: Record<typeof tint, string> = {
    violet:  "bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber:   "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300",
    blue:    "bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300",
    slate:   "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
  };
  return (
    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${tints[tint]}`}>
      <Icon className="w-5 h-5" strokeWidth={2.25} />
    </div>
  );
}

function ToggleRow({ icon, tint, title, subtitle, checked, onChange, valueLabel }: {
  icon: React.ElementType;
  tint: "violet" | "emerald" | "amber" | "blue" | "slate";
  title: string;
  subtitle: string;
  checked: boolean;
  onChange: () => void;
  valueLabel: string;
}) {
  return (
    <div className="p-4 flex items-center gap-3">
      <IconTile icon={icon} tint={tint} />
      <div className="flex-1 min-w-0">
        <p className="font-black text-sm">{title}</p>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{valueLabel}</span>
      <button
        type="button"
        onClick={onChange}
        role="switch"
        aria-checked={checked}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-gradient-to-r from-emerald-500 to-teal-500 shadow-inner" : "bg-muted"
        }`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`} />
      </button>
    </div>
  );
}

function NavRow({ icon, tint, title, subtitle, onClick }: {
  icon: React.ElementType;
  tint: "violet" | "emerald" | "amber" | "blue" | "slate";
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full p-4 flex items-center gap-3 hover:bg-muted/40 active:bg-muted transition-colors text-left"
    >
      <IconTile icon={icon} tint={tint} />
      <div className="flex-1 min-w-0">
        <p className="font-black text-sm">{title}</p>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}
