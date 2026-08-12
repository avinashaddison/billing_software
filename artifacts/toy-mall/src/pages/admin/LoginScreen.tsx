import { useState } from "react";
import { Loader2, Building2 } from "lucide-react";
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
    <div className="admin-console flex min-h-[100dvh] bg-[#1E1B4B] text-foreground">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-[420px] lg:flex-col lg:justify-between bg-gradient-to-b from-[#1E1B4B] to-[#312E81] p-10">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-900/40">
            <Building2 className="h-5 w-5 text-white" strokeWidth={2} />
          </div>
          <div>
            <p className="text-[14px] font-bold tracking-tight text-white">Addison Bill</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300/70">Console</p>
          </div>
        </div>

        <div>
          <h2 className="text-[28px] font-bold leading-tight tracking-tight text-white">
            Platform Administration
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-violet-200/60">
            Manage shops, monitor revenue, and keep the platform healthy — all from one place.
          </p>
        </div>

        <p className="text-[11px] text-violet-300/30">© Addison Bill Media</p>
      </div>

      {/* Right: login form */}
      <div className="flex flex-1 items-center justify-center bg-[#F5F4FF] px-6">
        <div className="w-full max-w-[360px]">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-900/40">
              <Building2 className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <p className="text-[14px] font-bold tracking-tight text-gray-900">Addison Bill</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">Console</p>
            </div>
          </div>

          <div className="mb-7">
            <h1 className="text-[22px] font-bold tracking-tight text-gray-900">Sign in</h1>
            <p className="mt-1 text-[13px] text-gray-400">Platform administrator access</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700 ring-1 ring-red-100">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[12px] font-medium text-gray-500">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-xl border-gray-200 bg-white text-[13px] focus:border-violet-400 focus:ring-violet-200"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[12px] font-medium text-gray-500">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={email && password ? password : password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl border-gray-200 bg-white text-[13px] focus:border-violet-400 focus:ring-violet-200"
              />
            </div>

            <Button
              type="submit"
              className="mt-2 h-11 w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-[13px] font-semibold text-white shadow-md shadow-violet-200 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50"
              disabled={!email || !password || busy}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.75} />}
              Sign in to Console
            </Button>
          </form>

          <p className="mt-8 text-[11px] text-gray-400">
            This area is restricted to authorised Addison Bill administrators.
          </p>
        </div>
      </div>
    </div>
  );
}
