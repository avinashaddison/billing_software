import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ticket, Copy, Plus, Loader2, RefreshCw } from "lucide-react";
import {
  useListCoupons,
  useCreateCoupon,
  useUpdateCoupon,
  getListCouponsQueryKey,
  type Coupon,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";

type Status = "active" | "disabled" | "expired" | "exhausted";
const statusOf = (c: Coupon): Status =>
  !c.isActive
    ? "disabled"
    : c.expiresAt && new Date(c.expiresAt).getTime() <= Date.now()
      ? "expired"
      : c.remainingUses <= 0
        ? "exhausted"
        : "active";
const STATUS_CLS: Record<Status, string> = {
  active:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  disabled: "bg-muted text-muted-foreground",
  expired:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  exhausted: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};
const fmtDate = (s: string) =>
  new Date(s).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }) + " IST";
const errMsg = (e: unknown, fb: string) => (e as Error)?.message || fb;

export default function Coupons() {
  const { role } = useAuth();
  const isOwner = role === "owner";
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch, isFetching } = useListCoupons({
    query: {
      enabled: isOwner,
      refetchInterval: 30_000,
      retry: false,
      queryKey: getListCouponsQueryKey(),
    },
  });
  const create = useCreateCoupon();
  const update = useUpdateCoupon();

  const [type, setType] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiry, setExpiry] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [created, setCreated] = useState<Coupon | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  if (!isOwner) {
    return (
      <div className="p-6 text-center" data-testid="access-restricted">
        <p className="text-xl font-black">Owner only</p>
        <p className="text-sm text-muted-foreground mt-1">
          Coupons can only be managed by an owner.
        </p>
      </div>
    );
  }

  const copy = async (code: string) => {
    try {
      if (!navigator.clipboard) throw new Error("unavailable");
      await navigator.clipboard.writeText(code);
      toast.success("Code copied");
    } catch {
      toast.error("Could not copy. Select the code and copy it manually.");
    }
  };

  const submit = async () => {
    setFormErr(null);
    const v = Number(value);
    const m = Number(maxUses);
    if (!value.trim() || !Number.isFinite(v) || v <= 0)
      return setFormErr("Enter a discount value above 0.");
    if (!/^\d+(\.\d{1,2})?$/.test(value.trim()))
      return setFormErr("Discount value can have at most 2 decimals.");
    if (type === "percent" && v > 100)
      return setFormErr("Percent discount cannot exceed 100.");
    if (!Number.isInteger(m) || m < 1 || m > 1_000_000)
      return setFormErr(
        "Maximum uses must be a whole number from 1 to 1,000,000.",
      );
    let expiresAt: string | null = null;
    if (expiry) {
      const d = new Date(`${expiry}:00+05:30`);
      if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now())
        return setFormErr("Expiry must be in the future.");
      expiresAt = d.toISOString();
    }
    try {
      const c = await create.mutateAsync({
        data: { discountType: type, discountValue: v, maxUses: m, expiresAt },
      });
      setCreated(c);
      setValue("");
      setMaxUses("");
      setExpiry("");
      toast.success("Coupon created");
      await qc.invalidateQueries({ queryKey: getListCouponsQueryKey() });
    } catch (e) {
      setFormErr(errMsg(e, "Could not create coupon"));
    }
  };

  const toggle = async (c: Coupon) => {
    setTogglingId(c.id);
    try {
      await update.mutateAsync({ id: c.id, data: { isActive: !c.isActive } });
      await qc.invalidateQueries({ queryKey: getListCouponsQueryKey() });
      toast.success(c.isActive ? "Coupon disabled" : "Coupon re-enabled");
    } catch (e) {
      toast.error(errMsg(e, "Could not update coupon"));
    } finally {
      setTogglingId(null);
    }
  };

  const inputCls =
    "w-full h-11 px-3 rounded-xl bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40";
  const labelCls =
    "text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block";
  const coupons = data ?? [];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black flex items-center gap-2">
          <Ticket className="w-6 h-6 text-amber-500" /> Coupons
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Each code has a total use limit and works once per customer mobile
          number. Refunds and deleted bills do not give uses back.
        </p>
      </div>

      <section className="rounded-2xl border bg-card p-4 space-y-4">
        <p className="font-bold text-sm">Generate a coupon</p>
        <div className="grid grid-cols-2 gap-2">
          {(["percent", "amount"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              data-testid={`button-type-${t}`}
              className={`p-3 rounded-xl border-2 text-sm font-bold ${type === t ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}
            >
              {t === "percent" ? "Percent off" : "Rupees off"}
            </button>
          ))}
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label htmlFor="cp-value" className={labelCls}>
              {type === "percent" ? "Percent (max 100)" : "Amount (₹)"}
            </label>
            <input
              id="cp-value"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              data-testid="input-coupon-value"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="cp-max" className={labelCls}>
              Maximum total uses
            </label>
            <input
              id="cp-max"
              type="number"
              min={1}
              max={1000000}
              step={1}
              inputMode="numeric"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              data-testid="input-coupon-max-uses"
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="cp-exp" className={labelCls}>
              Expires (IST, optional)
            </label>
            <input
              id="cp-exp"
              type="datetime-local"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              data-testid="input-coupon-expiry"
              className={inputCls}
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          The code is generated by the server. Terms cannot be edited later; a
          coupon can only be disabled or re-enabled.
        </p>
        {formErr && (
          <p
            role="alert"
            className="text-xs font-semibold text-rose-600 dark:text-rose-400"
            data-testid="text-coupon-form-error"
          >
            {formErr}
          </p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={create.isPending}
          data-testid="button-create-coupon"
          className="h-11 px-5 rounded-xl bg-amber-500 text-white font-black text-sm flex items-center gap-2 disabled:opacity-50"
        >
          {create.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}{" "}
          Generate coupon
        </button>
        {created && (
          <div
            className="rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 p-3 flex items-center justify-between gap-3"
            data-testid="panel-created-coupon"
          >
            <div>
              <p className="text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                New code
              </p>
              <p className="font-mono font-black text-lg tracking-wider">
                {created.code}
              </p>
            </div>
            <button
              type="button"
              onClick={() => copy(created.code)}
              className="h-9 px-3 rounded-lg border text-xs font-bold flex items-center gap-1 bg-card"
            >
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            All coupons ({coupons.length})
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            aria-label="Refresh coupons"
            className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`}
            />
          </button>
        </div>
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
          ))
        ) : isError ? (
          <div
            className="rounded-2xl border bg-card p-8 text-center space-y-2"
            data-testid="state-coupons-error"
          >
            <p className="font-bold">{data ? "Couldn't refresh coupons. Usage counts may be out of date." : "Couldn't load coupons"}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="h-9 px-4 rounded-xl border text-sm font-bold"
              data-testid="button-retry-coupons"
            >
              Retry
            </button>
          </div>
        ) : coupons.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed bg-muted/30 p-10 text-center"
            data-testid="state-coupons-empty"
          >
            <Ticket className="w-8 h-8 mx-auto text-muted-foreground/40" />
            <p className="font-bold text-muted-foreground mt-2">
              No coupons yet
            </p>
            <p className="text-sm text-muted-foreground/70">
              Generate one above to offer a discount at checkout.
            </p>
          </div>
        ) : (
          coupons.map((c) => {
            const st = statusOf(c);
            return (
              <div
                key={c.id}
                className="rounded-2xl border bg-card p-4 flex flex-wrap items-center gap-3"
                data-testid={`row-coupon-${c.id}`}
              >
                <div className="flex-1 min-w-[180px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-black tracking-wider">
                      {c.code}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${STATUS_CLS[st]}`}
                      data-testid={`status-coupon-${c.id}`}
                    >
                      {st}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.discountType === "percent"
                      ? `${c.discountValue}% off`
                      : `₹${c.discountValue.toLocaleString("en-IN")} off`}
                    {" · "}
                    {c.usedCount} used · {c.remainingUses} remaining of{" "}
                    {c.maxUses}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {c.expiresAt
                      ? `Expires ${fmtDate(c.expiresAt)}`
                      : "No expiry"}{" "}
                    · Created {fmtDate(c.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copy(c.code)}
                  aria-label={`Copy ${c.code}`}
                  data-testid={`button-copy-${c.id}`}
                  className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => toggle(c)}
                  disabled={togglingId === c.id}
                  data-testid={`button-toggle-${c.id}`}
                  className="h-9 px-3 rounded-lg border text-xs font-bold disabled:opacity-50 flex items-center gap-1"
                >
                  {togglingId === c.id && (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  )}
                  {c.isActive ? "Disable" : "Re-enable"}
                </button>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
