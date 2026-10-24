export function ProductCredit() {
  return (
    <div
      data-testid="text-product-credit"
      className="group relative mt-1 flex items-center gap-2.5 overflow-hidden rounded-xl border border-amber-600/25 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent px-2.5 py-2 transition-colors duration-300 hover:border-amber-600/45 dark:border-amber-400/25 dark:hover:border-amber-400/50"
    >
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-[13px] font-black leading-none text-white shadow-sm ring-1 ring-white/20 transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3"
      >
        A<span className="text-[9px] align-top opacity-90">x</span>
      </span>
      <div className="min-w-0 leading-none">
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          A product by
        </p>
        <p className="truncate text-[12px] font-black tracking-tight text-amber-700 transition-colors duration-300 group-hover:text-orange-600 dark:text-amber-300 dark:group-hover:text-amber-200">
          AddisonX Media
        </p>
      </div>
    </div>
  );
}
