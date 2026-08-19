import { useState, useEffect, useRef } from "react";
import { Clock, PauseCircle, PlayCircle, Trash2, X, Loader2, WifiOff, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { type HeldBill } from "@/hooks/use-held-bills";

export function HoldBillModal({
  onClose,
  onConfirm,
  isPending,
  isOnline,
}: {
  onClose: () => void;
  onConfirm: (name: string, note: string) => void;
  isPending: boolean;
  isOnline: boolean;
}) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const submittedRef = useRef(false);

  useEffect(() => { nameRef.current?.focus(); }, []);
  useEffect(() => {
    if (!isPending) submittedRef.current = false;
  }, [isPending]);

  const confirm = () => {
    if (submittedRef.current || isPending || !isOnline) return;
    submittedRef.current = true;
    onConfirm(name, note);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget && !isPending) onClose(); }}
    >
      <div className="w-full md:max-w-sm bg-card rounded-t-3xl md:rounded-3xl border shadow-2xl animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-250 overflow-hidden">
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="px-5 pt-4 pb-3 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-foreground flex items-center gap-2">
              <PauseCircle className="w-5 h-5 text-indigo-500" />
              Hold Bill
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Save current items and clear cart for next customer
            </p>
          </div>
          <button onClick={onClose} disabled={isPending} className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-all disabled:opacity-50">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">
              Customer Name (Optional)
            </label>
            <input
              ref={nameRef}
              type="text"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul"
              disabled={isPending || !isOnline}
              className="w-full h-11 px-3.5 rounded-xl bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400 transition-all disabled:opacity-50"
              onKeyDown={(e) => e.key === "Enter" && confirm()}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">
              Note (Optional)
            </label>
            <input
              type="text"
              maxLength={80}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Returning in 5 mins"
              disabled={isPending || !isOnline}
              className="w-full h-11 px-3.5 rounded-xl bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400 transition-all disabled:opacity-50"
              onKeyDown={(e) => e.key === "Enter" && confirm()}
            />
          </div>
        </div>

        {!isOnline && (
          <div className="mx-5 mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            <WifiOff className="h-4 w-4 shrink-0" />
            Reconnect to hold this bill
          </div>
        )}

        <div className="px-5 pb-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="py-3.5 rounded-2xl border border-border text-muted-foreground font-bold text-sm hover:bg-muted active:scale-95 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={isPending || !isOnline}
            className="py-3.5 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PauseCircle className="w-4 h-4" />}
            Hold Bill
          </button>
        </div>
      </div>
    </div>
  );
}

export function HeldBillsModal({
  onClose,
  bills,
  onResume,
  onDiscard,
  isLoading,
  isResuming,
  isDiscarding,
  activeCartCount,
  error,
  onRetry,
  isOnline
}: {
  onClose: () => void;
  bills: HeldBill[];
  onResume: (id: string) => void;
  onDiscard: (id: string) => void;
  isLoading: boolean;
  isResuming: boolean;
  isDiscarding: boolean;
  activeCartCount: number;
  error?: Error | null;
  onRetry?: () => void;
  isOnline: boolean;
}) {
  const [confirmDiscardId, setConfirmDiscardId] = useState<string | null>(null);
  const [confirmResumeId, setConfirmResumeId] = useState<string | null>(null);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget && !isResuming && !isDiscarding) onClose(); }}
    >
      <div className="w-full md:max-w-md bg-card rounded-t-3xl md:rounded-3xl border shadow-2xl animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-250 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="px-5 pt-4 pb-3 border-b flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-black text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" />
              Held Bills
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {bills.length} {bills.length === 1 ? "bill" : "bills"} on hold
            </p>
          </div>
          <button onClick={onClose} disabled={isResuming || isDiscarding} className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-all disabled:opacity-50 shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm font-bold">Loading held bills...</p>
            </div>
          ) : error ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-3 text-center">
              <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center border border-red-200 dark:border-red-900">
                <WifiOff className="w-8 h-8 text-red-500 opacity-80" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Failed to load bills</p>
                <p className="text-xs mt-1 max-w-[200px]">{error.message || "Could not connect to server"}</p>
              </div>
              <button onClick={onRetry} className="mt-2 px-4 py-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400 font-bold rounded-xl text-xs hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
                Retry
              </button>
            </div>
          ) : bills.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Clock className="w-8 h-8 opacity-50" />
              </div>
              <p className="text-sm font-bold">No bills on hold</p>
            </div>
          ) : (
            bills.map(bill => (
              <div key={bill.id} className="rounded-2xl border bg-card overflow-hidden">
                <div className="p-4 border-b bg-muted/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate">
                        {bill.customerName || "Walk-in Customer"}
                      </p>
                      {bill.note && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {bill.note}
                        </p>
                      )}
                      <p className="text-[11px] font-medium text-muted-foreground mt-1.5 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(bill.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-foreground">
                        ₹{bill.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {bill.itemCount} {bill.itemCount === 1 ? "item" : "items"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-card flex gap-2">
                  {confirmDiscardId === bill.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <button
                        onClick={() => setConfirmDiscardId(null)}
                        className="flex-1 py-2 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors"
                        disabled={isDiscarding || isResuming}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => onDiscard(bill.id)}
                        className="flex-1 py-2 text-xs font-black text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors flex items-center justify-center gap-1"
                        disabled={isDiscarding || isResuming || !isOnline}
                      >
                        {isDiscarding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        Confirm
                      </button>
                    </div>
                  ) : confirmResumeId === bill.id ? (
                    <div className="flex-1 flex flex-col gap-2">
                      <p className="text-xs font-bold text-amber-600 dark:text-amber-400 text-center px-2">
                        Active cart has items. Swap with this held bill?
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setConfirmResumeId(null)}
                          className="flex-1 py-2 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors"
                          disabled={isDiscarding || isResuming}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => onResume(bill.id)}
                          className="flex-1 py-2 text-xs font-black text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors flex items-center justify-center gap-1"
                          disabled={isDiscarding || isResuming || !isOnline}
                        >
                          {isResuming ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          Swap Cart
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          if (!isOnline) { toast.error("Cannot discard bill while offline"); return; }
                          setConfirmDiscardId(bill.id);
                        }}
                        className="px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors"
                        disabled={isDiscarding || isResuming || !isOnline}
                        title={!isOnline ? "Unavailable offline" : ""}
                      >
                        Discard
                      </button>
                      <button
                        onClick={() => {
                          if (!isOnline) { toast.error("Cannot resume bill while offline"); return; }
                          activeCartCount > 0 ? setConfirmResumeId(bill.id) : onResume(bill.id);
                        }}
                        className="flex-1 py-2 text-xs font-black text-white bg-indigo-500 hover:bg-indigo-600 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-500/20 disabled:opacity-50"
                        disabled={isDiscarding || isResuming || !isOnline}
                        title={!isOnline ? "Unavailable offline" : ""}
                      >
                        {isResuming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                        Resume Bill
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
