import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useLocation } from "wouter";
import { Shield, LogOut, Sun, Moon, Users2, ChevronRight, Key, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { isSoundMuted, toggleSoundMute } from "@/lib/sounds";

export default function Profile() {
  const { role, staffName, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [, setLocation] = useLocation();
  const [soundMuted, setSoundMuted] = useState(() => isSoundMuted());

  const initials = staffName
    ? staffName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
    : "??";

  const isOwner = role === "owner";

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 md:px-6 border-b sticky top-0 bg-background z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black tracking-tight">Profile</h1>
          <button onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 font-bold text-sm transition-colors active:scale-95">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-6 space-y-6 overflow-y-auto pb-32 md:pb-6 md:max-w-xl">
        {/* Avatar card */}
        <div className="flex flex-col items-center justify-center p-8 bg-card border rounded-3xl text-center shadow-sm">
          <Avatar className="w-24 h-24 mb-4 border-4 border-background shadow-lg">
            <AvatarFallback className={`text-2xl font-black ${isOwner ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" : "bg-primary/10 text-primary"}`}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-xl font-black">{staffName || "Unknown"}</h2>

          <div className={`mt-4 px-4 py-1.5 rounded-full flex items-center gap-2 ${isOwner ? "bg-amber-100 dark:bg-amber-900/30" : "bg-muted"}`}>
            <Shield className={`w-4 h-4 ${isOwner ? "text-amber-600 dark:text-amber-400" : "text-primary"}`} />
            <span className={`text-sm font-bold ${isOwner ? "text-amber-700 dark:text-amber-300" : "text-primary"}`}>
              {isOwner ? "Owner — Full Access" : "Staff Member"}
            </span>
          </div>
        </div>

        {/* Settings card */}
        <div className="p-2 bg-card border rounded-3xl shadow-sm">

          {/* Dark mode */}
          <div className="p-4 flex items-center justify-between border-b border-dashed border-muted">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </div>
              <div>
                <p className="font-bold">Appearance</p>
                <p className="text-xs text-muted-foreground">{isDark ? "Dark mode is on" : "Light mode is on"}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="theme-switch" className="font-bold text-xs uppercase text-muted-foreground">
                {isDark ? "Dark" : "Light"}
              </Label>
              <Switch id="theme-switch" checked={isDark} onCheckedChange={toggleTheme} />
            </div>
          </div>

          {/* Sound effects */}
          <div className="p-4 flex items-center justify-between border-b border-dashed border-muted">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                {soundMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </div>
              <div>
                <p className="font-bold">Sound Effects</p>
                <p className="text-xs text-muted-foreground">
                  {soundMuted ? "Scan & checkout sounds are off" : "Scan beeps and checkout chime are on"}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="sound-switch" className="font-bold text-xs uppercase text-muted-foreground">
                {soundMuted ? "Off" : "On"}
              </Label>
              <Switch
                id="sound-switch"
                checked={!soundMuted}
                onCheckedChange={() => { const next = toggleSoundMute(); setSoundMuted(next); }}
              />
            </div>
          </div>

          {/* Staff management (owner only) */}
          {isOwner && (
            <button
              onClick={() => setLocation("/staff")}
              className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 active:bg-muted transition-colors text-left border-b border-dashed border-muted"
            >
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Users2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold">Staff Management</p>
                <p className="text-xs text-muted-foreground">Manage staff accounts & permissions</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          )}

          {/* Change PIN info */}
          <div className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <Key className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-bold">PIN Security</p>
              <p className="text-xs text-muted-foreground">
                {isOwner ? "Ask another owner to reset your PIN from Staff Management" : "Ask an owner to reset your PIN"}
              </p>
            </div>
          </div>
        </div>

        <Button
          variant="destructive"
          className="w-full h-14 rounded-2xl font-bold text-lg shadow-sm"
          data-testid="button-logout"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
