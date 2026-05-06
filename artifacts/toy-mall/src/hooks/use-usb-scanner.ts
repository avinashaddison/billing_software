import { useEffect, useRef, type RefObject } from "react";
import { STORE_INFO } from "@/lib/store-info";
import { addScanEvent } from "@/lib/scan-debug-log";

const IDLE_FIRE_MS = 50;          // fire just 50 ms after the last char — nearly instant
const MIN_CODE_LENGTH = 2;

export interface UsbScannerOptions {
  enabled?: boolean;
  /**
   * Override the inter-keystroke threshold (ms). When omitted the hook reads
   * the value from the persisted store setting (scannerThresholdMs).
   * Pass this explicitly to test a threshold before saving it.
   */
  thresholdMs?: number;
  /**
   * When the focused element is this input, the hook still captures the
   * scanner burst instead of falling back to the form.  On Enter the hook
   * fires onScan, prevents the default form submit, and calls onClear so
   * the controlled input can be reset by the caller.
   */
  allowedInput?: {
    ref: RefObject<HTMLInputElement | null>;
    onClear: () => void;
  };
  /**
   * When true, scan events are NOT recorded in the debug log.
   * Use this for test widgets to keep the log clean for real scans.
   */
  skipDebugLog?: boolean;
}

/**
 * Detects USB keyboard-wedge barcode scanners (e.g. TVS BS-C101).
 *
 * A wedge scanner types all chars very fast (< 60 ms apart) then sends Enter.
 * The hook buffers keystrokes in the document capture phase and fires `onScan`
 * when it sees that pattern, suppressing keyboard shortcuts during the burst.
 *
 * Behaviour by focus state
 * ─────────────────────────
 * • No element focused        → always captures, fires onScan
 * • Focused = allowedInput    → captures scanner burst, fires onScan + onClear,
 *                               prevents default form submit
 * • Focused = any other input → resets buffer, ignores (form handles it)
 */
export function useUsbScanner(
  onScan: (code: string) => void,
  options?: UsbScannerOptions,
) {
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  const optionsRef = useRef(options);
  useEffect(() => { optionsRef.current = options; }, [options]);

  const enabled = options?.enabled !== false;

  useEffect(() => {
    if (!enabled) return;

    let buffer     = "";
    let lastTime   = 0;
    let maxElapsed = 0;   // track worst inter-key gap within the current burst
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
      if (timer !== null) { clearTimeout(timer); timer = null; }
    };

    const reset = () => {
      clearTimer();
      buffer     = "";
      lastTime   = 0;
      maxElapsed = 0;
    };

    const dispatchScan = (upperCode: string, capturedMax: number, fromAllowedInput: boolean) => {
      if (!optionsRef.current?.skipDebugLog) {
        addScanEvent({ timestamp: new Date(), type: "detected", code: upperCode, maxElapsedMs: capturedMax });
      }
      if (fromAllowedInput) {
        optionsRef.current?.allowedInput?.onClear();
      }
      onScanRef.current(upperCode);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const allowed = optionsRef.current?.allowedInput;
      const isAllowedInput =
        allowed != null &&
        allowed.ref.current != null &&
        target === allowed.ref.current;

      const isOtherInput =
        !isAllowedInput &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (isOtherInput) {
        reset();
        return;
      }

      const now     = Date.now();
      const elapsed = lastTime ? now - lastTime : 0;
      lastTime = now;

      if (e.key === "Enter") {
        const code = buffer.trim();
        const fromAllowed = isAllowedInput;
        const capturedMax = maxElapsed;
        reset();
        if (code.length >= MIN_CODE_LENGTH) {
          e.stopPropagation();
          e.preventDefault();
          dispatchScan(code.toUpperCase(), capturedMax, fromAllowed);
        }
        return;
      }

      if (e.key.length !== 1) return;

      const threshold = optionsRef.current?.thresholdMs ?? STORE_INFO.scannerThresholdMs;

      if (buffer.length === 0 || elapsed < threshold) {
        if (elapsed > maxElapsed) maxElapsed = elapsed;
        buffer += e.key;
        // Stop ALL other keydown listeners from the very first char so that
        // single-key shortcuts (b/s mode-switch) can never fire mid-burst.
        e.stopPropagation();

        clearTimer();
        timer = setTimeout(() => {
          const code = buffer.trim().toUpperCase();
          const capturedMax = maxElapsed;
          const fromAllowed = isAllowedInput;
          reset();
          if (code.length >= MIN_CODE_LENGTH) {
            dispatchScan(code, capturedMax, fromAllowed);
          }
        }, IDLE_FIRE_MS);
      } else {
        // Too slow for a scanner — record as missed if buffer had enough chars
        if (buffer.length >= MIN_CODE_LENGTH && !optionsRef.current?.skipDebugLog) {
          addScanEvent({ timestamp: new Date(), type: "missed", maxElapsedMs: elapsed });
        }
        // Discard old buffer and start fresh
        reset();
        buffer   = e.key;
        lastTime = now;
        e.stopPropagation(); // stop even the first char of a fresh sequence
        timer = setTimeout(() => { reset(); }, IDLE_FIRE_MS * 2);
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      clearTimer();
    };
  }, [enabled]);
}
