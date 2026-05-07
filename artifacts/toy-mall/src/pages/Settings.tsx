import { useState, useEffect, useRef } from "react";
import { Settings2, Save, RotateCcw, Store, Phone, Receipt, Smile, Bell, CheckCircle2, AlertCircle, Send, Loader2, QrCode, ToggleLeft, ToggleRight, Tag, ScanLine, CheckCircle, ChevronDown, ChevronUp, Download, XCircle, Cpu, Star } from "lucide-react";
import { useStoreSettings, usePerStaffScannerPrefs, type StoreSettings } from "@/lib/store-info";
import { useAuth } from "@/hooks/use-auth";
import { useUsbScanner } from "@/hooks/use-usb-scanner";
import { useScanDebugLog, clearScanEvents } from "@/lib/scan-debug-log";
import { toast } from "sonner";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const EMOJI_OPTIONS = ["🧸", "🎮", "🛒", "🏪", "🎁", "🧩", "🎯", "🪀", "🎈", "⭐"];

const DEFAULTS: StoreSettings = {
  name:               "Hira & Sons Gift Shop",
  tagline:            "The Complete Toy Store",
  phone:              "+91 94318 01793",
  address:            "Near Old Bus Stand, Ranchi, Jharkhand - 834001",
  gst:                "",
  logoEmoji:          "🧸",
  appSubtitle:        "Billing Management",
  footerNote:         "Goods once sold will not be returned or exchanged.",
  upiId:              "",
  dynamicQrMode:      false,
  labelShowPrice:     true,
  scannerThresholdMs: 100,
  receiptPaperWidth:  "80mm",
};

const SCANNER_PRESETS = [
  { label: "Fast",    ms: 40,  hint: "Honeywell, Symbol — very quick bursts" },
  { label: "Normal",  ms: 60,  hint: "Most scanners (TVS BS-C101, generic HID)" },
  { label: "Slow",    ms: 100, hint: "Budget or older USB scanners" },
];

export default function SettingsPage() {
  const store = useStoreSettings();
  const { staffId, staffName } = useAuth();
  const scannerPrefs = usePerStaffScannerPrefs();
  const myPref = staffId ? scannerPrefs.getPref(staffId) : null;

  const [form, setForm] = useState<StoreSettings>({
    name:               store.name,
    tagline:            store.tagline,
    phone:              store.phone,
    address:            store.address,
    gst:                store.gst,
    logoEmoji:          store.logoEmoji,
    appSubtitle:        store.appSubtitle,
    footerNote:         store.footerNote,
    upiId:              store.upiId,
    dynamicQrMode:      store.dynamicQrMode,
    labelShowPrice:     store.labelShowPrice ?? true,
    scannerThresholdMs: store.scannerThresholdMs ?? 100,
    receiptPaperWidth:  store.receiptPaperWidth ?? "80mm",
  });
  const [saved, setSaved] = useState(false);
  const [tgConfigured, setTgConfigured] = useState<boolean | null>(null);
  const [tgTesting, setTgTesting] = useState(false);

  const [tgRecipients, setTgRecipients] = useState(0);

  useEffect(() => {
    fetch(`${API}/telegram/status`)
      .then((r) => r.json())
      .then((d) => { setTgConfigured(d.configured); setTgRecipients(d.recipients ?? 0); })
      .catch(() => setTgConfigured(false));
  }, []);

  const handleTestTelegram = async () => {
    setTgTesting(true);
    try {
      const r = await fetch(`${API}/telegram/test`, { method: "POST" });
      const d = await r.json();
      if (r.ok) toast.success("Test alert sent! Check your Telegram.");
      else toast.error(d.error || "Failed to send test alert");
    } catch {
      toast.error("Could not reach server");
    } finally {
      setTgTesting(false);
    }
  };

  const set = (key: keyof StoreSettings, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const toggle = (key: keyof StoreSettings) =>
    setForm((f) => ({ ...f, [key]: !f[key] }));

  const handleSave = () => {
    store.update(form);
    setSaved(true);
    toast.success("Settings saved!");
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setForm(DEFAULTS);
    store.update(DEFAULTS);
    toast.success("Reset to defaults");
  };

  const isDirty = JSON.stringify(form) !== JSON.stringify({
    name: store.name, tagline: store.tagline, phone: store.phone,
    address: store.address, gst: store.gst, logoEmoji: store.logoEmoji,
    appSubtitle: store.appSubtitle, footerNote: store.footerNote,
    upiId: store.upiId, dynamicQrMode: store.dynamicQrMode,
    labelShowPrice: store.labelShowPrice ?? true,
    scannerThresholdMs: store.scannerThresholdMs ?? 100,
    receiptPaperWidth: store.receiptPaperWidth ?? "80mm",
  });

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 md:px-6 border-b sticky top-0 bg-background z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Settings2 className="w-6 h-6 text-primary" /> Settings
          </h1>
          <div className="flex gap-2">
            <button onClick={handleReset}
              className="px-3 py-2 rounded-xl text-muted-foreground hover:bg-muted text-sm font-bold transition-colors flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
            <button onClick={handleSave}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                saved
                  ? "bg-green-500 text-white"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              }`}>
              <Save className="w-4 h-4" />
              {saved ? "Saved!" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-32 md:pb-8 p-4 md:p-6 md:max-w-2xl space-y-6">

        {/* ── Live Preview ── */}
        <div className="bg-card border rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Logo Preview</p>
          <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-xl shadow-sm shadow-primary/20 shrink-0">
              {form.logoEmoji || "🏪"}
            </div>
            <div>
              <p className="font-black text-sm leading-tight">{form.name || "Shop Name"}</p>
              <p className="text-xs text-muted-foreground">{form.appSubtitle || "App Subtitle"}</p>
            </div>
          </div>
          <div className="border rounded-xl overflow-hidden text-center py-4 px-6 bg-white dark:bg-neutral-900 text-black dark:text-white space-y-0.5" style={{ fontFamily: "'Courier New', monospace" }}>
            <p className="text-base font-black tracking-widest uppercase">{form.name || "Shop Name"}</p>
            <p className="text-xs">{form.tagline || "Tagline"}</p>
            {form.phone && <p className="text-xs">📞 {form.phone}</p>}
            {form.address && <p className="text-xs">{form.address}</p>}
            {form.gst && <p className="text-xs font-bold">GST: {form.gst}</p>}
          </div>
        </div>

        {/* ── Store Identity ── */}
        <Section icon={Store} title="Store Identity" color="text-primary bg-primary/10">
          <Field label="Shop Name" hint="Shown on bills, login screen & sidebar">
            <input value={form.name} onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Hira & Sons Gift Shop"
              className="w-full px-3 py-2.5 rounded-xl border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-bold" />
          </Field>
          <Field label="Tagline" hint="One-line description shown on bills">
            <input value={form.tagline} onChange={(e) => set("tagline", e.target.value)}
              placeholder="e.g. The Complete Toy Store"
              className="w-full px-3 py-2.5 rounded-xl border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </Field>
          <Field label="App Subtitle" hint="Shown below your shop name in sidebar & login">
            <input value={form.appSubtitle} onChange={(e) => set("appSubtitle", e.target.value)}
              placeholder="e.g. Billing Management"
              className="w-full px-3 py-2.5 rounded-xl border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </Field>
        </Section>

        {/* ── Logo Emoji ── */}
        <Section icon={Smile} title="Logo Icon" color="text-amber-600 bg-amber-50 dark:bg-amber-950/30">
          <Field label="Pick an emoji for your logo" hint="Shown in the sidebar, login screen and bill footer">
            <div className="flex flex-wrap gap-2 mb-3">
              {EMOJI_OPTIONS.map((e) => (
                <button key={e} onClick={() => set("logoEmoji", e)}
                  className={`w-10 h-10 text-xl rounded-xl border-2 transition-all ${form.logoEmoji === e ? "border-primary bg-primary/10 scale-110" : "border-border hover:border-primary/50 hover:bg-muted"}`}>
                  {e}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input value={form.logoEmoji} onChange={(e) => set("logoEmoji", e.target.value)}
                maxLength={2} placeholder="Or type any emoji"
                className="w-24 px-3 py-2.5 rounded-xl border bg-muted/30 text-center text-lg focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <p className="text-xs text-muted-foreground">Or paste / type any emoji</p>
            </div>
          </Field>
        </Section>

        {/* ── Contact Info ── */}
        <Section icon={Phone} title="Contact Details" color="text-blue-600 bg-blue-50 dark:bg-blue-950/30">
          <Field label="Phone Number" hint="Printed on every bill">
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full px-3 py-2.5 rounded-xl border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </Field>
          <Field label="Address" hint="Full store address on bills">
            <textarea value={form.address} onChange={(e) => set("address", e.target.value)}
              rows={2} placeholder="Shop address, City, State - PIN"
              className="w-full px-3 py-2.5 rounded-xl border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </Field>
          <Field label="GST Number" hint="Optional — leave empty to hide from bills">
            <input value={form.gst} onChange={(e) => set("gst", e.target.value)}
              placeholder="e.g. 27AAPFU0939F1ZV"
              className="w-full px-3 py-2.5 rounded-xl border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono" />
          </Field>
        </Section>

        {/* ── Bill Footer ── */}
        <Section icon={Receipt} title="Bill Footer Note" color="text-purple-600 bg-purple-50 dark:bg-purple-950/30">
          <Field label="Footer Message" hint="Printed at the bottom of every bill">
            <textarea value={form.footerNote} onChange={(e) => set("footerNote", e.target.value)}
              rows={2} placeholder="e.g. Goods once sold will not be returned or exchanged."
              className="w-full px-3 py-2.5 rounded-xl border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </Field>
        </Section>

        {/* ── UPI / Dynamic QR ── */}
        <Section icon={QrCode} title="UPI &amp; Dynamic QR" color="text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30">
          <Field label="UPI ID" hint="e.g. yourname@upi — shown as QR code at checkout when Dynamic QR Mode is on">
            <input
              value={form.upiId}
              onChange={(e) => set("upiId", e.target.value.trim())}
              placeholder="yourname@okicici"
              className="w-full px-3 py-2.5 rounded-xl border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
            />
          </Field>

          <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
            <div>
              <p className="text-xs font-bold">Dynamic QR Mode</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                When on, selecting UPI at checkout shows a scannable QR code with the exact bill amount. Staff confirm payment manually.
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggle("dynamicQrMode")}
              className={`ml-4 shrink-0 transition-colors ${form.dynamicQrMode ? "text-indigo-600" : "text-muted-foreground"}`}
              aria-label="Toggle Dynamic QR Mode"
            >
              {form.dynamicQrMode
                ? <ToggleRight className="w-10 h-10" />
                : <ToggleLeft  className="w-10 h-10" />}
            </button>
          </div>

          {form.dynamicQrMode && !form.upiId && (
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
              ⚠️ Enter a UPI ID above to activate QR generation.
            </p>
          )}
        </Section>

        {/* ── Label Printing ── */}
        <Section icon={Tag} title="Label &amp; Receipt Printing" color="text-amber-600 bg-amber-50 dark:bg-amber-950/30">
          <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
            <div>
              <p className="text-xs font-bold">Show Price on Labels</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                When on, the selling price is printed on every shelf label. Turn off to hide price from labels.
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggle("labelShowPrice")}
              className={`ml-4 shrink-0 transition-colors ${form.labelShowPrice ? "text-amber-600" : "text-muted-foreground"}`}
              aria-label="Toggle price on labels"
            >
              {form.labelShowPrice
                ? <ToggleRight className="w-10 h-10" />
                : <ToggleLeft  className="w-10 h-10" />}
            </button>
          </div>

          <div className="p-3 rounded-xl border bg-muted/20 space-y-2">
            <div>
              <p className="text-xs font-bold">Receipt Paper Width</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Match this to your thermal roll size. Affects the paper size when printing bills.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              {(["58mm", "80mm"] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, receiptPaperWidth: w }))}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${
                    form.receiptPaperWidth === w
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                      : "border-border hover:border-amber-400 hover:bg-muted"
                  }`}
                >
                  {w}
                  <span className="block text-[10px] font-normal text-muted-foreground mt-0.5">
                    {w === "58mm" ? "Compact roll" : "Standard roll"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* ── Scanner Speed ── */}
        <Section icon={ScanLine} title="USB Scanner Speed" color="text-green-600 bg-green-50 dark:bg-green-950/30">
          <Field label="Inter-keystroke threshold" hint="How long to wait between characters before deciding the input isn't from a scanner. Increase if your scanner is being missed; decrease if normal typing is triggering false scans.">
            {myPref && (
              <div className="mb-2 flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {myPref.deviceName
                  ? `${staffName || "You"} last used ${myPref.thresholdMs} ms with "${myPref.deviceName}"`
                  : `${staffName || "You"} last confirmed ${myPref.thresholdMs} ms`}
                {" "}— click the highlighted preset to apply it.
              </div>
            )}
            <div className="flex gap-2 mb-3">
              {SCANNER_PRESETS.map((p) => {
                const isActive = form.scannerThresholdMs === p.ms;
                const isMyPref = myPref?.thresholdMs === p.ms;
                return (
                  <button
                    key={p.ms}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, scannerThresholdMs: p.ms }))}
                    className={`flex-1 py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all relative ${
                      isActive
                        ? "border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
                        : isMyPref
                        ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                        : "border-border hover:border-green-400 hover:bg-muted"
                    }`}
                  >
                    {p.label}
                    <span className="block text-[10px] font-normal text-muted-foreground mt-0.5">{p.ms} ms</span>
                    {isMyPref && !isActive && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-amber-400 text-white text-[9px] font-black whitespace-nowrap leading-tight">
                        ★ last worked
                      </span>
                    )}
                    {isMyPref && isActive && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-green-500 text-white text-[9px] font-black whitespace-nowrap leading-tight">
                        ★ your preset
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Custom: {form.scannerThresholdMs} ms</span>
                <span className="text-[11px] text-muted-foreground">40 ms — 200 ms</span>
              </div>
              <input
                type="range"
                min={40}
                max={200}
                step={5}
                value={form.scannerThresholdMs}
                onChange={(e) => setForm((f) => ({ ...f, scannerThresholdMs: Number(e.target.value) }))}
                className="w-full accent-green-500"
              />
            </div>
            {SCANNER_PRESETS.find((p) => p.ms === form.scannerThresholdMs) && (
              <p className="text-[11px] text-green-700 dark:text-green-400 font-medium">
                ✓ {SCANNER_PRESETS.find((p) => p.ms === form.scannerThresholdMs)?.hint}
              </p>
            )}
          </Field>

          <ScannerTestWidget
            thresholdMs={form.scannerThresholdMs}
            staffId={staffId ?? undefined}
            staffName={staffName}
            onDetected={(thresholdMs, deviceName) => {
              if (!staffId) return;
              scannerPrefs.setPref(staffId, {
                thresholdMs,
                deviceName,
                confirmedAt: new Date().toISOString(),
              });
            }}
            onSuggest={(thresholdMs, deviceName) => {
              setForm((f) => ({ ...f, scannerThresholdMs: thresholdMs }));
              toast.info(
                `Scanner "${deviceName}" detected — threshold set to ${thresholdMs} ms. Scan a barcode to confirm it works.`,
              );
            }}
          />
          <RecentScanEvents />
        </Section>

        {/* ── Telegram Notifications ── */}
        <Section icon={Bell} title="Sale Notifications" color="text-sky-600 bg-sky-50 dark:bg-sky-950/30">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
              <div className="flex items-center gap-2.5">
                {tgConfigured === null ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : tgConfigured ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                )}
                <div>
                  <p className="text-xs font-bold">
                    {tgConfigured === null ? "Checking…" : tgConfigured ? "Telegram Connected" : "Telegram Not Configured"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {tgConfigured
                      ? `${tgRecipients} recipient${tgRecipients !== 1 ? "s" : ""} — alerts fire on every new sale`
                      : "Add secrets to enable alerts"}
                  </p>
                </div>
              </div>
              {tgConfigured && (
                <button onClick={handleTestTelegram} disabled={tgTesting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 text-white text-xs font-bold hover:bg-sky-600 transition-colors disabled:opacity-60">
                  {tgTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {tgTesting ? "Sending…" : "Test Alert"}
                </button>
              )}
            </div>

            <div className="rounded-xl border bg-muted/10 p-3 space-y-2 text-[11px] text-muted-foreground">
              <p className="font-bold text-xs text-foreground">Setup Instructions</p>
              <ol className="space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>Open Telegram and search for <span className="font-mono bg-muted px-1 rounded">@BotFather</span></li>
                <li>Send <span className="font-mono bg-muted px-1 rounded">/newbot</span> and follow the prompts to get a <b>Bot Token</b></li>
                <li>Start a chat with your new bot, then visit:<br />
                  <span className="font-mono bg-muted px-1 rounded break-all">api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</span><br />
                  to find your <b>Chat ID</b></li>
                <li>Add <span className="font-mono bg-muted px-1 rounded">TELEGRAM_BOT_TOKEN</span> and <span className="font-mono bg-muted px-1 rounded">TELEGRAM_CHAT_ID</span> as secrets in Replit, then restart the app</li>
              </ol>
              <div className="mt-3 pt-3 border-t space-y-1">
                <p className="font-bold text-xs text-foreground">Add Multiple Recipients</p>
                <p>To send alerts to more than one person, edit the <span className="font-mono bg-muted px-1 rounded">TELEGRAM_CHAT_ID</span> secret and separate each Chat ID with a comma:</p>
                <p className="font-mono bg-muted px-2 py-1 rounded break-all">123456789,987654321,555000111</p>
                <p>Each person must first send a message to your bot so Telegram allows it to reach them.</p>
              </div>
            </div>
          </div>
        </Section>

        {isDirty && (
          <div className="fixed bottom-24 md:bottom-6 left-4 right-4 md:left-auto md:right-8 md:w-72 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-lg z-20">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400">You have unsaved changes</p>
            <button onClick={handleSave}
              className="px-3 py-1.5 bg-amber-500 text-white text-xs font-black rounded-xl hover:bg-amber-600 transition-colors">
              Save now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ScannerTestWidget({
  thresholdMs,
  staffId,
  staffName,
  onDetected,
  onSuggest,
}: {
  thresholdMs: number;
  staffId?: string;
  staffName?: string;
  onDetected?: (thresholdMs: number, deviceName?: string) => void;
  onSuggest?: (thresholdMs: number, deviceName: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputVal, setInputVal] = useState("");
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hidStatus, setHidStatus] = useState<"idle" | "detecting" | "found" | "none">("idle");
  const [hidDevice, setHidDevice] = useState<string | null>(null);

  const hidAvailable = typeof navigator !== "undefined" && "hid" in navigator;

  const handleDetectHid = async () => {
    if (!hidAvailable) return;
    setHidStatus("detecting");
    try {
      const devices = await (navigator as unknown as { hid: { requestDevice: (opts: unknown) => Promise<{ productName: string }[]> } }).hid.requestDevice({ filters: [] });
      if (devices.length === 0) {
        setHidStatus("none");
        return;
      }
      const name = devices[0].productName || "Unknown HID device";
      setHidDevice(name);
      setHidStatus("found");
      const lower = name.toLowerCase();
      let suggestedMs: number;
      if (lower.includes("honeywell") || lower.includes("symbol") || lower.includes("zebra")) {
        suggestedMs = 40;
      } else if (lower.includes("tvs") || lower.includes("opticon") || lower.includes("datalogic")) {
        suggestedMs = 60;
      } else {
        suggestedMs = 60;
      }
      onSuggest?.(suggestedMs, name);
    } catch {
      setHidStatus("none");
    }
  };

  useUsbScanner(
    (code) => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
      setLastCode(code);
      setInputVal("");
      if (staffId && onDetected) {
        onDetected(thresholdMs, hidDevice ?? undefined);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
      clearTimer.current = setTimeout(() => setLastCode(null), 4000);
    },
    {
      enabled: true,
      thresholdMs,
      skipDebugLog: true,
      allowedInput: {
        ref: inputRef,
        onClear: () => setInputVal(""),
      },
    },
  );

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-foreground">Test your scanner</label>
      <p className="text-[11px] text-muted-foreground">
        Point your scanner at any barcode and scan it. If detected, a green confirmation appears and this threshold is remembered for you next visit. If nothing happens, increase the threshold above then save.
      </p>
      <input
        ref={inputRef}
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        placeholder="Click here then scan a barcode…"
        className="w-full px-3 py-2.5 rounded-xl border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40 font-mono"
      />
      {lastCode && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Scanner detected! Code: <span className="font-mono ml-1">{lastCode}</span>
          {saved && staffId && (
            <span className="ml-auto text-[10px] font-black bg-green-600 text-white px-1.5 py-0.5 rounded-full">
              ★ saved for you
            </span>
          )}
        </div>
      )}

      {hidAvailable && (
        <div className="pt-1">
          <button
            type="button"
            onClick={handleDetectHid}
            disabled={hidStatus === "detecting"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold hover:bg-muted transition-colors disabled:opacity-60"
          >
            {hidStatus === "detecting" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Cpu className="w-3.5 h-3.5" />
            )}
            {hidStatus === "detecting" ? "Detecting…" : "Auto-detect scanner device"}
          </button>
          {hidStatus === "found" && hidDevice && (
            <p className="mt-1.5 text-[11px] text-green-700 dark:text-green-400 font-medium">
              ✓ Found: <span className="font-mono">{hidDevice}</span> — threshold pre-filled. Scan a barcode above to confirm.
            </p>
          )}
          {hidStatus === "none" && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">No HID device selected. Grant permission and try again.</p>
          )}
          {hidStatus === "idle" && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              Lets the browser identify your scanner model to prefill the best threshold.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function RecentScanEvents() {
  const events = useScanDebugLog();
  const [open, setOpen] = useState(false);

  const exportCsv = () => {
    const rows = [
      ["Timestamp", "Type", "Code", "Max elapsed (ms)"],
      ...events.map((e) => [
        e.timestamp.toISOString(),
        e.type,
        e.code ?? "",
        String(e.maxElapsedMs),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `scanner-events-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  function fmtTime(d: Date) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  const detectedCount = events.filter((e) => e.type === "detected").length;
  const missedCount = events.filter((e) => e.type === "missed").length;
  const total = events.length;
  const missRate = total > 0 ? missedCount / total : 0;
  const healthColor =
    total === 0
      ? "bg-muted text-muted-foreground"
      : missRate === 0
      ? "bg-green-500 text-white"
      : missRate < 0.5
      ? "bg-amber-400 text-amber-900"
      : "bg-red-500 text-white";
  const healthLabel =
    total === 0 ? "No data" : missRate === 0 ? "All good" : missRate < 0.5 ? "Some misses" : "Mostly missed";

  return (
    <div className="rounded-xl border bg-muted/20 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/10">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${healthColor}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 shrink-0" />
          {healthLabel}
        </span>
        {total > 0 ? (
          <span className="text-[11px] text-muted-foreground">
            <span className="text-green-600 dark:text-green-400 font-semibold">{detectedCount} detected</span>
            {" / "}
            <span className="text-red-500 font-semibold">{missedCount} missed</span>
            {" in the last "}
            <span className="font-semibold">{total}</span>
            {" scan"}
            {total !== 1 ? "s" : ""}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Scan a barcode to see health data</span>
        )}
      </div>
      <div className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-bold flex-1 text-left"
        >
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Recent scan events
          {events.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-mono text-[10px]">
              {events.length}
            </span>
          )}
        </button>
        {open && events.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={exportCsv}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-500 text-white text-[10px] font-bold hover:bg-green-600 transition-colors"
            >
              <Download className="w-3 h-3" /> Export CSV
            </button>
            <button
              type="button"
              onClick={() => { clearScanEvents(); }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500 text-white text-[10px] font-bold hover:bg-red-600 transition-colors"
            >
              <XCircle className="w-3 h-3" /> Clear log
            </button>
          </div>
        )}
      </div>

      {open && (
        <div className="border-t">
          {events.length === 0 ? (
            <p className="px-3 py-4 text-center text-[11px] text-muted-foreground">
              No scan events yet. Scan a barcode to see events here.
            </p>
          ) : (
            <div className="divide-y max-h-64 overflow-y-auto">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-center gap-2.5 px-3 py-2">
                  {ev.type === "detected" ? (
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  )}
                  <span className="font-mono text-[10px] text-muted-foreground w-20 shrink-0">
                    {fmtTime(ev.timestamp)}
                  </span>
                  <span className={`text-[11px] font-bold flex-1 truncate ${ev.type === "detected" ? "text-green-700 dark:text-green-400" : "text-red-500"}`}>
                    {ev.type === "detected"
                      ? (ev.code ?? "—")
                      : "missed"}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                    {ev.maxElapsedMs > 0 ? `${ev.maxElapsedMs} ms` : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="px-3 py-2 text-[10px] text-muted-foreground border-t">
            Last {events.length} event{events.length !== 1 ? "s" : ""} · saved across page reloads
          </p>
        </div>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, color, children }: {
  icon: React.ElementType;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card border rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <h2 className="font-black text-sm">{title}</h2>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-foreground">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
