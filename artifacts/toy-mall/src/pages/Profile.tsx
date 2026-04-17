import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { User, Shield, LogOut, Settings, HelpCircle, PhoneCall, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function Profile() {
  const { role, setRole, userId } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 md:px-6 border-b sticky top-0 bg-background z-10">
        <h1 className="text-2xl font-black tracking-tight">Profile</h1>
      </div>

      <div className="flex-1 p-4 md:p-6 space-y-6 overflow-y-auto pb-32 md:pb-6 md:max-w-xl">
        {/* Avatar card */}
        <div className="flex flex-col items-center justify-center p-8 bg-card border rounded-3xl text-center shadow-sm">
          <Avatar className="w-24 h-24 mb-4 border-4 border-background shadow-lg">
            <AvatarFallback className="bg-primary/10 text-primary text-2xl font-black">
              {role === "Admin" ? "AD" : "ST"}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-xl font-black">{role === "Admin" ? "Administrator" : "Warehouse Staff"}</h2>
          <p className="text-muted-foreground font-mono text-sm mt-1">ID: {userId}</p>

          <div className="mt-4 px-4 py-1.5 bg-muted rounded-full flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-primary">{role} Access</span>
          </div>
        </div>

        {/* Settings card */}
        <div className="p-2 bg-card border rounded-3xl shadow-sm">
          {/* Role toggle */}
          <div className="p-4 flex items-center justify-between border-b border-dashed border-muted">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold">Demo Mode</p>
                <p className="text-xs text-muted-foreground">Toggle admin features</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="role-switch" className="font-bold text-xs uppercase text-muted-foreground">Admin</Label>
              <Switch
                id="role-switch"
                checked={role === "Admin"}
                onCheckedChange={(checked) => setRole(checked ? "Admin" : "Staff")}
              />
            </div>
          </div>

          {/* Dark mode toggle */}
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
              <Switch
                id="theme-switch"
                checked={isDark}
                onCheckedChange={toggleTheme}
              />
            </div>
          </div>

          <MenuItem icon={Settings} label="App Settings" />
          <MenuItem icon={HelpCircle} label="Help & Support" />
          <MenuItem icon={PhoneCall} label="Contact Manager" border={false} />
        </div>

        <Button variant="destructive" className="w-full h-14 rounded-2xl font-bold text-lg shadow-sm" data-testid="button-logout">
          <LogOut className="w-5 h-5 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, label, border = true }: { icon: any; label: string; border?: boolean }) {
  return (
    <button className={`w-full p-4 flex items-center gap-3 hover:bg-muted/50 active:bg-muted transition-colors text-left ${border ? "border-b border-dashed border-muted" : ""}`}>
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
        <Icon className="w-5 h-5" />
      </div>
      <span className="font-bold flex-1">{label}</span>
    </button>
  );
}
