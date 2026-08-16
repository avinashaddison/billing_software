/**
 * Settings → API Access — owner-only management of public API keys.
 *
 * Keys let external software read (or write) this shop's data via /api/v1.
 * The raw key is shown exactly ONCE after creation (reveal dialog with a
 * copy button); afterwards only the prefix is visible. Revoking is final.
 *
 * Load failures show an explicit error screen with retry — never an empty
 * list, so a network hiccup can't masquerade as "all keys deleted".
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  KeyRound, Plus, Copy, Check, BookOpen, ArrowLeft, RefreshCw, AlertCircle, Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  scope: "read" | "write";
  createdBy: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

async function fetchKeys(): Promise<ApiKeyRow[]> {
  const r = await fetch(`${API}/api-keys`);
  if (!r.ok) throw new Error(`Could not load API keys (error ${r.status})`);
  return r.json();
}

/** Pull the server's plain-language message out of an error response. */
async function errorMessage(r: Response, fallback: string): Promise<string> {
  try {
    const body = await r.json();
    if (body && typeof body.error === "string") return body.error;
  } catch { /* non-JSON error page */ }
  return fallback;
}

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function ApiAccess() {
  const { role } = useAuth();
  const queryClient = useQueryClient();

  /* Create dialog */
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"read" | "write">("read");

  /* Reveal-once dialog */
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /* Revoke confirm — content derives from this row on every render */
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);

  const { data: keys, isLoading, error, refetch } = useQuery({
    queryKey: ["api-keys"],
    queryFn: fetchKeys,
    enabled: role === "owner",
  });

  const createKey = useMutation({
    mutationFn: async (input: { name: string; scope: "read" | "write" }) => {
      const r = await fetch(`${API}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!r.ok) throw new Error(await errorMessage(r, "Could not create the key"));
      return r.json() as Promise<{ key: string; apiKey: ApiKeyRow }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      setCreateOpen(false);
      setCopied(false);
      setRevealedKey(data.key);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeKey = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${API}/api-keys/${id}/revoke`, { method: "POST" });
      if (!r.ok) throw new Error(await errorMessage(r, "Could not revoke the key"));
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      setRevokeTarget(null);
      toast.success("Key revoked. It stops working immediately.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyKey = async () => {
    if (!revealedKey) return;
    try {
      await navigator.clipboard.writeText(revealedKey);
      setCopied(true);
      toast.success("Key copied");
    } catch {
      toast.error("Could not copy — select the key text and copy it manually");
    }
  };

  /* Owner gate (the server enforces this too — this is just a kind screen) */
  if (role !== "owner") {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 text-center px-6">
        <div className="text-5xl">🔒</div>
        <div>
          <p className="text-xl font-black text-foreground">Owner only</p>
          <p className="text-sm text-muted-foreground mt-1">
            API keys give outside software access to shop data,<br />
            so only the owner can manage them.
          </p>
        </div>
      </div>
    );
  }

  const activeKeys  = (keys ?? []).filter((k) => !k.revokedAt);
  const revokedKeys = (keys ?? []).filter((k) => k.revokedAt);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon" data-testid="button-back-settings">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-black flex items-center gap-2">
            <KeyRound className="w-5 h-5" /> API Access
          </h1>
          <p className="text-xs text-muted-foreground">
            Let other software connect to your shop's data
          </p>
        </div>
        <Button onClick={() => { setName(""); setScope("read"); setCreateOpen(true); }} data-testid="button-new-key">
          <Plus className="w-4 h-4 mr-1" /> New key
        </Button>
      </div>

      {/* What is this */}
      <div className="bg-card border rounded-2xl p-4 space-y-2">
        <p className="text-sm">
          An API key works like a password for programs: an inventory tool, a website,
          or a spreadsheet script can use it to read your products, stock and bills —
          and, with a <span className="font-bold">read &amp; write</span> key, update them too.
        </p>
        <Link href="/developers">
          <Button variant="outline" size="sm" data-testid="link-developers">
            <BookOpen className="w-4 h-4 mr-2" /> Open the API reference
          </Button>
        </Link>
      </div>

      {/* Load states */}
      {isLoading && (
        <div className="bg-card border rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Loading your keys…
        </div>
      )}

      {error != null && (
        <div className="bg-card border border-destructive/40 rounded-2xl p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <div>
            <p className="font-bold">Couldn't load your API keys</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your keys are safe — this is only a loading problem.
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} data-testid="button-retry-keys">
            <RefreshCw className="w-4 h-4 mr-2" /> Try again
          </Button>
        </div>
      )}

      {/* Active keys */}
      {keys && (
        <div className="space-y-3">
          {activeKeys.length === 0 && (
            <div className="bg-card border rounded-2xl p-8 text-center space-y-1">
              <KeyRound className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="font-bold">No API keys yet</p>
              <p className="text-sm text-muted-foreground">
                Create one to connect outside software to your shop.
              </p>
            </div>
          )}

          {activeKeys.map((k) => (
            <div key={k.id} className="bg-card border rounded-2xl p-4 flex items-start gap-3" data-testid={`row-key-${k.id}`}>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold truncate">{k.name}</p>
                  <span
                    className={
                      "text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full " +
                      (k.scope === "write"
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400")
                    }
                  >
                    {k.scope === "write" ? "read & write" : "read only"}
                  </span>
                </div>
                <p className="font-mono text-xs text-muted-foreground">{k.keyPrefix}…</p>
                <p className="text-xs text-muted-foreground">
                  Created {fmtDate(k.createdAt)}
                  {k.createdBy ? ` by ${k.createdBy}` : ""} ·{" "}
                  {k.lastUsedAt ? `last used ${fmtDate(k.lastUsedAt)}` : "never used"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setRevokeTarget(k)}
                data-testid={`button-revoke-${k.id}`}
              >
                <Ban className="w-4 h-4 mr-1" /> Revoke
              </Button>
            </div>
          ))}

          {/* Revoked history */}
          {revokedKeys.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground pt-2">
                Revoked keys
              </p>
              {revokedKeys.map((k) => (
                <div key={k.id} className="bg-muted/40 border rounded-2xl p-3 opacity-70">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm line-through">{k.name}</p>
                    <span className="font-mono text-xs text-muted-foreground">{k.keyPrefix}…</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Revoked {k.revokedAt ? fmtDate(k.revokedAt) : ""} · created {fmtDate(k.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Create dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New API key</DialogTitle>
            <DialogDescription>
              Name it after the software that will use it, so you know what to revoke later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">Key name</Label>
              <Input
                id="key-name"
                placeholder="e.g. Website sync"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                data-testid="input-key-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Permission</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScope("read")}
                  className={
                    "border rounded-xl p-3 text-left transition-colors " +
                    (scope === "read" ? "border-primary bg-primary/5" : "hover:bg-muted/50")
                  }
                  data-testid="button-scope-read"
                >
                  <p className="font-bold text-sm">Read only</p>
                  <p className="text-xs text-muted-foreground">View products, stock, suppliers, bills</p>
                </button>
                <button
                  type="button"
                  onClick={() => setScope("write")}
                  className={
                    "border rounded-xl p-3 text-left transition-colors " +
                    (scope === "write" ? "border-primary bg-primary/5" : "hover:bg-muted/50")
                  }
                  data-testid="button-scope-write"
                >
                  <p className="font-bold text-sm">Read &amp; write</p>
                  <p className="text-xs text-muted-foreground">Also add products, update stock &amp; suppliers</p>
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createKey.mutate({ name: name.trim(), scope })}
              disabled={!name.trim() || createKey.isPending}
              data-testid="button-create-key"
            >
              {createKey.isPending ? "Creating…" : "Create key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reveal-once dialog ── */}
      <Dialog
        open={revealedKey !== null}
        onOpenChange={(open) => { if (!open) { setRevealedKey(null); setCopied(false); } }}
      >
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Your new API key</DialogTitle>
            <DialogDescription>
              Copy it now and store it somewhere safe — for security, it can never be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted rounded-xl p-3 font-mono text-xs break-all select-all" data-testid="text-revealed-key">
              {revealedKey}
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400">
              If you lose it, revoke this key and create a new one.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={copyKey} data-testid="button-copy-key">
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? "Copied" : "Copy key"}
            </Button>
            <Button onClick={() => { setRevealedKey(null); setCopied(false); }} data-testid="button-key-saved">
              I've saved it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Revoke confirm ── */}
      <Dialog open={revokeTarget !== null} onOpenChange={(open) => { if (!open) setRevokeTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke "{revokeTarget?.name}"?</DialogTitle>
            <DialogDescription>
              Any software using this key stops working immediately. This cannot be undone —
              you'd create a new key instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => revokeTarget && revokeKey.mutate(revokeTarget.id)}
              disabled={revokeKey.isPending}
              data-testid="button-confirm-revoke"
            >
              {revokeKey.isPending ? "Revoking…" : "Revoke key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
