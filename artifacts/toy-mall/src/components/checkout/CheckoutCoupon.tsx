import { useEffect, useRef, useState } from "react";
import { Ticket, Loader2, X } from "lucide-react";
import {
  usePreviewCoupon,
  type CouponPreview,
} from "@workspace/api-client-react";

export type AppliedCoupon = CouponPreview;

interface Props {
  subtotal: number;
  customerPhone: string;
  isOnline: boolean;
  enabled: boolean;
  manualDiscount: number;
  applied: AppliedCoupon | null;
  onChange: (quote: AppliedCoupon | null) => void;
}

const inr = (n: number) =>
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function CheckoutCoupon({
  subtotal,
  customerPhone,
  isOnline,
  enabled,
  manualDiscount,
  applied,
  onChange,
}: Props) {
  const preview = usePreviewCoupon();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const gen = useRef(0);
  useEffect(
    () => () => {
      gen.current += 1;
    },
    [],
  );
  const contextKey = JSON.stringify([
    code,
    customerPhone,
    subtotal,
    enabled,
    isOnline,
    manualDiscount,
  ]);
  const contextRef = useRef(contextKey);
  contextRef.current = contextKey;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const previewRef = useRef(preview.mutateAsync);
  previewRef.current = preview.mutateAsync;

  /* Any input change invalidates an in-flight preview. */
  useEffect(() => {
    gen.current += 1;
    setBusy(false);
  }, [code, customerPhone, subtotal, enabled, isOnline, manualDiscount]);

  useEffect(() => {
    if (applied && !code) setCode(applied.code);
  }, [applied, code]);

  const phoneOk = /^[0-9]{10}$/.test(customerPhone);
  const subtotalOk = Number.isFinite(subtotal) && subtotal > 0;
  const trimmed = code.trim().toUpperCase();
  const stale =
    !!applied &&
    (applied.customerPhone !== customerPhone ||
      Math.abs(applied.subtotal - subtotal) > 0.004);

  let hint: string | null = null;
  if (!enabled) hint = "Coupons are not available for supplier payments.";
  else if (!isOnline) hint = "Coupons need an internet connection.";
  else if (manualDiscount > 0)
    hint = "Clear the bill discount to use a coupon. They cannot be combined.";
  else if (!phoneOk)
    hint = "Enter the customer's 10-digit mobile number first.";
  else if (!subtotalOk) hint = "Add items to the bill first.";
  const blocked = hint !== null;

  const apply = async () => {
    if (blocked || !trimmed || busy) return;
    const token = ++gen.current;
    const requestContext = contextRef.current;
    setBusy(true);
    setError(null);
    try {
      const quote = await previewRef.current({
        data: { code: trimmed, customerPhone, subtotal },
      });
      if (token !== gen.current || requestContext !== contextRef.current)
        return;
      setBusy(false);
      onChangeRef.current(quote);
    } catch (e) {
      if (token !== gen.current || requestContext !== contextRef.current)
        return;
      setBusy(false);
      setError((e as Error)?.message || "Could not apply this coupon");
    }
  };

  const remove = () => {
    gen.current += 1;
    setBusy(false);
    setError(null);
    setCode("");
    onChangeRef.current(null);
  };

  return (
    <div
      className="rounded-2xl border bg-card px-4 py-3 space-y-2"
      data-testid="checkout-coupon"
    >
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        <Ticket className="w-3.5 h-3.5" /> Coupon
      </div>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => {
            gen.current += 1;
            setBusy(false);
            setCode(e.target.value.toUpperCase());
            setError(null);
            if (applied) onChangeRef.current(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && apply()}
          disabled={blocked && !applied}
          placeholder="Coupon code"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-label="Coupon code"
          data-testid="input-coupon-code"
          className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-muted border border-border font-mono text-sm tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-amber-400/40 disabled:opacity-50"
        />
        {applied && !stale ? (
          <button
            type="button"
            onClick={remove}
            data-testid="button-coupon-remove"
            className="h-10 px-3 rounded-xl border text-xs font-bold flex items-center gap-1 hover:bg-muted"
          >
            <X className="w-3.5 h-3.5" /> Remove
          </button>
        ) : (
          <button
            type="button"
            onClick={apply}
            disabled={blocked || !trimmed || busy}
            data-testid="button-coupon-apply"
            className="h-10 px-4 rounded-xl bg-amber-500 text-white text-xs font-black flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {stale ? "Apply again" : "Apply"}
          </button>
        )}
      </div>
      {applied && stale && (
        <div
          className="flex items-center justify-between gap-2 text-xs"
          data-testid="status-coupon-stale"
        >
          <p className="font-bold text-amber-700 dark:text-amber-300">
            Needs reapply — the bill or mobile number changed since{" "}
            {applied.code} was checked.
          </p>
          <button
            type="button"
            onClick={remove}
            className="underline text-muted-foreground shrink-0"
          >
            Remove
          </button>
        </div>
      )}
      {applied && !stale && (
        <p
          className="text-xs font-bold text-emerald-700 dark:text-emerald-400"
          data-testid="status-coupon-applied"
        >
          {applied.code} applied:{" "}
          {applied.discountType === "percent"
            ? `${applied.discountValue}% off`
            : `₹${inr(applied.discountValue)} off`}{" "}
          (-₹{inr(applied.discountAmount)})
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="text-xs font-semibold text-rose-600 dark:text-rose-400"
          data-testid="text-coupon-error"
        >
          {error}
        </p>
      )}
      {hint && !applied && (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      )}
      {hint && applied && (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
