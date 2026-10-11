import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Archive, ArchiveRestore, Loader2, Plus, Search, Info, PencilLine, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { balanceLabel, dailyBookApi, rupees, type KhataAccount, type KhataEntry } from "@/lib/daily-book-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { QueryGate, Empty, useAccounts, useEntries, useDb, inputCls, fmtDate } from "./shared";
import { RecordMoneyDialog, CorrectDialog } from "./MoneyDialogs";

const tone = (b: string) => (BigInt(b) > 0n ? "text-emerald-600 dark:text-emerald-400" : BigInt(b) < 0n ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground");

function Balance({ paise, big }: { paise: string; big?: boolean }) {
  return (
    <div className="text-right">
      <p className={`font-black tabular-nums ${big ? "text-2xl" : "text-sm"} ${tone(paise)}`}>{rupees(paise)}</p>
      <p className={`text-[10px] font-black uppercase tracking-wider ${tone(paise)}`}>{balanceLabel(paise)}</p>
    </div>
  );
}

export function MoneyPanel() {
  const q = useAccounts();
  const { run, blocked, busy, recovered } = useDb();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState("");
  const [recording, setRecording] = useState(false);
  const [correcting, setCorrecting] = useState<KhataEntry | null>(null);
  const [archiveAsk, setArchiveAsk] = useState(false);
  useEffect(() => { setRecording(false); setCorrecting(null); setArchiveAsk(false); setName(""); }, [recovered]);

  const accounts = q.data?.accounts;
  const list = useMemo(() => (accounts ?? []).filter((a) => a.archived === showArchived && a.name.toLowerCase().includes(search.trim().toLowerCase())), [accounts, showArchived, search]);
  const selected = (accounts ?? []).find((a) => a.id === selectedId) ?? null;

  const create = async () => {
    const n = name.trim();
    if (!n) { toast.error("Enter a name."); return; }
    if (n.length > 80) { toast.error("Name is too long."); return; }
    if (await run(() => dailyBookApi.createAccount(n), "Account created")) setName("");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-sky-500/5 border border-border p-3 flex gap-2 text-xs text-muted-foreground">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>Khata is for advances, loans and settlements with people. It is not expenses, sales or profit. If you receive money first, it means you owe them.</p>
      </div>

      <QueryGate q={q} what="accounts">
        {(d) => (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl p-3 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md" data-testid="card-receivable">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">To receive</p>
                <p className="text-xl font-black tabular-nums mt-1">{rupees(d.receivablePaise)}</p>
              </div>
              <div className="rounded-2xl p-3 bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-md" data-testid="card-payable">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">To pay</p>
                <p className="text-xl font-black tabular-nums mt-1">{rupees(d.payablePaise)}</p>
              </div>
            </div>

            <div className="grid lg:grid-cols-[340px_1fr] gap-4 items-start">
              <div className={`space-y-2 ${selected ? "hidden lg:block" : ""}`}>
                <div className="flex gap-2">
                  <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void create()} placeholder="New account name" className={inputCls} data-testid="input-account-name" />
                  <button type="button" onClick={() => void create()} disabled={blocked} aria-label="Create account" data-testid="button-create-account"
                    className="w-11 h-11 shrink-0 rounded-xl bg-emerald-600 text-white flex items-center justify-center disabled:opacity-50 active:scale-95 transition-transform">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-5 h-5" />}</button>
                </div>
                <div className="relative"><Search className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search accounts" className={`${inputCls} pl-9`} data-testid="input-search-accounts" /></div>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted/70 text-xs font-black">
                  {([false, true] as const).map((a) => (
                    <button key={String(a)} type="button" onClick={() => setShowArchived(a)} data-testid={a ? "tab-archived" : "tab-active"}
                      className={`h-9 rounded-lg ${showArchived === a ? "bg-card shadow" : "text-muted-foreground"}`}>{a ? "Archived" : "Active"}</button>
                  ))}
                </div>
                {list.length === 0 ? <Empty tone="emerald" title={search ? "No account matches" : showArchived ? "No archived accounts" : "No accounts yet"} hint={search ? "Try another name." : showArchived ? "Settled accounts you archive appear here." : "Add the first person above."} /> : (
                  <ul className="space-y-1.5">
                    {list.map((a) => (
                      <li key={a.id}>
                        <button type="button" onClick={() => setSelectedId(a.id)} data-testid={`row-account-${a.id}`}
                          className={`w-full rounded-2xl border bg-card p-3 flex items-center gap-2 text-left transition-all active:scale-[0.98] animate-in fade-in ${selectedId === a.id ? "ring-2 ring-emerald-500" : "hover:bg-muted/40"}`}>
                          <span className="flex-1 min-w-0 font-black text-sm truncate">{a.name}</span>
                          <Balance paise={a.balancePaise} /><ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className={selected ? "" : "hidden lg:block"}>
                {selected ? (
                  <AccountDetail key={selected.id} account={selected} onBack={() => setSelectedId(null)}
                    onRecord={() => setRecording(true)} onCorrect={setCorrecting}
                    onArchive={() => (selected.archived ? void run(() => dailyBookApi.archiveAccount(selected.id, false), "Account restored") : setArchiveAsk(true))} />
                ) : <Empty tone="emerald" title="Pick an account" hint="Its balance and history show here." />}
              </div>
            </div>
          </>
        )}
      </QueryGate>

      {recording && selected && <RecordMoneyDialog key={selected.id} account={selected} onClose={() => setRecording(false)} />}
      {correcting && selected && <CorrectDialog key={correcting.id} account={selected} entry={correcting} onClose={() => setCorrecting(null)} />}
      {archiveAsk && selected && (
        <Dialog open onOpenChange={(o) => { if (!o) setArchiveAsk(false); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Archive {selected.name}?</DialogTitle>
              <DialogDescription>Only a settled account can be archived. You can restore it any time.</DialogDescription></DialogHeader>
            <button type="button" disabled={blocked} data-testid="button-confirm-archive"
              onClick={async () => { if (await run(() => dailyBookApi.archiveAccount(selected.id, true), "Account archived")) { setArchiveAsk(false); setSelectedId(null); } }}
              className="h-11 rounded-xl bg-rose-600 text-white font-black text-sm disabled:opacity-50">Archive</button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function AccountDetail({ account, onBack, onRecord, onCorrect, onArchive }: {
  account: KhataAccount; onBack: () => void; onRecord: () => void; onCorrect: (e: KhataEntry) => void; onArchive: () => void;
}) {
  const q = useEntries(account.id);
  const { blocked } = useDb();
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const settled = BigInt(account.balancePaise) === 0n;
  const jump = (id: string) => {
    setFlash(id);
    document.getElementById(`entry-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setFlash(null), 1800);
  };
  return (
    <div className="space-y-3">
      <div className="rounded-3xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} aria-label="Back" className="lg:hidden w-9 h-9 rounded-xl bg-muted flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></button>
          <h2 className="flex-1 min-w-0 font-black text-lg truncate" data-testid="text-account-name">{account.name}</h2>
          <Balance paise={account.balancePaise} big />
        </div>
        <div className="flex gap-2">
          {!account.archived && <button type="button" onClick={onRecord} disabled={blocked} data-testid="button-record-money"
            className="flex-1 h-11 rounded-xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform"><Plus className="w-4 h-4" /> Record money</button>}
          <button type="button" onClick={onArchive} disabled={blocked || (!account.archived && !settled)} data-testid="button-toggle-archive-account"
            title={!account.archived && !settled ? "Settle the balance to zero first" : undefined}
            className="h-11 px-4 rounded-xl border font-bold text-sm flex items-center gap-2 disabled:opacity-50">
            {account.archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}{account.archived ? "Restore" : "Archive"}</button>
        </div>
        {!account.archived && !settled && <p className="text-[11px] text-muted-foreground">Archive unlocks when the balance is settled.</p>}
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search history" className={`${inputCls} pl-9`} data-testid="input-search-entries" /></div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} w-40`} aria-label="Search by date" data-testid="input-search-entry-date" />
      </div>
      <QueryGate q={q} what="history">
        {(entries) => {
          const t = text.trim().toLowerCase();
          const rows = entries.filter((e) => (!date || e.entryDate === date) && (!t || `${e.note} ${e.method} ${e.direction} ${e.voidReason ?? ""} ${rupees(e.amountPaise)}`.toLowerCase().includes(t)))
            .sort((a, b) => b.entryDate.localeCompare(a.entryDate) || b.createdAt.localeCompare(a.createdAt));
          if (rows.length === 0) return <Empty tone="emerald" title={entries.length ? "No entry matches" : "No entries yet"} hint={entries.length ? "Try another word or date." : "Record the first advance, loan or settlement."} />;
          return (
            <ul className="space-y-1.5">
              {rows.map((e) => {
                const given = e.direction === "given";
                const replacement = entries.find((x) => x.correctedFrom === e.id);
                const original = e.correctedFrom ? entries.find((x) => x.id === e.correctedFrom) : null;
                return (
                  <li key={e.id} id={`entry-${e.id}`} data-testid={`row-entry-${e.id}`}
                    className={`rounded-2xl border bg-card p-3 border-l-4 transition-shadow animate-in fade-in ${given ? "border-l-emerald-500" : "border-l-rose-500"} ${flash === e.id ? "ring-2 ring-amber-400" : ""} ${e.voidedAt ? "opacity-70" : ""}`}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`font-black tabular-nums ${e.voidedAt ? "line-through text-muted-foreground" : given ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                          {given ? "I gave " : "I received "}{rupees(e.amountPaise)}</p>
                        <p className="text-[11px] text-muted-foreground">{fmtDate(e.entryDate)} · {e.method === "upi" ? "UPI" : "Cash"}{e.note ? ` · ${e.note}` : ""}</p>
                      </div>
                      {!e.voidedAt && !account.archived && <button type="button" disabled={blocked} onClick={() => onCorrect(e)} data-testid={`button-correct-${e.id}`}
                        className="h-8 px-2.5 rounded-lg bg-muted text-[11px] font-black flex items-center gap-1 disabled:opacity-50"><PencilLine className="w-3 h-3" /> Correct</button>}
                    </div>
                    {e.voidedAt && (
                      <p className="mt-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">Voided: {e.voidReason}
                        {replacement && <> · <button type="button" className="underline" onClick={() => jump(replacement.id)} data-testid={`link-replacement-${e.id}`}>See replacement {rupees(replacement.amountPaise)}</button></>}</p>
                    )}
                    {original && <p className="mt-1.5 text-[11px] font-bold text-muted-foreground">Replaces <button type="button" className="underline" onClick={() => jump(original.id)}>earlier entry {rupees(original.amountPaise)}</button></p>}
                  </li>
                );
              })}
            </ul>
          );
        }}
      </QueryGate>
    </div>
  );
}
