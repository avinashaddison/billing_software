import { useEffect, useRef, type RefObject } from "react";

/**
 * Native camera barcode scanner.
 *
 * Uses getUserMedia for video, then the BarcodeDetector Web API for decoding
 * (Chrome Android 83+, Safari 17+). No external library required.
 *
 * Per-SKU cooldown prevents the same code from firing repeatedly while it's
 * still in frame — a different code is always accepted instantly.
 */
const CAMERA_SCAN_COOLDOWN_MS = 1500;

export function useCameraScanner(
  active: boolean,
  videoRef: RefObject<HTMLVideoElement | null>,
  onScan: (sku: string) => void,
  onCameraError?: (msg: string) => void,
) {
  const detectingRef    = useRef(false);   // async re-entry guard for detector.detect()
  const lastSkuRef      = useRef("");
  const lastScanTimeRef = useRef(0);
  const onScanRef       = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  useEffect(() => {
    if (!active) return;

    let mounted = true;
    let stream: MediaStream | null = null;
    let rafId   = 0;

    const stopStream = () => {
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      const v = videoRef.current;
      if (v) { v.srcObject = null; }
    };

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (err: unknown) {
        if (!mounted) return;
        const msg = ((err as Error)?.message ?? String(err)).toLowerCase();
        if (msg.includes("permission") || msg.includes("denied") || msg.includes("notallowed")) {
          onCameraError?.("Camera permission denied. Please allow camera access and try again.");
        } else {
          onCameraError?.("Camera unavailable. Use manual SKU entry below.");
        }
        return;
      }

      if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }

      const video = videoRef.current;
      if (!video) { stream.getTracks().forEach((t) => t.stop()); return; }
      video.srcObject = stream;
      try { await video.play(); } catch { /* autoplay blocked — still shows */ }

      if (!mounted) return;

      type BD = { detect(src: HTMLVideoElement): Promise<Array<{ rawValue: string }>> };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const BDClass = (window as any).BarcodeDetector as (new (o: object) => BD) | undefined;
      if (!BDClass) {
        onCameraError?.("Barcode detection not supported on this browser. Please type SKU manually.");
        return;
      }

      const detector: BD = new BDClass({
        formats: ["qr_code", "code_128", "ean_13", "code_39", "ean_8", "upc_a", "upc_e"],
      });

      const tick = async () => {
        if (!mounted) return;
        if (!detectingRef.current && video.readyState >= 2) {
          detectingRef.current = true;
          try {
            const codes = await detector.detect(video);
            if (codes.length > 0) {
              const raw = codes[0].rawValue;
              let sku = raw;
              try {
                if (raw.includes("product?sku=")) {
                  const u = new URL(raw.startsWith("http") ? raw : `http://x${raw}`);
                  sku = u.searchParams.get("sku") ?? raw;
                }
              } catch { /* use raw */ }
              sku = sku.toUpperCase();

              const now = Date.now();
              const isSameSku        = sku === lastSkuRef.current;
              const isWithinCooldown = (now - lastScanTimeRef.current) < CAMERA_SCAN_COOLDOWN_MS;

              if (!isSameSku || !isWithinCooldown) {
                lastSkuRef.current      = sku;
                lastScanTimeRef.current = now;
                onScanRef.current(sku);
              }
            }
          } catch { /* per-frame errors — ignore */ }
          detectingRef.current = false;
        }
        rafId = window.setTimeout(() => { rafId = requestAnimationFrame(tick); }, 100) as unknown as number;
      };
      rafId = requestAnimationFrame(tick);
    }

    startCamera();

    return () => {
      mounted = false;
      stopStream();
    };
  }, [active, videoRef]); // eslint-disable-line react-hooks/exhaustive-deps
}
