import { useEffect, useRef } from "react";

const SCANNER_THRESHOLD_MS = 60;
const IDLE_FIRE_MS = 200;
const MIN_CODE_LENGTH = 2;

/**
 * Detects USB keyboard-wedge barcode scanners (e.g. TVS BS-C101).
 *
 * A wedge scanner types all barcode characters very fast (< 60 ms apart)
 * and then sends an Enter keystroke.  This hook buffers those keystrokes in
 * the capture phase and fires `onScan` when:
 *   a) Enter is received and the buffer holds ≥ 2 chars, OR
 *   b) 200 ms of silence after a burst with ≥ 2 chars (Enter-less scanners).
 *
 * The hook ignores all keystrokes while a text input / textarea is focused so
 * normal keyboard usage is not affected.  During an active scanner burst it
 * calls stopPropagation() to prevent keyboard shortcuts (b/s mode-switch,
 * Enter checkout) from firing mid-scan.
 */
export function useUsbScanner(
  onScan: (code: string) => void,
  options?: { enabled?: boolean },
) {
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  const enabled = options?.enabled !== false;

  useEffect(() => {
    if (!enabled) return;

    let buffer    = "";
    let lastTime  = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
      if (timer !== null) { clearTimeout(timer); timer = null; }
    };

    const fire = (raw: string) => {
      const code = raw.trim().toUpperCase();
      if (code.length >= MIN_CODE_LENGTH) onScanRef.current(code);
    };

    const reset = () => {
      clearTimer();
      buffer   = "";
      lastTime = 0;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;

      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        reset();
        return;
      }

      const now     = Date.now();
      const elapsed = lastTime ? now - lastTime : Infinity;
      lastTime = now;

      if (e.key === "Enter") {
        const code = buffer.trim();
        reset();
        if (code.length >= MIN_CODE_LENGTH) {
          e.stopPropagation();
          e.preventDefault();
          fire(code);
        }
        return;
      }

      if (e.key.length !== 1) return;

      if (buffer.length === 0 || elapsed < SCANNER_THRESHOLD_MS) {
        buffer += e.key;

        if (buffer.length >= 2 && elapsed < SCANNER_THRESHOLD_MS) {
          e.stopPropagation();
        }

        clearTimer();
        timer = setTimeout(() => {
          const code = buffer;
          reset();
          fire(code);
        }, IDLE_FIRE_MS);
      } else {
        reset();
        buffer   = e.key;
        lastTime = now;
        timer    = setTimeout(() => { reset(); }, IDLE_FIRE_MS * 2);
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      clearTimer();
    };
  }, [enabled]);
}
