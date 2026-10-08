export function paymentTypeLabel(method?: string | null): string {
  const value = method?.trim().toLowerCase();
  if (!value) return "Not recorded";
  if (value === "cash") return "Cash";
  if (value === "upi" || value === "online") return "Online / UPI";
  if (value === "credit") return "Credit";
  if (value === "card") return "Card";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function PaymentTypeBadge({ method }: { method?: string | null }) {
  const label = paymentTypeLabel(method);
  const color = label === "Cash"
    ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400"
    : label === "Online / UPI"
      ? "bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-400"
      : "bg-muted text-muted-foreground";

  return (
    <span
      data-testid="billing-payment-type"
      aria-label={`Payment type: ${label}`}
      className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${color}`}
    >
      {label}
    </span>
  );
}
