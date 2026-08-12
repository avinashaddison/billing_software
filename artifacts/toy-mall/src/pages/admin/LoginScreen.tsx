import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { adminQueryKeys } from "./api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BASE = (typeof window !== "undefined" && import.meta.env.BASE_URL?.replace(/\/$/, "")) || "";
const API = `${BASE}/api`;

export function LoginScreen({ onAuthed }: { onAuthed: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`${API}/platform/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data.error || "Invalid platform admin credentials");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: adminQueryKeys.me });
      onAuthed();
    } catch {
      setError("Server unreachable");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-console flex min-h-[100dvh] items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-[320px]">
        <div className="mb-9">
          <p className="text-[15px] font-medium tracking-tight">Addison Bill</p>
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Platform console
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {error && (
            <p className="border-l-2 border-destructive py-1.5 pl-3 text-[13px] leading-relaxed text-destructive">
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-normal text-muted-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-normal text-muted-foreground">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10"
            />
          </div>

          <Button type="submit" className="h-10 w-full" disabled={!email || !password || busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.75} />}
            Sign in
          </Button>
        </form>

        <p className="mt-10 border-t pt-4 text-[11px] text-muted-foreground">
          Addison Bill Media
        </p>
      </div>
    </div>
  );
}
