/* ── Online / offline detector ────────────────────────────────────
   Returns true when the browser has network access.
──────────────────────────────────────────────────────────────── */
import { useState, useEffect } from "react";

export function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online",  on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return online;
}
