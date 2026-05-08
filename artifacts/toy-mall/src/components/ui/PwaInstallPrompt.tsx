import { useEffect, useState } from "react";
import { Download, X, Share, Plus } from "lucide-react";
import { useStoreSettings } from "@/lib/store-info";

const DISMISS_KEY = "toy-mall-pwa-dismiss-v1";
const DISMISS_DAYS = 7;

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS-specific
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window.navigator as any).standalone === true) return true;
  return false;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function recentlyDismissed(): boolean {
  try {
    const ts = Number(localStorage.getItem(DISMISS_KEY) ?? "0");
    if (!ts) return false;
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function PwaInstallPrompt() {
  const store = useStoreSettings();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos]   = useState(false);
  const [hidden, setHidden]     = useState(true);

  useEffect(() => {
    if (isStandalone()) return;       // already installed
    if (recentlyDismissed()) return;  // user said "not now" recently

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS Safari never fires beforeinstallprompt — show manual hint
    if (isIOS() && isMobile()) {
      setShowIos(true);
      setHidden(false);
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setHidden(true);
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setHidden(true);
      } else {
        dismiss();
      }
    } catch {
      dismiss();
    }
    setDeferred(null);
  };

  if (hidden) return null;

  /* iOS: manual instructions ─────────────────────────────────────── */
  if (showIos) {
    return (
      <div className="fixed inset-x-0 bottom-0 md:bottom-4 md:right-4 md:left-auto md:max-w-sm z-[60] p-3">
        <div className="rounded-2xl bg-gradient-to-br from-violet-600 via-blue-600 to-cyan-500 text-white shadow-2xl p-4 relative">
          <button onClick={dismiss}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
            aria-label="Dismiss">
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-start gap-3">
            <div className="text-3xl">{store.logoEmoji}</div>
            <div className="flex-1 pr-6">
              <p className="font-black text-sm">Install {store.name}</p>
              <p className="text-xs opacity-90 mt-1 leading-snug">
                Tap <Share className="inline w-3 h-3 mx-0.5" /> <span className="font-bold">Share</span> in Safari, then <span className="font-bold">"Add to Home Screen"</span> <Plus className="inline w-3 h-3 mx-0.5" />.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* Android / Edge / Chrome desktop: use beforeinstallprompt ───────── */
  return (
    <div className="fixed inset-x-0 bottom-0 md:bottom-4 md:right-4 md:left-auto md:max-w-sm z-[60] p-3">
      <div className="rounded-2xl bg-gradient-to-br from-violet-600 via-blue-600 to-cyan-500 text-white shadow-2xl p-4 relative">
        <button onClick={dismiss}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
          aria-label="Dismiss">
          <X className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="text-3xl shrink-0">{store.logoEmoji}</div>
          <div className="flex-1 min-w-0 pr-6">
            <p className="font-black text-sm leading-tight">Install {store.name}</p>
            <p className="text-[11px] opacity-90 mt-0.5 leading-snug">
              Add to home screen for instant access — works like a real app.
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={dismiss}
            className="flex-1 h-10 rounded-xl bg-white/20 hover:bg-white/30 font-bold text-xs transition-colors">
            Not now
          </button>
          <button onClick={install}
            className="flex-1 h-10 rounded-xl bg-white text-violet-700 hover:bg-white/95 font-black text-xs flex items-center justify-center gap-1.5 transition-colors active:scale-95">
            <Download className="w-3.5 h-3.5" />
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
