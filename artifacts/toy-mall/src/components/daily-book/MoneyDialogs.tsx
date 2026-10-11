import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { dailyBookApi, istToday, rupees, type KhataAccount, type KhataEntry, type MoneyInput } from "@/lib/daily-book-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useDb, inputCls, labelCls } from "./shared";

export function validateMoney(v: MoneyInput): string | null {
  const a = v.amount.trim();
  if (!/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/.test(a)) return "Enter a positive amount with at most 2 decimals.";
  const [r, p = ""] = a.split(".");
  const paise = BigInt(r) * 100n + BigInt(p.padEnd(2, "0"));
  if (paise <= 0n) return "Amount must be above zero.";
  if (paise > 1_00_00_000n * 100n) return "Amount cannot exceed 1,00,00,000.";
  if (!v.entryDate) return "Pick a date.";
  if (v.entryDate > istToday()) return "Date cannot be in the future.";
  return null;
}
export const paiseToInput = (p: string) => `${BigInt(p) / 100n}.${(BigInt(p) % 100n).toString().padStart(2, "0")}`;
const inputToPaise = (value: string) => {
  const [whole, fraction = ""] = value.trim().split(".");
  return (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"))).toString();
};

export function MoneyFields({ value, onChange }: { value: MoneyInput; onChange: (v: MoneyInput) => void }) {
  const set = (p: Partial<MoneyInput>) => onChange({ ...value, ...p });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {([["given", "I gave", "They owe me", "emerald"], ["received", "I received", "I owe them", "rose"]] as const).map(([d, l, s, c]) => (
          <button key={d} type="button" onClick={() => set({ direction: d })} data-testid={`button-direction-${d}`}
            className={`p-2.5 rounded-xl border-2 text-left transition-all ${value.direction === d
              ? c === "emerald" ? "border-emerald-500 bg-emerald-500/10" : "border-rose-500 bg-rose-500/10" : "border-border"}`}>
            <p className="text-sm font-black">{l}</p><p className="text-[10px] text-muted-foreground">{s}</p>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className={labelCls} htmlFor="m-amt">Amount (rupees)</label>
          <input id="m-amt" inputMode="decimal" value={value.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="0.00" className={inputCls} data-testid="input-money-amount" /></div>
        <div><label className={labelCls} htmlFor="m-date">Date</label>
          <input id="m-date" type="date" max={istToday()} value={value.entryDate} onChange={(e) => set({ entryDate: e.target.value })} className={inputCls} data-testid="input-money-date" /></div>
      </div>
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted/70 text-xs font-black">
        {(["cash", "upi"] as const).map((m) => (
          <button key={m} type="button" onClick={() => set({ method: m })} data-testid={`button-method-${m}`}
            className={`h-9 rounded-lg ${value.method === m ? "bg-card shadow" : "text-muted-foreground"}`}>{m === "cash" ? "Cash" : "UPI"}</button>
        ))}
      </div>
      <input value={value.note} maxLength={300} onChange={(e) => set({ note: e.target.value })} placeholder="Note (optional)" className={inputCls} data-testid="input-money-note" />
    </div>
  );
}

export function RecordMoneyDialog({ account, onClose }: { account: KhataAccount; onClose: () => void }) {
  const { run, blocked, busy } = useDb();
  const [v, setV] = useState<MoneyInput>({ direction: "given", amount: "", entryDate: istToday(), method: "cash", note: "" });
  const submit = async () => {
    const err = validateMoney(v);
    if (err) { toast.error(err); return; }
    if (await run(() => dailyBookApi.createEntry(account.id, { ...v, amount: v.amount.trim(), note: v.note.trim() }), "Money recorded")) onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record money with {account.name}</DialogTitle>
          <DialogDescription>Khata tracks advances, loans and settlements. It is not an expense, sale or profit record. If you receive money first, it means you owe them.</DialogDescription></DialogHeader>
        <MoneyFields value={v} onChange={setV} />
        <button type="button" onClick={() => void submit()} disabled={blocked} data-testid="button-save-money"
          className="h-11 rounded-xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Save entry</button>
      </DialogContent>
    </Dialog>
  );
}

export function CorrectDialog({ account, entry, onClose }: { account: KhataAccount; entry: KhataEntry; onClose: () => void }) {
  const { run, blocked, busy } = useDb();
  const [mode, setMode] = useState<"void" | "replace">("void");
  const [reason, setReason] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [v, setV] = useState<MoneyInput>({ direction: entry.direction, amount: paiseToInput(entry.amountPaise), entryDate: entry.entryDate, method: entry.method, note: entry.note });
  const next = () => {
    if (!reason.trim()) { toast.error("A reason is required."); return; }
    if (mode === "replace") { const e = validateMoney(v); if (e) { toast.error(e); return; } }
    setStep(2);
  };
  const confirm = async () => {
    const rep = mode === "replace" ? { ...v, amount: v.amount.trim(), note: v.note.trim() } : null;
    if (await run(() => dailyBookApi.correctEntry(account.id, entry.id, reason.trim(), rep), mode === "void" ? "Entry voided" : "Entry replaced")) onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Correct entry of {rupees(entry.amountPaise)}</DialogTitle>
          <DialogDescription>The original stays visible as voided. Nothing is deleted.</DialogDescription></DialogHeader>
        {step === 1 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {(["void", "replace"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)} data-testid={`button-mode-${m}`}
                  className={`p-2.5 rounded-xl border-2 text-sm font-black ${mode === m ? "border-amber-500 bg-amber-500/10" : "border-border"}`}>{m === "void" ? "Void only" : "Void and replace"}</button>
              ))}
            </div>
            {mode === "replace" && <MoneyFields value={v} onChange={setV} />}
            <div><label className={labelCls} htmlFor="c-reason">Reason (required)</label>
              <input id="c-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} data-testid="input-correct-reason" /></div>
            <button type="button" onClick={next} disabled={blocked} data-testid="button-correct-next" className="w-full h-11 rounded-xl bg-amber-500 text-white font-black text-sm disabled:opacity-50">Review</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-sm space-y-1">
              <p className="font-black">{mode === "void" ? "Void this entry?" : `Void it and record ${rupees(inputToPaise(v.amount))} (${v.direction}) instead?`}</p>
              <p className="text-xs text-muted-foreground">Reason: {reason.trim()}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setStep(1)} disabled={busy} className="h-11 rounded-xl border font-bold text-sm">Back</button>
              <button type="button" onClick={() => void confirm()} disabled={blocked} data-testid="button-correct-confirm"
                className="h-11 rounded-xl bg-rose-600 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Confirm</button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
