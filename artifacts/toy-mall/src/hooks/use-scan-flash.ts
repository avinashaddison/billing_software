import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Returns a transient boolean that flips true when `flash()` is called,
 * then automatically resets after `durationMs`.  Call `clear()` to reset
 * it early (e.g. when navigation or an error replaces the indicator).
 */
export function useScanFlash(durationMs = 1500) {
  const [isFlashing, setIsFlashing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsFlashing(true);
    timerRef.current = setTimeout(() => setIsFlashing(false), durationMs);
  }, [durationMs]);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsFlashing(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { isFlashing, flash, clear };
}
