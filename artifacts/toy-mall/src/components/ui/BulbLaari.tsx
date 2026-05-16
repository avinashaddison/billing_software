/* ═════════════════════════════════════════════════════════════════
   Bulb Laari — festival lights string for the top of a hero/banner.

   • 22 bulbs cycle through 6 vivid colours (red/amber/yellow/green/
     blue/pink). Each runs its own fast blink with a staggered delay
     so the row appears to ripple, not pulse in unison — that "chase"
     effect a real Diwali storefront has.
   • SVG sagging wire across the top sells the "hung from the
     ceiling" look without a third-party lib.
   • Pure CSS, no JS frame loop → near-zero runtime cost.
   • Honours prefers-reduced-motion (steady glow, no strobe).
   • Owner can disable in Settings → Customization (reactive — no
     refresh needed, the Zustand subscription toggles render).

   Default placement is `absolute inset-x-0 top-0` — parent must be
   `relative`. Override via `className` if you need it elsewhere.
═══════════════════════════════════════════════════════════════════ */
import { cn } from "@/lib/utils";
import { useStoreSettings } from "@/lib/store-info";

const BULB_COLORS = ["#ef4444", "#f59e0b", "#eab308", "#22c55e", "#3b82f6", "#ec4899"];
const BULB_COUNT  = 22;

export function BulbLaari({ className }: { className?: string }) {
  /* Single-key subscription — re-renders only when the toggle flips, not
   * when unrelated settings (logo, tagline, etc.) change. */
  const enabled = useStoreSettings((s) => s.bulbLaariEnabled);
  if (!enabled) return null;

  const bulbs = Array.from({ length: BULB_COUNT }, (_, i) => ({
    color: BULB_COLORS[i % BULB_COLORS.length],
    delay: `${(i % 6) * 0.08}s`,
  }));

  return (
    <>
      <style>{`
        @keyframes laariBlink {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 10px 3px currentColor, 0 0 22px 6px currentColor; }
          50%      { opacity: 0.18; transform: scale(0.85); box-shadow: 0 0 3px 1px currentColor; }
        }
        .laari-bulb { animation: laariBlink 0.55s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .laari-bulb { animation: none; opacity: 0.9; box-shadow: 0 0 8px 2px currentColor; }
        }
      `}</style>

      {/* z-50 puts the lights above sticky page headers — those use z-10
       * commonly and would otherwise eat the laari on pages like Customers,
       * Report, Settings. Pointer-events-none so it never blocks clicks. */}
      <div aria-hidden className={cn("absolute inset-x-0 top-0 z-50 pointer-events-none select-none", className)}>
        {/* Sagging wire */}
        <svg viewBox="0 0 1200 24" preserveAspectRatio="none" className="w-full h-6">
          <path d="M0,2 Q300,18 600,8 T1200,4" stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" fill="none" />
        </svg>

        {/* Bulbs */}
        <div className="absolute inset-x-2 top-2 flex justify-between px-2">
          {bulbs.map((b, i) => (
            <span
              key={i}
              className="laari-bulb inline-block w-2 h-2 md:w-2.5 md:h-2.5 rounded-full"
              style={{ backgroundColor: b.color, color: b.color, animationDelay: b.delay }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
