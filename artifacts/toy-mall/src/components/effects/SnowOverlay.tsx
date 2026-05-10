import { useMemo } from "react";
import { useTheme } from "@/hooks/use-theme";

const COUNT = 55;

interface Particle {
  left: number;       // 0-100 (%)
  size: number;       // px
  delay: number;      // s
  duration: number;   // s
  drift: number;      // px horizontal sway
  opacity: number;    // 0-1
}

/**
 * Subtle ambient snowfall that renders only in dark mode.
 * - Fixed full-viewport overlay
 * - pointer-events-none, z-index just above body bg, below sticky headers
 * - Pure CSS animation — single transform per particle, GPU-friendly
 * - Particles are memoised so they don't reshuffle on every re-render
 */
export function SnowOverlay() {
  const { isDark } = useTheme();

  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: COUNT }, () => ({
        left:     Math.random() * 100,
        size:     1 + Math.random() * 2.5,
        delay:    -Math.random() * 15,            // negative so they're mid-fall on mount
        duration: 9 + Math.random() * 10,
        drift:    (Math.random() - 0.5) * 60,
        opacity:  0.18 + Math.random() * 0.45,
      })),
    [],
  );

  if (!isDark) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
    >
      <style>{`
        @keyframes counter-snowfall {
          0%   { transform: translate3d(0, -10vh, 0); opacity: 0; }
          10%  { opacity: var(--opacity, 0.4); }
          90%  { opacity: var(--opacity, 0.4); }
          100% { transform: translate3d(var(--drift, 0px), 110vh, 0); opacity: 0; }
        }
      `}</style>
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.6)]"
          style={{
            left:                `${p.left}%`,
            width:               `${p.size}px`,
            height:              `${p.size}px`,
            animation:           `counter-snowfall ${p.duration}s linear ${p.delay}s infinite`,
            ['--drift' as never]:   `${p.drift}px`,
            ['--opacity' as never]: p.opacity,
            willChange:          "transform, opacity",
          }}
        />
      ))}
    </div>
  );
}
