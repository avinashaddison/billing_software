import { useState, useEffect, useRef } from "react";
import { Settings2, Save, RotateCcw, Store, Phone, Receipt, Smile, Bell, CheckCircle2, AlertCircle, Send, Loader2, QrCode, ToggleLeft, ToggleRight, Tag, ScanLine, CheckCircle, ChevronDown, ChevronUp, Download, XCircle, Cpu, Star, ImagePlus, Palette, Sparkles } from "lucide-react";
import { useStoreSettings, usePerStaffScannerPrefs, type StoreSettings } from "@/lib/store-info";

/* `bulbLaariEnabled` is owned by the Customization section and toggled in
 * realtime (no Save click). Excluding it from the form prevents an old
 * mount-time form value from overwriting a fresh toggle on Save. */
type FormSettings = Omit<StoreSettings, "bulbLaariEnabled">;
import { SIDEBAR_THEMES, DEFAULT_LOGO_BG_THEME, getSidebarTheme, type LogoBgTheme } from "@/lib/sidebar-themes";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { useAuth } from "@/hooks/use-auth";
import { useUsbScanner } from "@/hooks/use-usb-scanner";
import { useScanDebugLog, clearScanEvents } from "@/lib/scan-debug-log";
import { toast } from "sonner";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const EMOJI_OPTIONS = ["🧸", "🎮", "🛒", "🏪", "🎁", "🧩", "🎯", "🪀", "🎈", "⭐"];

const FONT_OPTIONS = [
  { id: "Playfair Display", label: "Playfair (Display)", family: "'Playfair Display', Georgia, serif" },
  { id: "Cinzel", label: "Cinzel (Roman Caps)", family: "'Cinzel', Georgia, serif" },
  { id: "Inter", label: "Inter (Modern Sans)", family: "'Inter', sans-serif" },
  { id: "Montserrat", label: "Montserrat (Geometric)", family: "'Montserrat', sans-serif" },
  { id: "Courier New", label: "Courier (Monospace)", family: "'Courier New', monospace" },
  { id: "Georgia", label: "Georgia (Serif)", family: "'Georgia', serif" },
  { id: "Lora", label: "Lora (Elegant Serif)", family: "'Lora', serif" },
  { id: "Rubik", label: "Rubik (Soft Sans)", family: "'Rubik', sans-serif" },
  { id: "Oswald", label: "Oswald (Condense)", family: "'Oswald', sans-serif" },
  { id: "Sacramento", label: "Sacramento (Hand-script)", family: "'Sacramento', cursive" },
  { id: "Great Vibes", label: "Great Vibes (Cursive)", family: "'Great Vibes', cursive" },
];

const DEFAULTS: FormSettings = {
  name:               "Your Shop Name",
  tagline:            "Set your tagline in Settings",
  phone:              "",
  email:              "",
  address:            "",
  gst:                "",
  gstRatePercent:     0,
  logoEmoji:          "🏪",
  logoUrl:            "",
  logoBgTheme:        DEFAULT_LOGO_BG_THEME,
  appSubtitle:        "Billing & Inventory",
  footerNote:         "Thank you for your business.",
  termsAndConditions: [
    "No Cash Refund.",
    "Goods once sold will not be returned or exchanged.",
  ],
  upiId:              "",
  dynamicQrMode:      false,
  labelShowPrice:     true,
  scannerThresholdMs: 100,
  receiptPaperWidth:  "80mm",
  headerLayout:       "split",
  headerFontFamily:   "Playfair Display",
  headerBrandFontFamily: "Playfair Display",
  headerSubtitleFontFamily: "Playfair Display",
  headerTaglineFontFamily: "Playfair Display",
  headerAddressPhoneFontFamily: "Inter",
  headerBrandFontSize: 28,
  headerSubtitleFontSize: 25,
  headerTaglineFontSize: 13,
  headerAddressPhoneFontSize: 12,
  headerLogoSize:     96,
  headerColorTheme:   "black",
  headerShowOrnaments: false,
  headerAlign:        "center",
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

  const [form, setForm] = useState<FormSettings>({
    name:               store.name,
    tagline:            store.tagline,
    phone:              store.phone,
    email:              store.email ?? "",
    address:            store.address,
    gst:                store.gst,
    gstRatePercent:     store.gstRatePercent ?? 0,
    logoEmoji:          store.logoEmoji,
    logoUrl:            store.logoUrl ?? "",
    logoBgTheme:        store.logoBgTheme ?? DEFAULT_LOGO_BG_THEME,
    appSubtitle:        store.appSubtitle,
    footerNote:         store.footerNote,
    termsAndConditions: store.termsAndConditions ?? [],
    upiId:              store.upiId,
    dynamicQrMode:      store.dynamicQrMode,
    labelShowPrice:     store.labelShowPrice ?? true,
    scannerThresholdMs: store.scannerThresholdMs ?? 100,
    receiptPaperWidth:  store.receiptPaperWidth ?? "80mm",
    headerLayout:       store.headerLayout ?? "split",
    headerFontFamily:   store.headerFontFamily ?? "Playfair Display",
    headerBrandFontFamily: store.headerBrandFontFamily ?? "Playfair Display",
    headerSubtitleFontFamily: store.headerSubtitleFontFamily ?? "Playfair Display",
    headerTaglineFontFamily: store.headerTaglineFontFamily ?? "Playfair Display",
    headerAddressPhoneFontFamily: store.headerAddressPhoneFontFamily ?? "Inter",
    headerBrandFontSize: store.headerBrandFontSize ?? 28,
    headerSubtitleFontSize: store.headerSubtitleFontSize ?? 25,
    headerTaglineFontSize: store.headerTaglineFontSize ?? 13,
    headerAddressPhoneFontSize: store.headerAddressPhoneFontSize ?? 12,
    headerLogoSize:     store.headerLogoSize ?? 96,
    headerColorTheme:   store.headerColorTheme ?? "black",
    headerShowOrnaments: store.headerShowOrnaments ?? false,
    headerAlign:        store.headerAlign ?? "center",
  });
  const [saved, setSaved] = useState(false);
  const [tgConfigured, setTgConfigured] = useState<boolean | null>(null);
  const [tgTesting, setTgTesting] = useState(false);

  const [tgRecipients, setTgRecipients] = useState(0);

  useEffect(() => {
    fetch(`${API}/telegram/status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setTgConfigured(d?.configured ?? false); setTgRecipients(d?.recipients ?? 0); })
      .catch(() => setTgConfigured(false));
  }, []);

  const handleTestTelegram = async () => {
    setTgTesting(true);
    try {
      const r = await fetch(`${API}/telegram/test`, { method: "POST" });
      const d = await r.json().catch(() => null);
      if (r.ok) toast.success("Test alert sent! Check your Telegram.");
      else toast.error(d?.error || "Failed to send test alert");
    } catch {
      toast.error("Could not reach server");
    } finally {
      setTgTesting(false);
    }
  };

  const set = (key: keyof FormSettings, val: any) =>
    setForm((f) => ({ ...f, [key]: val }));

  const toggle = (key: keyof FormSettings) =>
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
    address: store.address, gst: store.gst,
    gstRatePercent: store.gstRatePercent ?? 0,
    logoEmoji: store.logoEmoji,
    logoUrl: store.logoUrl ?? "",
    logoBgTheme: store.logoBgTheme ?? DEFAULT_LOGO_BG_THEME,
    appSubtitle: store.appSubtitle, footerNote: store.footerNote,
    upiId: store.upiId, dynamicQrMode: store.dynamicQrMode,
    labelShowPrice: store.labelShowPrice ?? true,
    scannerThresholdMs: store.scannerThresholdMs ?? 100,
    receiptPaperWidth: store.receiptPaperWidth ?? "80mm",
    headerLayout: store.headerLayout ?? "split",
    headerFontFamily: store.headerFontFamily ?? "Playfair Display",
    headerBrandFontFamily: store.headerBrandFontFamily ?? "Playfair Display",
    headerSubtitleFontFamily: store.headerSubtitleFontFamily ?? "Playfair Display",
    headerTaglineFontFamily: store.headerTaglineFontFamily ?? "Playfair Display",
    headerAddressPhoneFontFamily: store.headerAddressPhoneFontFamily ?? "Inter",
    headerBrandFontSize: store.headerBrandFontSize ?? 28,
    headerSubtitleFontSize: store.headerSubtitleFontSize ?? 25,
    headerTaglineFontSize: store.headerTaglineFontSize ?? 13,
    headerAddressPhoneFontSize: store.headerAddressPhoneFontSize ?? 12,
    headerLogoSize: store.headerLogoSize ?? 96,
    headerColorTheme: store.headerColorTheme ?? "black",
    headerShowOrnaments: store.headerShowOrnaments ?? false,
    headerAlign: store.headerAlign ?? "center",
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
        <div className="bg-card border rounded-2xl p-4 space-y-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Sidebar Header Preview</p>
          <SidebarHeaderPreview
            theme={form.logoBgTheme}
            name={form.name}
            logoEmoji={form.logoEmoji}
            logoUrl={form.logoUrl}
          />
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest pt-2">80mm Receipt Header Preview</p>
          <ReceiptHeaderPreview
            logoUrl={form.logoUrl}
            logoEmoji={form.logoEmoji}
            name={form.name}
            tagline={form.tagline}
            address={form.address}
            phone={form.phone}
            email={form.email}
            layout={form.headerLayout ?? "split"}
            brandFontFamily={form.headerBrandFontFamily ?? "Playfair Display"}
            subtitleFontFamily={form.headerSubtitleFontFamily ?? "Playfair Display"}
            taglineFontFamily={form.headerTaglineFontFamily ?? "Playfair Display"}
            addressPhoneFontFamily={form.headerAddressPhoneFontFamily ?? "Inter"}
            brandFontSize={form.headerBrandFontSize ?? 28}
            subtitleFontSize={form.headerSubtitleFontSize ?? 25}
            taglineFontSize={form.headerTaglineFontSize ?? 13}
            addressPhoneFontSize={form.headerAddressPhoneFontSize ?? 12}
            logoSize={form.headerLogoSize ?? 96}
            colorTheme={form.headerColorTheme ?? "black"}
            showOrnaments={form.headerShowOrnaments ?? false}
            align={form.headerAlign ?? "center"}
          />
        </div>

        {/* ── Store Identity ── */}
        <Section icon={Store} title="Store Identity" color="text-primary bg-primary/10">
          <Field label="Shop Name" hint="Shown on bills, login screen & sidebar">
            <input value={form.name} onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Acme Gift Shop"
              className="w-full px-3 py-2.5 rounded-xl border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 font-bold" />
          </Field>
          <Field label="Tagline" hint="One-line description shown on bills">
            <input value={form.tagline} onChange={(e) => set("tagline", e.target.value)}
              placeholder="e.g. Quality goods, fair prices"
              className="w-full px-3 py-2.5 rounded-xl border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </Field>
          <Field label="App Subtitle" hint="Shown below your shop name in sidebar & login">
            <input value={form.appSubtitle} onChange={(e) => set("appSubtitle", e.target.value)}
              placeholder="e.g. Billing Management"
              className="w-full px-3 py-2.5 rounded-xl border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </Field>
        </Section>

        {/* ── Logo Image ── */}
        <Section icon={ImagePlus} title="Logo Image" color="text-violet-600 bg-violet-50 dark:bg-violet-950/30">
          <Field label="Upload your shop logo" hint="Used on the printed bill header. Square or rectangular PNG / JPG works best (transparent PNG = cleanest receipt look).">
            <ImageUploader
              value={form.logoUrl}
              onChange={(url) => set("logoUrl", url)}
              onClear={() => set("logoUrl", "")}
              label="Shop Logo"
            />
            {form.logoUrl && (
              <div className="mt-3 p-3 rounded-xl border bg-white dark:bg-neutral-900 flex items-center justify-center">
                <img src={form.logoUrl} alt="Logo preview" className="max-h-20 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-2">
              Tip: leave empty to use a clean text-only header. Only one of logo image or emoji shows on the receipt.
            </p>
          </Field>
        </Section>

        {/* ── Logo Emoji (fallback) ── */}
        <Section icon={Smile} title="Logo Emoji (fallback)" color="text-amber-600 bg-amber-50 dark:bg-amber-950/30">
          <Field label="Pick an emoji for your logo" hint="Used in the sidebar and login screen when no logo image is uploaded.">
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

        {/* ── Receipt Header Customization ── */}
        <Section icon={Receipt} title="Receipt Header Customization" color="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30">
          <Field label="Logo Selection" hint="Choose the graphic to print at the very top of your receipts.">
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => set("logoUrl", "teddy")}
                className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all flex flex-col items-center gap-1.5 ${
                  form.logoUrl === "teddy"
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                    : "border-border hover:border-emerald-400 hover:bg-muted"
                }`}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0">🧸</div>
                <span>Default Teddy Bear</span>
              </button>
              <button
                type="button"
                onClick={() => set("logoUrl", store.logoUrl && store.logoUrl !== "teddy" ? store.logoUrl : "")}
                className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all flex flex-col items-center gap-1.5 ${
                  form.logoUrl !== "teddy" && form.logoUrl !== ""
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                    : "border-border hover:border-emerald-400 hover:bg-muted"
                }`}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0">🖼️</div>
                <span>Custom Uploaded Logo</span>
              </button>
            </div>
            {form.logoUrl && form.logoUrl !== "teddy" && (
              <div className="mt-2 text-[11px] text-muted-foreground">
                Using custom logo: <span className="font-mono text-emerald-600 truncate block max-w-xs">{form.logoUrl}</span>
              </div>
            )}
          </Field>

          <Field label="Header Layout Style" hint="Configure how the store name and branding are layered.">
            <div className="flex gap-2">
              {[
                { key: "split", label: "Split Line", desc: "Brand & Subtitle split" },
                { key: "single", label: "Single Row", desc: "Combined in one line" },
              ].map((layout) => (
                <button
                  key={layout.key}
                  type="button"
                  onClick={() => set("headerLayout", layout.key)}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${
                    form.headerLayout === layout.key
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                      : "border-border hover:border-emerald-400 hover:bg-muted"
                  }`}
                >
                  {layout.label}
                  <span className="block text-[10px] font-normal text-muted-foreground mt-0.5">
                    {layout.desc}
                  </span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Header Alignment" hint="Centered stacks the logo above the shop name. Compact puts the logo on the left with the name beside it — a shorter header that uses less paper.">
            <div className="flex gap-2">
              {[
                { key: "center", label: "Centered", desc: "Logo on top, name centered" },
                { key: "left",   label: "Compact (logo left)", desc: "Logo left, name beside it" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => set("headerAlign", opt.key)}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${
                    (form.headerAlign ?? "center") === opt.key
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                      : "border-border hover:border-emerald-400 hover:bg-muted"
                  }`}
                >
                  {opt.label}
                  <span className="block text-[10px] font-normal text-muted-foreground mt-0.5">
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Header Color Theme" hint="Toggle between clean high-contrast black-only or gold-accented styling.">
            <div className="flex gap-2">
              {[
                { key: "black", label: "Classic Black", desc: "Solid high-contrast black" },
                { key: "gold-navy", label: "Premium Gold-Navy", desc: "Gold highlights + Navy text" },
              ].map((theme) => (
                <button
                  key={theme.key}
                  type="button"
                  onClick={() => set("headerColorTheme", theme.key)}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${
                    form.headerColorTheme === theme.key
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                      : "border-border hover:border-emerald-400 hover:bg-muted"
                  }`}
                >
                  {theme.label}
                  <span className="block text-[10px] font-normal text-muted-foreground mt-0.5">
                    {theme.desc}
                  </span>
                </button>
              ))}
            </div>
          </Field>

          <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
            <div>
              <p className="text-xs font-bold">Show Ornaments & Lines</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                When enabled, premium top and bottom scrollwork dividers and accent lines are rendered.
              </p>
            </div>
            <button
              type="button"
              onClick={() => set("headerShowOrnaments", !form.headerShowOrnaments)}
              className={`ml-4 shrink-0 transition-colors ${form.headerShowOrnaments ? "text-emerald-600" : "text-muted-foreground"}`}
              aria-label="Toggle header ornaments"
            >
              {form.headerShowOrnaments
                ? <ToggleRight className="w-10 h-10" />
                : <ToggleLeft  className="w-10 h-10" />}
            </button>
          </div>

          <Field label="Shop Name (Brand) Font" hint="Select the font family used for the main shop name.">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FONT_OPTIONS.map((font) => (
                <button
                  key={font.id}
                  type="button"
                  onClick={() => set("headerBrandFontFamily", font.id)}
                  className={`py-2.5 px-2 rounded-xl border-2 text-xs font-bold transition-all truncate ${
                    form.headerBrandFontFamily === font.id
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                      : "border-border hover:border-emerald-400 hover:bg-muted"
                  }`}
                >
                  <span style={{ fontFamily: font.family }}>
                    {font.label}
                  </span>
                </button>
              ))}
            </div>
          </Field>

          {form.headerLayout === "split" && (
            <Field label="Subtitle Font Style" hint="Select the font family used for the category/subtitle text.">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {FONT_OPTIONS.map((font) => (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => set("headerSubtitleFontFamily", font.id)}
                    className={`py-2.5 px-2 rounded-xl border-2 text-xs font-bold transition-all truncate ${
                      form.headerSubtitleFontFamily === font.id
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                        : "border-border hover:border-emerald-400 hover:bg-muted"
                    }`}
                  >
                    <span style={{ fontFamily: font.family }}>
                      {font.label}
                    </span>
                  </button>
                ))}
              </div>
            </Field>
          )}

          <Field label="Tagline Font Style" hint="Select the font family used for the tagline message.">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FONT_OPTIONS.map((font) => (
                <button
                  key={font.id}
                  type="button"
                  onClick={() => set("headerTaglineFontFamily", font.id)}
                  className={`py-2.5 px-2 rounded-xl border-2 text-xs font-bold transition-all truncate ${
                    form.headerTaglineFontFamily === font.id
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                      : "border-border hover:border-emerald-400 hover:bg-muted"
                  }`}
                >
                  <span style={{ fontFamily: font.family }}>
                    {font.label}
                  </span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Address & Phone Font Style" hint="Select the font family used for the contact details at the bottom of the header.">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FONT_OPTIONS.map((font) => (
                <button
                  key={font.id}
                  type="button"
                  onClick={() => set("headerAddressPhoneFontFamily", font.id)}
                  className={`py-2.5 px-2 rounded-xl border-2 text-xs font-bold transition-all truncate ${
                    form.headerAddressPhoneFontFamily === font.id
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                      : "border-border hover:border-emerald-400 hover:bg-muted"
                  }`}
                >
                  <span style={{ fontFamily: font.family }}>
                    {font.label}
                  </span>
                </button>
              ))}
            </div>
          </Field>

          {/* Logo Size Control */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>Logo Print Size</span>
              <span className="text-[11px] text-muted-foreground font-mono">{form.headerLogoSize ?? 96} px</span>
            </div>
            <input
              type="range"
              min={40}
              max={150}
              step={4}
              value={form.headerLogoSize ?? 96}
              onChange={(e) => set("headerLogoSize", Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>

          {/* Font Sizes Controls */}
          <div className="space-y-3 pt-2 border-t">
            <p className="text-xs font-bold text-foreground">Advanced Typography Sizing (Receipt Font Sizes)</p>
            
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                <span>Shop Name Font Size</span>
                <span className="font-mono">{form.headerBrandFontSize ?? 28} px</span>
              </div>
              <input
                type="range"
                min={16}
                max={48}
                step={1}
                value={form.headerBrandFontSize ?? 28}
                onChange={(e) => set("headerBrandFontSize", Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            {form.headerLayout === "split" && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                  <span>Subtitle Font Size</span>
                  <span className="font-mono">{form.headerSubtitleFontSize ?? 25} px</span>
                </div>
                <input
                  type="range"
                  min={12}
                  max={36}
                  step={1}
                  value={form.headerSubtitleFontSize ?? 25}
                  onChange={(e) => set("headerSubtitleFontSize", Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
            )}

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                <span>Tagline Font Size</span>
                <span className="font-mono">{form.headerTaglineFontSize ?? 13} px</span>
              </div>
              <input
                type="range"
                min={10}
                max={20}
                step={1}
                value={form.headerTaglineFontSize ?? 13}
                onChange={(e) => set("headerTaglineFontSize", Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                <span>Address / Phone Font Size</span>
                <span className="font-mono">{form.headerAddressPhoneFontSize ?? 12} px</span>
              </div>
              <input
                type="range"
                min={9}
                max={16}
                step={1}
                value={form.headerAddressPhoneFontSize ?? 12}
                onChange={(e) => set("headerAddressPhoneFontSize", Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>
          </div>
        </Section>

        {/* ── Sidebar Header Theme ── */}
        <Section icon={Palette} title="Sidebar Header Theme" color="text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-950/30">
          <Field label="Background style" hint="The gradient behind your shop name in the sidebar. Click a swatch — preview updates above. Press Save to apply.">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(Object.keys(SIDEBAR_THEMES) as LogoBgTheme[]).map((key) => {
                const t = SIDEBAR_THEMES[key];
                const isActive = form.logoBgTheme === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set("logoBgTheme", key)}
                    className={`group relative rounded-xl overflow-hidden ring-2 transition-all text-left ${
                      isActive
                        ? "ring-primary scale-[1.02] shadow-md"
                        : "ring-border hover:ring-primary/50 hover:scale-[1.01]"
                    }`}
                    aria-pressed={isActive}
                  >
                    <div
                      className="h-12 w-full"
                      style={{ background: t.swatch }}
                      aria-hidden
                    />
                    <div className="px-2.5 py-1.5 bg-card flex items-center justify-between gap-1">
                      <span className="text-[11px] font-black truncate">{t.label}</span>
                      {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">
              The theme applies only to the sidebar's logo card. Bills, receipts, and other surfaces stay neutral.
            </p>
          </Field>
        </Section>

        {/* ── Customization (realtime, not save-gated) ──
         * Live toggles that update the UI instantly. Lives in its own section
         * because these don't go through the form/Save loop — every click
         * mutates the Zustand store directly and propagates to subscribers.
         */}
        <Section icon={Sparkles} title="Customization" color="text-rose-600 bg-rose-50 dark:bg-rose-950/30">
          <Field
            label="Bulb Laari (festival lights)"
            hint="Colourful blinking lights strung along the top of every page. Toggle applies instantly — no refresh."
          >
            <button
              type="button"
              role="switch"
              aria-checked={store.bulbLaariEnabled}
              onClick={() => store.update({ bulbLaariEnabled: !store.bulbLaariEnabled })}
              className={`group w-full flex items-center justify-between gap-3 p-3 rounded-xl border-2 transition-all active:scale-[0.99] ${
                store.bulbLaariEnabled
                  ? "border-rose-400 bg-gradient-to-br from-rose-50 to-amber-50 dark:from-rose-950/30 dark:to-amber-950/20 dark:border-rose-700"
                  : "border-border bg-muted/30 hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Mini bulb-row preview — same colours as the real laari */}
                <div className={`flex items-center gap-1 transition-opacity ${store.bulbLaariEnabled ? "opacity-100" : "opacity-30"}`}>
                  {["#ef4444", "#f59e0b", "#eab308", "#22c55e", "#3b82f6", "#ec4899"].map((c, i) => (
                    <span key={i} className="inline-block w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: c,
                        boxShadow: store.bulbLaariEnabled ? `0 0 6px 1px ${c}` : "none",
                      }} />
                  ))}
                </div>
                <div className="text-left min-w-0">
                  <p className={`text-sm font-black ${store.bulbLaariEnabled ? "text-rose-700 dark:text-rose-300" : "text-foreground"}`}>
                    {store.bulbLaariEnabled ? "Lights are ON" : "Lights are OFF"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {store.bulbLaariEnabled ? "Festive mode — perfect for festivals and weekends" : "Clean mode — no decoration"}
                  </p>
                </div>
              </div>
              {store.bulbLaariEnabled
                ? <ToggleRight className="w-8 h-8 text-rose-600 dark:text-rose-400 shrink-0" />
                : <ToggleLeft  className="w-8 h-8 text-muted-foreground shrink-0" />}
            </button>
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
          <Field
            label="GST Tax Rate (%)"
            hint="Treated as inclusive in product prices. Receipt splits this into CGST + SGST. Set 0 to hide the tax block from receipts."
          >
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={28}
                step={0.01}
                value={form.gstRatePercent || ""}
                onChange={(e) => {
                  const n = parseFloat(e.target.value);
                  setForm((f) => ({ ...f, gstRatePercent: Number.isFinite(n) ? Math.max(0, Math.min(28, n)) : 0 }));
                }}
                placeholder="0"
                className="w-full px-3 py-2.5 pr-9 rounded-xl border bg-muted/30 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground select-none">%</span>
            </div>
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

/**
 * Live miniature of the SideNav logo card — re-uses the same theme tokens
 * so what the owner sees in Settings is exactly what they'll get.
 */
function SidebarHeaderPreview({
  theme: themeKey,
  name,
  logoEmoji,
  logoUrl,
}: {
  theme: LogoBgTheme;
  name: string;
  logoEmoji: string;
  logoUrl: string;
}) {
  const t = getSidebarTheme(themeKey);
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <div className={`relative px-3.5 pt-2.5 pb-2.5 rounded-2xl overflow-hidden bg-gradient-to-br ${t.outer} text-white shadow-lg ring-1 ring-white/5`}>
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-px opacity-90"
          style={{ background: t.radial }}
        />
        <div className={`pointer-events-none absolute -top-12 -left-10 w-32 h-32 rounded-full ${t.blob1} blur-3xl`} />
        <div className={`pointer-events-none absolute -bottom-10 -right-8 w-28 h-28 rounded-full ${t.blob2} blur-3xl`} />
        <span aria-hidden className={`absolute top-2.5 right-3 ${t.sparkle} text-[9px]`}>✦</span>

        <div className="relative flex items-center gap-3">
          <div className="relative shrink-0">
            <div className={`absolute -inset-1 rounded-2xl bg-gradient-to-br ${t.glow} opacity-50 blur-md`} />
            <div className="relative w-9 h-9 rounded-xl bg-white/95 backdrop-blur flex items-center justify-center shadow-xl ring-1 ring-white/50">
              {logoUrl === "teddy" ? (
                <span className="text-lg leading-none drop-shadow-sm">🧸</span>
              ) : logoUrl ? (
                <img src={logoUrl} alt="" className="w-6 h-6 object-contain drop-shadow-sm" />
              ) : (
                <span className="text-lg leading-none drop-shadow-sm">{logoEmoji || "🏪"}</span>
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[12px] font-black tracking-tight leading-[1.2] text-white truncate">
              {name || "Your Shop Name"}
            </h1>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              <p className={`text-[9px] font-black tracking-[0.18em] uppercase truncate bg-gradient-to-r ${t.accentText} bg-clip-text text-transparent`}>
                AddisonX Media
              </p>
            </div>
          </div>
        </div>
      </div>
      <div aria-hidden className={`mt-1 mx-3 h-px bg-gradient-to-r from-transparent ${t.hairline} to-transparent`} />
    </div>
  );
}

function ReceiptHeaderPreview({
  logoUrl,
  logoEmoji,
  name,
  tagline,
  address,
  phone,
  email,
  layout,
  brandFontFamily,
  subtitleFontFamily,
  taglineFontFamily,
  addressPhoneFontFamily,
  brandFontSize,
  subtitleFontSize,
  taglineFontSize,
  addressPhoneFontSize,
  logoSize,
  colorTheme,
  showOrnaments,
  align,
}: {
  logoUrl: string;
  logoEmoji: string;
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  layout: "split" | "single";
  brandFontFamily: string;
  subtitleFontFamily: string;
  taglineFontFamily: string;
  addressPhoneFontFamily: string;
  brandFontSize: number;
  subtitleFontSize: number;
  taglineFontSize: number;
  addressPhoneFontSize: number;
  logoSize: number;
  colorTheme: "black" | "gold-navy";
  showOrnaments: boolean;
  align: "center" | "left";
}) {
  const textClr = colorTheme === "gold-navy" ? "#0a1c36" : "#000000";
  const accentClr = colorTheme === "gold-navy" ? "#c5a85a" : "#000000";

  const getFontFamilyCss = (font: string) => {
    switch (font) {
      case "Cinzel": return "'Cinzel', Georgia, serif";
      case "Playfair Display": return "'Playfair Display', Georgia, serif";
      case "Inter": return "'Inter', sans-serif";
      case "Courier New": return "'Courier New', monospace";
      case "Georgia": return "'Georgia', serif";
      case "Montserrat": return "'Montserrat', sans-serif";
      case "Lora": return "'Lora', serif";
      case "Rubik": return "'Rubik', sans-serif";
      case "Oswald": return "'Oswald', sans-serif";
      case "Sacramento": return "'Sacramento', cursive";
      case "Great Vibes": return "'Great Vibes', cursive";
      default: return "'Playfair Display', Georgia, serif";
    }
  };

  const brandFont = getFontFamilyCss(brandFontFamily);
  const subtitleFont = getFontFamilyCss(subtitleFontFamily);
  const taglineFont = getFontFamilyCss(taglineFontFamily);
  const addressPhoneFont = getFontFamilyCss(addressPhoneFontFamily);

  const isTaglineSans = taglineFontFamily.includes("Inter") || taglineFontFamily.includes("Courier") || taglineFontFamily.includes("Montserrat") || taglineFontFamily.includes("Rubik") || taglineFontFamily.includes("Oswald");

  const storeName = name || "Hira & Son Gift Shop";
  let mainName = storeName;
  let subName = tagline || "GIFT SHOP";

  if (layout === "split") {
    const giftShopRegex = /(.*?)\s*\b(gift\s+shop|gifts\s+shop|gift\s+store|gifts)\b/i;
    const match = storeName.match(giftShopRegex);
    if (match) {
      mainName = match[1].trim();
      subName = match[2].trim();
    }
  }

  const ampersandRegex = /(.*?)\s*([&]|and)\s*(.*)/i;
  const mainNameMatch = layout === "split" ? mainName : storeName;
  const ampMatch = mainNameMatch.match(ampersandRegex);
  let renderedName;
  if (ampMatch) {
    renderedName = (
      <>
        {ampMatch[1]} <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontWeight: "normal", fontSize: "1.15em", verticalAlign: "middle", color: accentClr }}>&amp;</span> {ampMatch[3]}
      </>
    );
  } else {
    renderedName = mainNameMatch;
  }

  if (align === "left") {
    return (
      <div className="border border-dashed border-muted-foreground/30 rounded-2xl overflow-hidden p-5 bg-white text-black max-w-[320px] mx-auto shadow-sm select-none">
        <div className="text-center font-bold text-[9px] text-muted-foreground uppercase tracking-widest mb-3 border-b pb-1">
          80 mm Preview Paper
        </div>
        <div>
          {/* Brand name — big banner across the full width, one line */}
          <div className="text-center" style={{ fontFamily: brandFont, fontWeight: 900, fontSize: `${Math.round(brandFontSize * 1.15)}px`, lineHeight: 1.05, letterSpacing: "0.04em", textTransform: "uppercase", color: textClr, whiteSpace: "nowrap" }}>
            {renderedName}
          </div>
          {/* Logo + sub-name centered just beneath */}
          <div className="flex items-center justify-center gap-2.5 -mt-1">
            <div className="shrink-0">
              {logoUrl === "teddy" ? (
                <svg style={{ height: `${logoSize * 0.55}px`, width: "auto", color: textClr }} viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="50" cy="50" r="30" />
                  <circle cx="23" cy="23" r="10" />
                  <circle cx="23" cy="23" r="5" fill="currentColor" />
                  <circle cx="77" cy="23" r="10" />
                  <circle cx="77" cy="23" r="5" fill="currentColor" />
                  <circle cx="38" cy="45" r="3" fill="currentColor" />
                  <circle cx="62" cy="45" r="3" fill="currentColor" />
                  <ellipse cx="50" cy="58" rx="8" ry="6" strokeWidth="2" />
                  <polygon points="50,54 46,58 54,58" fill="currentColor" />
                  <path d="M50,60 Q47,64 44,62 M50,60 Q53,64 56,62" />
                </svg>
              ) : logoUrl ? (
                <img src={logoUrl} alt="" className="object-contain" style={{ height: `${logoSize * 0.55}px`, maxWidth: "70px" }} />
              ) : (
                <div className="text-[22px]">{logoEmoji || "🧸"}</div>
              )}
            </div>
            {/* Sub-name + slogan stacked beside the logo (saves a full row) */}
            <div className="text-left">
              {layout === "split" && (
                <div style={{ fontFamily: subtitleFont, fontWeight: 900, fontSize: `${subtitleFontSize * 0.55}px`, lineHeight: 1.1, letterSpacing: "0.28em", textIndent: "0.28em", textTransform: "uppercase", color: textClr, whiteSpace: "nowrap" }}>
                  {subName}
                </div>
              )}
              <div style={{ fontFamily: taglineFont, fontStyle: isTaglineSans ? "normal" : "italic", fontSize: `${taglineFontSize * 0.78}px`, fontWeight: 600, color: textClr, letterSpacing: "0.03em", lineHeight: 1.15, whiteSpace: "nowrap" }}>
                {tagline || "The Complete Gift Store"}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-dashed border-muted-foreground/30 rounded-2xl overflow-hidden p-5 bg-white text-black max-w-[320px] mx-auto shadow-sm select-none">
      <div className="text-center font-bold text-[9px] text-muted-foreground uppercase tracking-widest mb-3 border-b pb-1">
        80 mm Preview Paper
      </div>

      <div className="text-center" style={{ padding: '0px 0' }}>
        {logoUrl === "teddy" ? (
          <svg className="mx-auto mb-1" style={{ height: `${logoSize * 0.7}px`, width: "auto", color: textClr }} viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="50" cy="50" r="30" />
            <circle cx="23" cy="23" r="10" />
            <circle cx="23" cy="23" r="5" fill="currentColor" />
            <circle cx="77" cy="23" r="10" />
            <circle cx="77" cy="23" r="5" fill="currentColor" />
            <circle cx="38" cy="45" r="3" fill="currentColor" />
            <circle cx="62" cy="45" r="3" fill="currentColor" />
            <ellipse cx="50" cy="58" rx="8" ry="6" strokeWidth="2" />
            <polygon points="50,54 46,58 54,58" fill="currentColor" />
            <path d="M50,60 Q47,64 44,62 M50,60 Q53,64 56,62" />
          </svg>
        ) : logoUrl ? (
          <img src={logoUrl} alt=""
               className="mx-auto object-contain mb-1"
               style={{ height: `${logoSize * 0.7}px`, maxWidth: "90px" }} />
        ) : (
          <div className="text-[24px] mb-1">{logoEmoji || "🧸"}</div>
        )}

        {showOrnaments && (
          <div className="flex justify-center mb-1 text-center" style={{ color: accentClr }}>
            <svg className="w-24 h-3" viewBox="0 0 120 12" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M10,6 H50 C54,6 56,2 60,6 C64,2 66,6 70,6 H110" strokeLinecap="round"/>
              <circle cx="60" cy="6" r="1" fill="currentColor"/>
              <path d="M57,6 C58,4 62,4 63,6" strokeLinecap="round"/>
              <polygon points="60,2 58,5 60,8 62,5" fill="currentColor"/>
            </svg>
          </div>
        )}

        <div
          style={{
            fontFamily: brandFont,
            fontWeight: 900,
            fontSize: `${brandFontSize * 0.75}px`,
            lineHeight: 1.05,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            color: textClr,
            whiteSpace: "nowrap",
          }}
        >
          {renderedName}
        </div>

        {layout === "split" && (
          <div className="flex items-center justify-center gap-2 mt-1" style={{ color: accentClr }}>
            {showOrnaments && (
              <div className="h-[1px] bg-current flex-1 max-w-[30px] relative">
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-0.5 bg-current rotate-45" />
              </div>
            )}
            <span
              style={{
                color: textClr,
                fontFamily: subtitleFont,
                fontWeight: 900,
                fontSize: `${subtitleFontSize * 0.75}px`,
                lineHeight: 1.05,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {subName}
            </span>
            {showOrnaments && (
              <div className="h-[1px] bg-current flex-1 max-w-[30px] relative">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-0.5 bg-current rotate-45" />
              </div>
            )}
          </div>
        )}

        {layout === "split" && showOrnaments && (
          <div className="flex items-center justify-center gap-1.5 my-1" style={{ color: accentClr }}>
            <svg className="w-10 h-2.5" style={{ transform: "scaleX(-1)" }} viewBox="0 0 60 16" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M0,8 H30 C38,8 42,14 46,14 C52,14 54,8 46,4 C40,0 34,8 44,10 C46,10.5 48,10 48,10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.5 7.2c-1-1.5-2.8-2.2-4-1.2-1.3 1.1-.8 3.1 1.2 3.8 1.8.6 2.8-2.6 2.8-2.6z" />
              <path d="M12.5 7.2c1-1.5 2.8-2.2 4-1.2 1.3 1.1.8 3.1-1.2 3.8-1.8.6-2.8-2.6-2.8-2.6z" />
              <circle cx="12" cy="7.5" r="1.2" fill="currentColor" />
              <path d="M 5 9 L 11.25 9 L 11.25 11.5 L 5 11.5 Z" />
              <path d="M 12.75 9 L 19 9 L 19 11.5 L 12.75 11.5 Z" />
              <path d="M 6 12.25 L 11.25 12.25 L 11.25 19 L 6 19 Z" />
              <path d="M 12.75 12.25 L 18 12.25 L 18 19 L 12.75 19 Z" />
            </svg>
            <svg className="w-10 h-2.5" viewBox="0 0 60 16" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M0,8 H30 C38,8 42,14 46,14 C52,14 54,8 46,4 C40,0 34,8 44,10 C46,10.5 48,10 48,10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        <div className="flex items-center justify-center gap-1.5 mt-1">
          {showOrnaments && <div className="h-[1px] flex-1 max-w-[20px]" style={{ background: `linear-gradient(to right, transparent, ${accentClr})` }} />}
          {showOrnaments && <span className="text-[7px]" style={{ color: accentClr }}>✦</span>}
          <span
            style={{
              fontFamily: taglineFont,
              fontStyle: isTaglineSans ? "normal" : 'italic',
              fontSize: `${taglineFontSize * 0.75}px`,
              fontWeight: 600,
              color: textClr,
              letterSpacing: '0.04em'
            }}
          >
            {tagline || "The Complete Gift Store"}
          </span>
          {showOrnaments && <span className="text-[7px]" style={{ color: accentClr }}>✦</span>}
          {showOrnaments && <div className="h-[1px] flex-1 max-w-[20px]" style={{ background: `linear-gradient(to left, transparent, ${accentClr})` }} />}
        </div>

        {showOrnaments && (
          <div className="flex justify-center mt-1.5 mb-1" style={{ color: accentClr }}>
            <svg className="w-24 h-3" viewBox="0 0 120 12" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M10,6 H50 C54,6 56,2 60,6 C64,2 66,6 70,6 H110" strokeLinecap="round"/>
              <circle cx="60" cy="6" r="1" fill="currentColor"/>
              <path d="M57,6 C58,4 62,4 63,6" strokeLinecap="round"/>
              <polygon points="60,2 58,5 60,8 62,5" fill="currentColor"/>
            </svg>
          </div>
        )}
      </div>

      <div className="text-center leading-snug mt-1.5 space-y-0.5 border-b border-dashed pb-2"
           style={{
             fontFamily: addressPhoneFont,
             fontSize: `${addressPhoneFontSize * 0.75}px`,
             color: textClr
           }}>
        {address && (
          <div className="flex items-center justify-center gap-1 px-1">
            <svg className="w-2.5 h-2.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <span className="font-semibold truncate">{address}</span>
          </div>
        )}
        {phone && (
          <div className="flex items-center justify-center gap-1">
            <svg className="w-2.5 h-2.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
            </svg>
            <span className="font-bold">Phone: {phone}</span>
          </div>
        )}
      </div>

      {/* Mock Receipt Item Table */}
      <div className="mt-2 text-[8px] font-mono leading-tight space-y-1">
        <div className="flex justify-between border-b pb-0.5">
          <span>Item</span>
          <span>Qty</span>
          <span>Amt</span>
        </div>
        <div className="flex justify-between">
          <span>🧸 TEDDY BEAR LARGE</span>
          <span>1</span>
          <span>₹799.00</span>
        </div>
        <div className="flex justify-between">
          <span>🎁 GIFT BOX SPECIAL</span>
          <span>1</span>
          <span>₹120.00</span>
        </div>
        <div className="flex justify-between border-t border-dashed pt-0.5 font-bold">
          <span>NET TOTAL</span>
          <span className="text-right">₹919.00</span>
        </div>
      </div>
    </div>
  );
}
