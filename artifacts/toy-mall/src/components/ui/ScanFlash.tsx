import { useState, useEffect, useCallback } from "react";
import { ScanLine, AlertTriangle } from "lucide-react";

const FLASH_DURATION_MS = 480;
const LOW_STOCK_DURATION_MS = 3000;

interface FlashState {
  sku: string;
  id: number;
}

export function useScanFlash() {
  const [flash, setFlash] = useState<FlashState | null>(null);

  const triggerFlash = useCallback((sku: string) => {
    setFlash({ sku, id: Date.now() });
  }, []);

  return { flash, triggerFlash };
}

interface ScanFlashProps {
  flash: FlashState | null;
}

export function ScanFlash({ flash }: ScanFlashProps) {
  const [visible, setVisible] = useState(false);
  const [currentSku, setCurrentSku] = useState("");
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (!flash) return;
    setCurrentSku(flash.sku);
    setVisible(true);
    setAnimKey((k) => k + 1);
    const t = setTimeout(() => setVisible(false), FLASH_DURATION_MS + 150);
    return () => clearTimeout(t);
  }, [flash]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 inset-x-0 z-[9999] flex justify-center pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        key={animKey}
        style={{
          animation: `scanFlashIn ${FLASH_DURATION_MS}ms cubic-bezier(0.22,1,0.36,1) forwards`,
        }}
        className="mt-3 mx-4 px-5 py-2.5 bg-green-500 text-white rounded-2xl shadow-2xl shadow-green-500/40 flex items-center gap-2.5"
      >
        <ScanLine className="w-4 h-4 shrink-0" />
        <span className="font-black text-sm tracking-wide uppercase">
          Scanned:&nbsp;
          <span className="font-mono">{currentSku}</span>
        </span>
      </div>
      <style>{`
        @keyframes scanFlashIn {
          0%   { opacity: 0; transform: translateY(-18px) scale(0.95); }
          18%  { opacity: 1; transform: translateY(0)     scale(1);    }
          72%  { opacity: 1; transform: translateY(0)     scale(1);    }
          100% { opacity: 0; transform: translateY(-12px) scale(0.97); }
        }
      `}</style>
    </div>
  );
}

/* ── Low Stock Flash ─────────────────────────────────────────────────── */

interface LowStockFlashState {
  productName: string;
  stock: number;
  id: number;
}

export function useLowStockFlash() {
  const [lowStockFlash, setLowStockFlash] = useState<LowStockFlashState | null>(null);

  const triggerLowStockFlash = useCallback((productName: string, stock: number) => {
    setLowStockFlash({ productName, stock, id: Date.now() });
  }, []);

  return { lowStockFlash, triggerLowStockFlash };
}

interface LowStockFlashProps {
  lowStockFlash: LowStockFlashState | null;
}

export function LowStockFlash({ lowStockFlash }: LowStockFlashProps) {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<{ productName: string; stock: number } | null>(null);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (!lowStockFlash) return;
    setCurrent({ productName: lowStockFlash.productName, stock: lowStockFlash.stock });
    setVisible(true);
    setAnimKey((k) => k + 1);
    const t = setTimeout(() => setVisible(false), LOW_STOCK_DURATION_MS);
    return () => clearTimeout(t);
  }, [lowStockFlash]);

  if (!visible || !current) return null;

  return (
    <div
      className="fixed top-0 inset-x-0 z-[9998] flex justify-center pointer-events-none"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div
        key={animKey}
        style={{
          animation: `lowStockFlashIn ${LOW_STOCK_DURATION_MS}ms cubic-bezier(0.22,1,0.36,1) forwards`,
          marginTop: "3.5rem",
        }}
        className="mx-4 px-5 py-2.5 bg-amber-400 text-amber-950 rounded-2xl shadow-2xl shadow-amber-400/40 flex items-center gap-2.5"
      >
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="font-bold text-sm">
          Only {current.stock} left in stock
        </span>
      </div>
      <style>{`
        @keyframes lowStockFlashIn {
          0%   { opacity: 0; transform: translateY(-14px) scale(0.95); }
          10%  { opacity: 1; transform: translateY(0)     scale(1);    }
          80%  { opacity: 1; transform: translateY(0)     scale(1);    }
          100% { opacity: 0; transform: translateY(-8px)  scale(0.97); }
        }
      `}</style>
    </div>
  );
}
