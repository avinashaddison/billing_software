import { useState } from "react";
import { Loader2, ShieldCheck, Mail, KeyRound, ArrowRight } from "lucide-react";
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
    <div className="admin-console relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#07060F] px-5 py-10 text-white">
      {/* Layered backdrop: grid + glow orbs */}
      <div className="sec-grid-bg pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/20 blur-[140px]" />
      <div className="pointer-events-none absolute right-[10%] top-[8%] h-44 w-44 rounded-full bg-cyan-500/10 blur-[90px]" />
      <div className="pointer-events-none absolute bottom-[8%] left-[8%] h-44 w-44 rounded-full bg-indigo-500/10 blur-[90px]" />

      {/* Corner readouts */}
      <p className="pointer-events-none absolute left-6 top-5 hidden font-mono text-[10px] tracking-[0.22em] text-violet-400/40 sm:block">
        ADDISON BILL // SECURE GATEWAY
      </p>
      <p className="pointer-events-none absolute bottom-5 right-6 hidden font-mono text-[10px] tracking-[0.22em] text-violet-400/40 sm:block">
        TLS 1.3 · AES-256 · CONSOLE v2
      </p>

      <div className="relative w-full max-w-[400px]">
        {/* HUD corner brackets */}
        <span className="pointer-events-none absolute -left-2.5 -top-2.5 h-6 w-6 rounded-tl-md border-l-2 border-t-2 border-violet-400/50" />
        <span className="pointer-events-none absolute -right-2.5 -top-2.5 h-6 w-6 rounded-tr-md border-r-2 border-t-2 border-violet-400/50" />
        <span className="pointer-events-none absolute -bottom-2.5 -left-2.5 h-6 w-6 rounded-bl-md border-b-2 border-l-2 border-violet-400/50" />
        <span className="pointer-events-none absolute -bottom-2.5 -right-2.5 h-6 w-6 rounded-br-md border-b-2 border-r-2 border-violet-400/50" />

        <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-[#0D0B1E]/90 p-8 shadow-2xl shadow-violet-950/60 backdrop-blur-md">
          {/* Sweeping scan line */}
          <div className="sec-scan-line pointer-events-none absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-violet-400/70 to-transparent" />

          {/* Shield mark */}
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="sec-pulse mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-600 to-indigo-700">
              <ShieldCheck className="h-7 w-7 text-white" strokeWidth={1.75} />
            </div>
            <h1 className="text-[18px] font-bold tracking-tight">Addison Bill</h1>
            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.32em] text-violet-300/60">
              Secure Console Access
            </p>
          </div>

          {/* Channel status */}
          <div className="mb-6 flex flex-wrap items-center justify-center gap-1.5 font-mono text-[9px]">
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 uppercase tracking-[0.14em] text-emerald-400">
              <span className="sec-blink h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Secure channel
            </span>
            <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 uppercase tracking-[0.14em] text-violet-300">
              AES-256
            </span>
            <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 uppercase tracking-[0.14em] text-violet-300">
              TLS 1.3
            </span>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 font-mono text-[11px] leading-relaxed text-red-400">
                <span className="font-bold">ACCESS DENIED:</span> {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-violet-300/50">
                Operator ID
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-400/40" strokeWidth={1.75} />
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@addisonbill.com"
                  className="sec-input h-11 rounded-xl border-violet-500/20 bg-[#13102A] pl-10 text-[13px] text-white placeholder:text-violet-300/20 focus-visible:border-violet-400/60 focus-visible:ring-violet-500/25"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-violet-300/50">
                Passkey
              </Label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-400/40" strokeWidth={1.75} />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="sec-input h-11 rounded-xl border-violet-500/20 bg-[#13102A] pl-10 text-[13px] text-white placeholder:text-violet-300/20 focus-visible:border-violet-400/60 focus-visible:ring-violet-500/25"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="mt-1 h-11 w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-[13px] font-semibold text-white shadow-lg shadow-violet-900/50 transition-all hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-800/60 disabled:opacity-40"
              disabled={!email || !password || busy}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.75} />
                  Authenticating…
                </>
              ) : (
                <>
                  Authenticate
                  <ArrowRight className="ml-2 h-4 w-4" strokeWidth={2} />
                </>
              )}
            </Button>
          </form>

          {/* Terminal footer */}
          <div className="mt-6 space-y-2 border-t border-violet-500/10 pt-4">
            <p className="font-mono text-[10px] text-violet-300/40">
              <span className="text-emerald-400">➜</span> secure session ready
              <span className="sec-blink text-violet-300/70">_</span>
            </p>
            <p className="text-center font-mono text-[9px] uppercase tracking-[0.2em] text-violet-300/30">
              Restricted area · Authorised personnel only
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
