import { useEffect, useRef, useState } from "react";
import {
  ScanLine, Receipt, QrCode, Boxes, BarChart3, Sparkles,
  Check, X, ArrowRight, Star, Shield, Zap, Clock,
  ShoppingBag, Pill, Shirt, Gem, Smartphone, Wrench,
  PenTool, Heart, Menu, ChevronDown, MessageCircle,
  TrendingUp, IndianRupee, Headphones, Cpu,
  ArrowUpRight, Layers, Wifi, Cloud, Lock, BellRing,
  Activity, Box, Bot, Banknote, Hash,
} from "lucide-react";

const WHATSAPP_NUMBER = "919999999999";
const TRIAL_URL       = "https://billing.addisonxmedia.com";

/* ═══════════════════════════════════════════════════════════════
   NAV
═══════════════════════════════════════════════════════════════ */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#features", label: "Features" },
    { href: "#how",      label: "How it works" },
    { href: "#compare",  label: "vs Tally" },
    { href: "#pricing",  label: "Pricing" },
    { href: "#faq",      label: "FAQ" },
  ];

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "bg-ink-950/80 backdrop-blur-xl border-b border-white/5" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5 group">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-saffron-400 via-saffron-500 to-saffron-600 flex items-center justify-center text-white font-black shadow-lg shadow-saffron-500/40">
              <span className="text-lg font-display italic">A</span>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-volt-400 ring-2 ring-ink-950" />
          </div>
          <div className="leading-tight">
            <div className="font-black text-base text-white">AddisonX</div>
            <div className="text-[9px] font-black tracking-[0.2em] uppercase text-saffron-400 -mt-0.5">Billing OS</div>
          </div>
        </a>

        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <a key={l.href} href={l.href}
               className="px-3.5 py-2 rounded-full text-[13px] font-semibold text-white/70 hover:text-white hover:bg-white/5 transition-all">
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener"
             className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold text-volt-300 hover:bg-volt-500/10 transition-all">
            <MessageCircle className="w-3.5 h-3.5" />
            Talk to us
          </a>
          <a href={TRIAL_URL} target="_blank" rel="noopener"
             className="relative group px-4 py-2 rounded-full text-[13px] font-black text-ink-950 bg-white hover:bg-volt-300 transition-colors">
            <span className="flex items-center gap-1.5">
              Start Free Trial
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </a>
        </div>

        <button onClick={() => setOpen((v) => !v)}
                className="md:hidden w-9 h-9 rounded-xl bg-white/5 text-white flex items-center justify-center">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-ink-900/95 backdrop-blur-xl border-t border-white/5 px-4 py-3 space-y-1">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}
               className="block py-2.5 px-3 rounded-xl text-sm font-bold text-white/80 hover:bg-white/5">
              {l.label}
            </a>
          ))}
          <a href={TRIAL_URL} target="_blank" rel="noopener"
             className="block text-center mt-2 px-4 py-3 rounded-xl font-black text-ink-950 bg-white">
            Start Free Trial →
          </a>
        </div>
      )}
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HERO
═══════════════════════════════════════════════════════════════ */
function Hero() {
  const [tracked, setTracked] = useState(2_84_50_823);
  useEffect(() => {
    const id = setInterval(() => setTracked((n) => n + Math.floor(Math.random() * 950 + 50)), 1700);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="top" className="relative pt-32 md:pt-40 pb-24 overflow-hidden">
      {/* Spotlight + grid backdrop */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 dot-grid opacity-50" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120vw] h-[60vh] bg-[radial-gradient(ellipse_at_top,rgba(255,107,53,0.18),transparent_60%)]" />
        <div className="absolute top-1/3 left-0 w-[55vw] h-[55vw] rounded-full bg-saffron-500/15 blur-[120px] animate-float-orb" />
        <div className="absolute top-1/2 right-0 w-[45vw] h-[45vw] rounded-full bg-volt-500/10 blur-[120px] animate-float-orb" style={{ animationDelay: "-9s" }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8">

        {/* Eyebrow strip */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8 animate-fade-up">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.15em] glass text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-volt-400 animate-pulse" />
            Live · 247 shops billing right now
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.15em] glass text-white">
            🇮🇳 Made in Bharat
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-center font-black tracking-tight leading-[0.92] animate-fade-up" style={{ animationDelay: "60ms" }}>
          <span className="block text-5xl md:text-7xl lg:text-[7rem]">
            Bill faster. <span className="gradient-saffron">Stress less.</span>
          </span>
          <span className="block text-3xl md:text-5xl lg:text-6xl mt-3 text-white/70" style={{ fontFamily: "var(--font-hindi)" }}>
            दुकान चलाओ, <span className="gradient-shimmer animate-shimmer-text">सॉफ्टवेयर नहीं</span>।
          </span>
        </h1>

        {/* Sub */}
        <p className="mt-7 text-center text-base md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed animate-fade-up" style={{ animationDelay: "140ms" }}>
          The cloud billing OS that runs your kirana, gift shop, or pharmacy.
          <br className="hidden md:inline" />
          <span className="text-white/80 font-semibold">5-second bills · GST invoices · UPI QR · Live stock · WhatsApp reports.</span>
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 animate-fade-up" style={{ animationDelay: "220ms" }}>
          <a href={TRIAL_URL} target="_blank" rel="noopener"
             className="group relative inline-flex items-center gap-2 px-6 py-4 rounded-full font-black text-ink-950 bg-white hover:bg-volt-300 transition-colors text-base animate-glow-pulse">
            <Sparkles className="w-5 h-5" />
            <span>Start 14-day Free Trial</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </a>
          <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=AddisonX%20demo%20चाहिए`} target="_blank" rel="noopener"
             className="inline-flex items-center gap-2 px-5 py-4 rounded-full font-bold text-white glass glass-hover transition-all">
            <MessageCircle className="w-5 h-5 text-volt-400" />
            Book WhatsApp Demo
          </a>
        </div>

        {/* Trust micro-line */}
        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-white/40 animate-fade-up" style={{ animationDelay: "300ms" }}>
          <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-volt-400" /> No credit card</div>
          <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-volt-400" /> Cancel anytime</div>
          <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-volt-400" /> Setup in 5 min</div>
        </div>

        {/* Big mockup card */}
        <div className="mt-16 relative animate-fade-up" style={{ animationDelay: "380ms" }}>
          <DashboardMockup tracked={tracked} />
        </div>
      </div>
    </section>
  );
}

function DashboardMockup({ tracked }: { tracked: number }) {
  return (
    <div className="relative max-w-5xl mx-auto" style={{ perspective: "1800px" }}>
      {/* Floating accent badges around the laptop */}
      <div className="absolute -top-4 -left-2 md:-left-12 z-30 glass rounded-2xl px-3 py-2 animate-float-y">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-saffron-500 flex items-center justify-center text-white">
            <ScanLine className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="font-black text-white">SCAN</div>
            <div className="text-white/50 text-[10px]">3.2s avg</div>
          </div>
        </div>
      </div>

      <div className="absolute top-8 right-0 md:-right-10 z-30 glass rounded-2xl px-3 py-2 animate-float-y" style={{ animationDelay: "-2s" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-volt-500 flex items-center justify-center text-ink-950">
            <QrCode className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="font-black text-white">UPI</div>
            <div className="text-white/50 text-[10px]">Auto-QR</div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-2 left-1/4 z-30 glass rounded-2xl px-3 py-2 animate-float-y" style={{ animationDelay: "-1s" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-violet-500 flex items-center justify-center text-white">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="font-black text-white">Live</div>
            <div className="text-white/50 text-[10px]">Daily report</div>
          </div>
        </div>
      </div>

      {/* ── White Laptop ────────────────────────────────────── */}
      <div
        className="relative mx-auto"
        style={{ transform: "rotateX(6deg)", transformStyle: "preserve-3d" }}
      >
        {/* Lid / screen housing */}
        <div className="relative rounded-[28px] p-3 md:p-4 bg-gradient-to-b from-white to-slate-100 shadow-[0_50px_120px_-30px_rgba(0,0,0,0.55)] ring-1 ring-slate-200">
          {/* Camera dot on top bezel */}
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-400/80" />
            <div className="text-[8px] font-bold tracking-[0.2em] text-slate-400 uppercase">AddisonX</div>
          </div>

          {/* Screen */}
          <div className="mt-4 rounded-[18px] bg-white overflow-hidden border border-slate-200 shadow-inner">
            {/* Browser chrome (light) */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 bg-slate-50">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="mx-auto px-3 py-1 rounded-full bg-white border border-slate-200 text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-emerald-500" />
                billing.addisonxmedia.com
              </div>
              <div className="w-12" />
            </div>

            {/* Body — bento style (light) */}
            <div className="p-4 md:p-6 grid grid-cols-12 gap-3 md:gap-4 bg-gradient-to-br from-white via-slate-50 to-white">

              {/* Big sale tile */}
              <div className="col-span-12 md:col-span-7 rounded-2xl bg-gradient-to-br from-saffron-50 to-white border border-saffron-200/70 p-5 relative overflow-hidden shadow-sm">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-saffron-400 to-transparent animate-scan-line" />
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-[10px] font-black tracking-widest uppercase text-saffron-600">Today's Sales</div>
                    <div className="mt-1 text-3xl md:text-4xl font-black tabular-nums text-slate-900">
                      ₹{tracked.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-100">
                    <TrendingUp className="w-3.5 h-3.5" />
                    +24%
                  </div>
                </div>
                {/* Mini bar chart */}
                <div className="flex items-end gap-1.5 h-16 mt-3">
                  {[35, 55, 40, 70, 50, 85, 60, 75, 90, 55, 80, 95].map((h, i) => (
                    <div key={i} className="flex-1 bg-gradient-to-t from-saffron-500 to-saffron-300 rounded-t"
                         style={{ height: `${h}%` }} />
                  ))}
                </div>
                <div className="flex justify-between mt-1 text-[8px] font-bold text-slate-400">
                  <span>00</span><span>02</span><span>04</span><span>06</span><span>08</span><span>10</span><span>12</span><span>14</span><span>16</span><span>18</span><span>20</span><span>22</span>
                </div>
              </div>

              {/* Bills count */}
              <div className="col-span-6 md:col-span-5 rounded-2xl bg-white border border-slate-200 p-5 flex flex-col justify-between shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-black tracking-widest uppercase text-slate-500">Bills</div>
                  <div className="w-7 h-7 rounded-lg bg-volt-100 flex items-center justify-center">
                    <Receipt className="w-4 h-4 text-volt-700" />
                  </div>
                </div>
                <div>
                  <div className="text-4xl md:text-5xl font-black tabular-nums text-slate-900">134</div>
                  <div className="text-xs text-slate-500 mt-1">vs 108 yesterday</div>
                </div>
              </div>

              {/* Recent bill row */}
              <div className="col-span-12 rounded-2xl bg-white border border-slate-200 p-3 md:p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-3.5 h-3.5 text-emerald-500" />
                  <div className="text-[10px] font-black tracking-widest uppercase text-slate-500">Live Bills</div>
                  <div className="ml-auto text-[10px] text-slate-400">just now</div>
                </div>
                <div className="space-y-2">
                  {[
                    { name: "Coffee Mug + Teddy Bear",  amt: "₹449",   t: "2s ago",  p: "UPI" },
                    { name: "Stationery Bundle",        amt: "₹275",   t: "9s ago",  p: "CASH" },
                    { name: "Wooden Wind Chime",        amt: "₹598",   t: "23s ago", p: "UPI" },
                  ].map((b, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      <div className="w-1 h-8 rounded-full bg-gradient-to-b from-saffron-500 to-saffron-700" />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 truncate">{b.name}</div>
                        <div className="text-slate-400 text-[10px]">{b.t}</div>
                      </div>
                      <div className={`text-[9px] font-black px-2 py-0.5 rounded-full ${b.p === "UPI" ? "bg-volt-100 text-volt-700" : "bg-slate-100 text-slate-600"}`}>{b.p}</div>
                      <div className="font-black tabular-nums text-slate-900 text-sm w-16 text-right">{b.amt}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hinge / base of the laptop */}
        <div className="relative mx-auto -mt-1">
          {/* Hinge slot */}
          <div className="mx-auto h-2 w-[94%] rounded-b-2xl bg-gradient-to-b from-slate-200 to-slate-300" />
          {/* Base deck */}
          <div className="relative mx-auto h-4 md:h-5 w-[102%] -ml-[1%] rounded-b-[28px] bg-gradient-to-b from-slate-100 via-white to-slate-200 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.45)] ring-1 ring-slate-200">
            {/* Trackpad notch */}
            <div className="absolute left-1/2 top-0 -translate-x-1/2 w-24 md:w-32 h-1.5 rounded-b-xl bg-slate-300/80" />
          </div>
        </div>

        {/* Soft floor reflection */}
        <div className="mx-auto mt-2 h-6 w-[80%] rounded-[50%] bg-black/40 blur-2xl opacity-50" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LOGO MARQUEE
═══════════════════════════════════════════════════════════════ */
function LogoMarquee() {
  const shops = [
    "Hira & Sons", "Sharma Kirana", "Mina Gift Shop", "Mukti Stationery",
    "Patel Medical", "Singh Cosmetics", "Royal Hardware", "Krishna Footwear",
    "Joy Bookstore", "Modern Mobile", "Anand Toys", "Bhagat Pharmacy",
  ];
  return (
    <section className="border-y border-white/5 py-10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 md:px-8 mb-6">
        <p className="text-center text-[10px] font-black tracking-[0.3em] uppercase text-white/30">
          Powering 100+ shops across India
        </p>
      </div>
      <div className="marquee gap-12 text-white/30">
        {[...shops, ...shops].map((s, i) => (
          <div key={i} className="font-display text-2xl whitespace-nowrap italic">{s}</div>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FEATURES (BENTO GRID)
═══════════════════════════════════════════════════════════════ */
function Features() {
  return (
    <section id="features" className="py-24 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="text-center mb-16">
          <p className="inline-block text-[10px] font-black uppercase tracking-[0.3em] text-saffron-400 mb-4">Capabilities</p>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[0.95]">
            Every tool a <span className="gradient-saffron">shopkeeper</span><br />
            actually needs.
          </h2>
          <p className="mt-5 text-white/50 max-w-xl mx-auto" style={{ fontFamily: "var(--font-hindi)" }}>
            जो चाहिए, सब है। जो नहीं चाहिए, वो नहीं।
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-12 gap-4 md:gap-5">
          {/* Big feature — Scan billing */}
          <FeatureCard
            className="col-span-12 md:col-span-7 lg:col-span-8 row-span-2 md:p-8"
            Icon={ScanLine}
            iconColor="text-saffron-400"
            iconBg="bg-saffron-500/10"
            title="3-second billing"
            hindi="3 सेकंड में बिल"
            desc="USB scanner, phone camera, or type the SKU — cart updates instantly. No 'loading'. No 'syncing'. Just bill, print, done."
            badge="MOST LOVED"
            big
          >
            <div className="mt-6 rounded-xl bg-white/5 border border-white/5 p-3 font-mono text-xs">
              <div className="flex items-center gap-2 mb-2 text-white/40 text-[10px]">
                <div className="w-1.5 h-1.5 rounded-full bg-volt-400 animate-pulse" />
                terminal
              </div>
              <div className="text-white/70">$ scan <span className="text-saffron-300">TB-035</span></div>
              <div className="text-volt-400">→ Kuromi Big · ₹1,050 · added</div>
              <div className="text-white/70 mt-1">$ scan <span className="text-saffron-300">M-002</span></div>
              <div className="text-volt-400">→ Yellow Coffee Mug · ₹550 · added</div>
              <div className="text-white/70 mt-1">$ checkout<span className="animate-blink">_</span></div>
            </div>
          </FeatureCard>

          {/* GST */}
          <FeatureCard
            className="col-span-6 md:col-span-5 lg:col-span-4"
            Icon={Receipt}
            iconColor="text-volt-400"
            iconBg="bg-volt-500/10"
            title="GST Invoices"
            hindi="GST बिल प्रिंट"
            desc="Auto-split CGST + SGST. HSN codes. 80mm thermal print-ready."
          />

          {/* UPI QR */}
          <FeatureCard
            className="col-span-6 md:col-span-5 lg:col-span-4"
            Icon={QrCode}
            iconColor="text-violet-400"
            iconBg="bg-violet-500/10"
            title="UPI QR on every bill"
            hindi="UPI QR हर बिल पर"
            desc="Customer scans, amount pre-filled. Money in your account in seconds."
          />

          {/* Stock */}
          <FeatureCard
            className="col-span-12 md:col-span-7 lg:col-span-4"
            Icon={Boxes}
            iconColor="text-saffron-400"
            iconBg="bg-saffron-500/10"
            title="Stock auto-updates"
            hindi="Stock अपने आप घटे"
            desc="Sold → stock −1. Low-stock alert in WhatsApp."
          />

          {/* Reports */}
          <FeatureCard
            className="col-span-6 md:col-span-7 lg:col-span-5"
            Icon={BarChart3}
            iconColor="text-volt-400"
            iconBg="bg-volt-500/10"
            title="Daily report on Telegram"
            hindi="रिपोर्ट जो ज़रूरी है"
            desc="9pm sharp — your phone vibrates with today's sales, top sellers, profit margin."
          />

          {/* Today's Deal */}
          <FeatureCard
            className="col-span-6 md:col-span-5 lg:col-span-3"
            Icon={Sparkles}
            iconColor="text-saffron-400"
            iconBg="bg-saffron-500/10"
            title="Today's Deal"
            hindi="One-tap discount"
            desc="One tap to put a product on sale. Instant."
          />

          {/* Offline / cloud / WhatsApp */}
          <FeatureCard
            className="col-span-12 md:col-span-4 lg:col-span-4"
            Icon={Wifi}
            iconColor="text-volt-400"
            iconBg="bg-volt-500/10"
            title="Works offline"
            hindi="Internet गया? चलता रहेगा।"
            desc="Bills queue locally, auto-sync when internet returns."
          />

          <FeatureCard
            className="col-span-6 md:col-span-4"
            Icon={Cloud}
            iconColor="text-violet-400"
            iconBg="bg-violet-500/10"
            title="Cloud-synced"
            hindi="हर device पर"
            desc="Phone, laptop, tablet — same data, instant."
          />

          <FeatureCard
            className="col-span-6 md:col-span-4"
            Icon={Lock}
            iconColor="text-saffron-400"
            iconBg="bg-saffron-500/10"
            title="Bank-grade security"
            hindi="Data सुरक्षित"
            desc="Encrypted at rest + in transit. Indian servers."
          />
        </div>
      </div>
    </section>
  );
}

interface FeatureCardProps {
  Icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  title: string;
  hindi: string;
  desc: string;
  className?: string;
  big?: boolean;
  badge?: string;
  children?: React.ReactNode;
}
function FeatureCard({ Icon, iconColor, iconBg, title, hindi, desc, className = "", big = false, badge, children }: FeatureCardProps) {
  return (
    <div className={`relative group rounded-3xl glass glass-hover transition-all p-5 md:p-6 overflow-hidden ${className}`}>
      {badge && (
        <span className="absolute top-4 right-4 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-saffron-500/20 text-saffron-300 border border-saffron-500/30">
          {badge}
        </span>
      )}
      <div className={`w-11 h-11 rounded-2xl ${iconBg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <h3 className={`font-black tracking-tight ${big ? "text-2xl md:text-3xl" : "text-lg md:text-xl"}`}>{title}</h3>
      <p className="text-xs font-bold text-saffron-300/80 mt-0.5" style={{ fontFamily: "var(--font-hindi)" }}>{hindi}</p>
      <p className={`mt-3 text-white/55 leading-relaxed ${big ? "text-base" : "text-sm"}`}>{desc}</p>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HOW IT WORKS — 3 STEP
═══════════════════════════════════════════════════════════════ */
function HowItWorks() {
  const steps = [
    {
      n: "01",
      Icon: ScanLine,
      title: "Scan",
      hindi: "Add to cart",
      desc: "Bar code, camera, or type. Product flies into cart in milliseconds.",
    },
    {
      n: "02",
      Icon: Banknote,
      title: "Get paid",
      hindi: "Cash या UPI",
      desc: "UPI QR auto-generated. Customer pays, you get a ping.",
    },
    {
      n: "03",
      Icon: Bot,
      title: "We handle the rest",
      hindi: "बाकी सब छोड़ो",
      desc: "Stock −1, GST entries, daily report, customer DB — all automatic.",
    },
  ];
  return (
    <section id="how" className="py-24 md:py-32 relative">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 dot-grid opacity-30" />
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <div className="text-center mb-16">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-saffron-400 mb-4">How it works</p>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.95]">
            Three steps to <span className="gradient-saffron">a full day sorted.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5 md:gap-6">
          {steps.map((s, i) => (
            <div key={s.n} className="group relative glass rounded-3xl p-6 md:p-8 overflow-hidden hover:-translate-y-1 transition-transform"
                 style={{ animation: `fade-up 0.8s ${i * 100}ms backwards` }}>
              <div className="absolute -top-8 -right-8 text-9xl font-black text-white/[0.03] select-none">{s.n}</div>
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-saffron-500/10 text-saffron-400 flex items-center justify-center mb-5 group-hover:bg-saffron-500 group-hover:text-ink-950 transition-colors">
                  <s.Icon className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono text-white/30">{s.n}</span>
                  <span className="w-8 h-px bg-white/15" />
                </div>
                <h3 className="text-2xl font-black">{s.title}</h3>
                <p className="text-xs font-bold text-saffron-300 mt-0.5" style={{ fontFamily: "var(--font-hindi)" }}>{s.hindi}</p>
                <p className="mt-3 text-sm text-white/55 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   INDUSTRIES
═══════════════════════════════════════════════════════════════ */
function Industries() {
  const shops = [
    { Icon: ShoppingBag, name: "Kirana / General",  hindi: "किराना" },
    { Icon: Heart,       name: "Gift & Toys",        hindi: "गिफ्ट शॉप" },
    { Icon: Smartphone,  name: "Mobile & Accessories", hindi: "मोबाइल" },
    { Icon: PenTool,     name: "Stationery",         hindi: "स्टेशनरी" },
    { Icon: Gem,         name: "Cosmetics & Beauty", hindi: "कॉस्मेटिक्स" },
    { Icon: Wrench,      name: "Hardware",            hindi: "हार्डवेयर" },
    { Icon: Shirt,       name: "Footwear & Fashion",  hindi: "कपड़े जूते" },
    { Icon: Pill,        name: "Pharmacy",            hindi: "मेडिकल" },
  ];
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="text-center mb-14">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-saffron-400 mb-4">Who it's for</p>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.95]">
            Built for <span className="gradient-saffron">your dukaan.</span>
          </h2>
          <p className="mt-4 text-white/50 max-w-xl mx-auto">
            Any retail shop where speed at the counter matters more than spreadsheet wizardry.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {shops.map((s, i) => (
            <div key={i} className="group glass glass-hover rounded-2xl p-4 md:p-5 text-center hover:-translate-y-1 transition-all"
                 style={{ animation: `fade-up 0.6s ${i * 50}ms backwards` }}>
              <div className="w-12 h-12 mx-auto rounded-2xl bg-saffron-500/10 text-saffron-400 flex items-center justify-center group-hover:bg-saffron-500 group-hover:text-ink-950 group-hover:rotate-6 transition-all">
                <s.Icon className="w-6 h-6" />
              </div>
              <p className="font-black text-sm mt-3 text-white">{s.name}</p>
              <p className="text-[11px] font-bold text-saffron-300/70 mt-0.5" style={{ fontFamily: "var(--font-hindi)" }}>{s.hindi}</p>
            </div>
          ))}
        </div>

        <p className="text-center mt-10 text-sm text-white/50">
          Restaurant, salon, jewellery, or पेट्रोल पंप भी? <a href={`https://wa.me/${WHATSAPP_NUMBER}`} className="font-black text-saffron-400 hover:underline">Talk to us →</a>
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COMPARISON
═══════════════════════════════════════════════════════════════ */
function Comparison() {
  const rows = [
    { feat: "Barcode bill in 3 seconds",          a: true, t: false },
    { feat: "UPI QR built into checkout",         a: true, t: false },
    { feat: "Same login on phone + desktop",      a: true, t: false },
    { feat: "One-tap Today's Deal",               a: true, t: false },
    { feat: "Daily Telegram / WhatsApp reports",  a: true, t: false },
    { feat: "Stock auto-decrement",                a: true, t: "limited" },
    { feat: "GST returns / Accounting exports",    a: true, t: true },
  ];
  return (
    <section id="compare" className="py-24 md:py-32 relative">
      <div className="max-w-5xl mx-auto px-4 md:px-8">
        <div className="text-center mb-14">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-saffron-400 mb-4">vs Tally / Vyapar</p>
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-black leading-[1.05]">
            <span className="text-white/30">Tally is for accountants.</span><br />
            <span className="gradient-saffron">AddisonX is for you.</span>
          </h2>
        </div>

        <div className="rounded-3xl glass overflow-hidden conic-border">
          {/* Header */}
          <div className="grid grid-cols-[1.4fr_1fr_1fr] text-[11px] md:text-sm font-black uppercase tracking-wider">
            <div className="p-4 md:p-5 text-white/50">Feature</div>
            <div className="p-4 md:p-5 text-center bg-gradient-to-br from-saffron-500 to-saffron-600 text-white relative">
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-volt-400 text-ink-950 text-[9px] rounded-full font-black animate-badge-bounce whitespace-nowrap">
                ✦ RECOMMENDED
              </span>
              AddisonX
            </div>
            <div className="p-4 md:p-5 text-center text-white/40">Tally / Vyapar</div>
          </div>

          {rows.map((r, i) => (
            <div key={i} className={`grid grid-cols-[1.4fr_1fr_1fr] text-sm border-t border-white/5 ${i % 2 === 0 ? "" : "bg-white/[0.02]"}`}>
              <div className="p-4 md:p-5 font-semibold text-white/80">{r.feat}</div>
              <div className="p-4 md:p-5 text-center">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-volt-500 text-ink-950">
                  <Check className="w-4 h-4" strokeWidth={3} />
                </span>
              </div>
              <div className="p-4 md:p-5 text-center">
                {r.t === true ? (
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/10 text-white/60">
                    <Check className="w-4 h-4" />
                  </span>
                ) : r.t === false ? (
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-500/15 text-red-400">
                    <X className="w-4 h-4" />
                  </span>
                ) : (
                  <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-400">limited</span>
                )}
              </div>
            </div>
          ))}

          {/* Built-for */}
          <div className="grid grid-cols-[1.4fr_1fr_1fr] text-sm border-t border-white/5">
            <div className="p-4 md:p-5 font-black uppercase text-[11px] tracking-wider text-white/40">Built for</div>
            <div className="p-4 md:p-5 text-center font-black text-saffron-300">Shopkeepers</div>
            <div className="p-4 md:p-5 text-center font-black text-white/30">CAs / Accountants</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PRICING
═══════════════════════════════════════════════════════════════ */
function Pricing() {
  return (
    <section id="pricing" className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/2 -left-20 w-80 h-80 rounded-full bg-saffron-500/15 blur-[120px] animate-float-orb" />
        <div className="absolute top-1/2 -right-20 w-80 h-80 rounded-full bg-volt-500/10 blur-[120px] animate-float-orb" style={{ animationDelay: "-9s" }} />
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <div className="text-center mb-14">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-saffron-400 mb-4">Pricing</p>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-black leading-[0.95]">
            One price. <span className="gradient-saffron">No hidden charges.</span>
          </h2>
          <p className="mt-5 text-white/50 max-w-xl mx-auto" style={{ fontFamily: "var(--font-hindi)" }}>
            Honest pricing. कोई छुपा charge नहीं। Cancel anytime.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">

          {/* Free Trial */}
          <div className="relative glass rounded-3xl p-7 md:p-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/5 text-white/60 mb-5">
              <Sparkles className="w-3 h-3" /> Free Trial
            </div>
            <h3 className="text-2xl font-black">Try before you commit</h3>
            <p className="text-sm text-white/50 mt-1" style={{ fontFamily: "var(--font-hindi)" }}>पहले try करो, बाद में decide</p>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-6xl md:text-7xl font-black tabular-nums">14</span>
              <span className="text-2xl font-bold text-white/60">days</span>
            </div>
            <p className="text-sm text-white/50 mt-1">No credit card required.</p>

            <ul className="mt-7 space-y-2.5 text-sm">
              {[
                "Unlimited products + bills",
                "GST invoice + UPI QR",
                "Stock auto-update",
                "Email + WhatsApp support",
                "All features ON",
              ].map((p, i) => (
                <li key={i} className="flex items-start gap-2.5 text-white/75">
                  <Check className="w-4 h-4 text-volt-400 mt-0.5 shrink-0" strokeWidth={3} />
                  <span>{p}</span>
                </li>
              ))}
            </ul>

            <a href={TRIAL_URL} target="_blank" rel="noopener"
               className="mt-8 inline-flex w-full items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-black text-white bg-white/10 border border-white/10 hover:bg-white/15 transition-all">
              Start free <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Paid */}
          <div className="relative rounded-3xl bg-gradient-to-br from-saffron-500 via-saffron-500 to-saffron-700 text-white overflow-hidden shadow-2xl shadow-saffron-500/40 p-7 md:p-8">
            <div className="absolute top-0 left-0 right-0 h-px bg-white/30" />
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute inset-0 opacity-10"
                 style={{
                   backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 1px)",
                   backgroundSize: "20px 20px",
                 }} />

            <div className="relative">
              <div className="flex items-center gap-2 mb-5">
                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-ink-950 text-volt-300">★ Bestseller</span>
                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 backdrop-blur">1 Year</span>
              </div>
              <h3 className="text-2xl font-black">Pro · annual</h3>
              <p className="text-sm opacity-80 mt-1" style={{ fontFamily: "var(--font-hindi)" }}>90% shopkeepers इसी पर हैं</p>

              <div className="mt-6 flex items-baseline gap-3">
                <span className="text-lg line-through opacity-50 tabular-nums">₹14,999</span>
                <div className="flex items-baseline">
                  <span className="text-6xl md:text-7xl font-black tabular-nums">₹9,999</span>
                </div>
                <span className="text-sm font-bold opacity-80">/year</span>
              </div>
              <p className="text-sm opacity-90 mt-1.5">
                ≈ <strong>₹833/month</strong> · ₹27/day · <span style={{ fontFamily: "var(--font-hindi)" }}>एक चाय की कीमत</span>
              </p>

              <ul className="mt-7 space-y-2.5 text-sm">
                {[
                  "Everything in Free Trial",
                  "Telegram + WhatsApp daily reports",
                  "Today's Deal + customer database",
                  "Multi-staff with PIN logins",
                  "Priority support (avg 12-min reply)",
                  "Free onboarding call (Hindi/English)",
                ].map((p, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={3} />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>

              <a href={TRIAL_URL} target="_blank" rel="noopener"
                 className="mt-8 inline-flex w-full items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-black text-saffron-700 bg-white hover:bg-volt-300 transition-colors">
                Get started <ArrowRight className="w-4 h-4" />
              </a>

              <p className="text-[11px] text-center opacity-80 mt-3.5">
                ✓ 14-day free trial first · ✓ Pro-rata refund · ✓ Cancel anytime
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TESTIMONIAL
═══════════════════════════════════════════════════════════════ */
function Testimonial() {
  return (
    <section className="py-24 md:py-32 relative">
      <div className="max-w-4xl mx-auto px-4 md:px-8">
        <div className="rounded-3xl glass p-8 md:p-12 text-center relative overflow-hidden conic-border">
          <div className="absolute top-4 left-4 text-7xl text-white/[0.04] font-display italic select-none">"</div>
          <div className="absolute bottom-4 right-8 text-7xl text-white/[0.04] font-display italic select-none">"</div>

          <div className="flex justify-center gap-1 mb-6 relative">
            {[1,2,3,4,5].map(i => <Star key={i} className="w-5 h-5 fill-saffron-400 text-saffron-400" />)}
          </div>
          <blockquote className="text-2xl md:text-4xl font-black leading-tight relative" style={{ fontFamily: "var(--font-hindi)" }}>
            "हमारा cashier सालों से Tally पर था. <span className="gradient-saffron">2 दिन में AddisonX सीख गया.</span> अब वापस नहीं जाएगा."
          </blockquote>
          <div className="mt-8 inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-saffron-400 to-saffron-600 flex items-center justify-center font-black text-ink-950">
              SK
            </div>
            <div className="text-left">
              <p className="font-black text-sm">Sharma Kirana Store</p>
              <p className="text-xs text-white/50">Indore · 4 months on AddisonX</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FAQ
═══════════════════════════════════════════════════════════════ */
function FAQ() {
  const faqs = [
    {
      q: "Do I have to install anything?",
      qh: "क्या install करना पड़ेगा?",
      a: "Nothing. AddisonX runs in your browser — Chrome, Edge, Safari, or mobile. Open the link, log in, start billing. कुछ install नहीं करना।",
    },
    {
      q: "What hardware do I need?",
      qh: "क्या hardware चाहिए?",
      a: "Minimum: an Android phone or any laptop. Recommended: 80mm thermal printer + USB barcode scanner. हम बता देंगे क्या खरीदना है — total under ₹6,000.",
    },
    {
      q: "What if internet goes down?",
      qh: "Internet नहीं हो तो?",
      a: "Offline mode kicks in automatically — bills queue locally and auto-sync the moment internet returns. Your shop never stops.",
    },
    {
      q: "Is my data safe?",
      qh: "मेरा data safe है?",
      a: "Bank-grade encryption (at rest + in transit), daily backups, Indian servers. We literally can't access your data — neither can anyone else.",
    },
    {
      q: "Will you help me with GST setup?",
      qh: "GST setup में help मिलेगी?",
      a: "Free onboarding call (Hindi/English). We set up your GSTIN, HSN codes, opening stock — सब हम कर देंगे।",
    },
    {
      q: "What if I want to cancel?",
      qh: "Cancel करना हो तो?",
      a: "One click. Pro-rata refund. No 'cancellation fee'. We'll even export your data as CSV so you can take it anywhere.",
    },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-24 md:py-32">
      <div className="max-w-3xl mx-auto px-4 md:px-8">
        <div className="text-center mb-14">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-saffron-400 mb-4">FAQ</p>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.95]">
            Questions before <span className="gradient-saffron">you start.</span>
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((f, i) => (
            <div key={i} className="glass rounded-2xl overflow-hidden">
              <button onClick={() => setOpen(open === i ? null : i)}
                      className="w-full flex items-start justify-between gap-4 p-5 text-left">
                <div className="flex-1">
                  <div className="font-black text-base">{f.q}</div>
                  <div className="text-xs font-bold text-saffron-300/70 mt-1" style={{ fontFamily: "var(--font-hindi)" }}>{f.qh}</div>
                </div>
                <ChevronDown className={`w-5 h-5 text-saffron-400 shrink-0 transition-transform ${open === i ? "rotate-180" : ""}`} />
              </button>
              {open === i && (
                <div className="px-5 pb-5 text-sm text-white/65 leading-relaxed border-t border-white/5 pt-4">
                  {f.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FINAL CTA
═══════════════════════════════════════════════════════════════ */
function FinalCTA() {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 md:px-8">
        <div className="rounded-[2.5rem] bg-gradient-to-br from-saffron-500 via-saffron-600 to-saffron-700 p-10 md:p-16 text-center relative overflow-hidden shadow-2xl shadow-saffron-500/30">
          {/* Decoration */}
          <div className="absolute inset-0 opacity-15"
               style={{
                 backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 1px)",
                 backgroundSize: "24px 24px",
               }} />
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-volt-400/15 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-volt-400/15 blur-3xl" />

          <div className="relative text-white">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-ink-950 text-volt-300 mb-6 animate-badge-bounce">
              <Sparkles className="w-3.5 h-3.5" />
              14-day free trial · no credit card
            </div>
            <h2 className="text-5xl md:text-7xl lg:text-8xl font-black leading-[0.95]">
              Run your shop.<br />
              <span className="text-volt-300" style={{ fontFamily: "var(--font-hindi)" }}>हम सब handle करेंगे.</span>
            </h2>
            <p className="mt-6 text-base md:text-xl opacity-90 max-w-xl mx-auto">
              Stop spending evenings on Tally. Stop losing stock. Stop guessing your profit.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <a href={TRIAL_URL} target="_blank" rel="noopener"
                 className="inline-flex items-center gap-2 px-7 py-4 rounded-full font-black text-saffron-700 bg-white hover:bg-volt-300 hover:text-ink-950 transition-all text-lg shadow-2xl">
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </a>
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener"
                 className="inline-flex items-center gap-2 px-6 py-4 rounded-full font-black text-white bg-ink-950 hover:bg-ink-800 transition-all">
                <MessageCircle className="w-5 h-5" />
                WhatsApp us
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FOOTER
═══════════════════════════════════════════════════════════════ */
function Footer() {
  return (
    <footer className="border-t border-white/5 pt-16 pb-8 bg-ink-950">
      <div className="max-w-7xl mx-auto px-4 md:px-8">

        {/* Trust strip */}
        <div className="flex flex-wrap items-center justify-center gap-6 pb-10 border-b border-white/5 text-xs font-bold uppercase tracking-widest text-white/40">
          <div className="flex items-center gap-2"><Cpu className="w-4 h-4 text-saffron-400" /> Bank-grade Encryption</div>
          <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-volt-400" /> GST Certified</div>
          <div className="flex items-center gap-2"><Headphones className="w-4 h-4 text-violet-400" /> Live Support</div>
          <div className="flex items-center gap-2"><span className="text-base">🇮🇳</span> Made in Bharat</div>
        </div>

        <div className="grid md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10 mt-10">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-saffron-500 to-saffron-700 flex items-center justify-center text-white font-black">
                  <span className="font-display italic text-lg">A</span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-volt-400 ring-2 ring-ink-950" />
              </div>
              <div>
                <div className="font-black text-lg text-white">AddisonX</div>
                <div className="text-[10px] font-black tracking-[0.2em] text-saffron-400 -mt-0.5">BILLING OS</div>
              </div>
            </div>
            <p className="text-sm text-white/50 leading-relaxed max-w-xs">
              India's simplest billing software. Built shoulder-to-shoulder with shopkeepers, not accountants.
            </p>
          </div>

          {[
            { title: "Product",    items: ["Features", "Pricing", "Demo", "Sign in"] },
            { title: "Industries", items: ["Kirana", "Gift Shop", "Pharmacy", "Mobile"] },
            { title: "Company",    items: ["About", "Blog", "Terms", "Privacy", "Refund"] },
          ].map((col, i) => (
            <div key={i}>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-4">{col.title}</p>
              <ul className="space-y-2.5">
                {col.items.map((it, j) => (
                  <li key={j}>
                    <a href="#" className="text-sm text-white/65 hover:text-saffron-400 transition-colors">{it}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-white/5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs text-white/30">
          <p>© {new Date().getFullYear()} AddisonX Media. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`} className="hover:text-saffron-400 font-bold">+91 99999 99999</a>
            <span className="text-white/15">·</span>
            <a href="mailto:hello@addisonxmedia.com" className="hover:text-saffron-400 font-bold">hello@addisonxmedia.com</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STICKY MOBILE CTA
═══════════════════════════════════════════════════════════════ */
function StickyCTA() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <div className="md:hidden fixed bottom-4 inset-x-4 z-40 animate-fade-up">
      <a href={TRIAL_URL} target="_blank" rel="noopener"
         className="flex items-center justify-center gap-2 w-full px-5 py-4 rounded-full font-black text-ink-950 bg-white shadow-2xl">
        <Sparkles className="w-5 h-5" />
        Start 14-day Free Trial
        <ArrowRight className="w-5 h-5" />
      </a>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   APP
═══════════════════════════════════════════════════════════════ */
export default function App() {
  return (
    <>
      <Nav />
      <Hero />
      <LogoMarquee />
      <Features />
      <HowItWorks />
      <Industries />
      <Comparison />
      <Pricing />
      <Testimonial />
      <FAQ />
      <FinalCTA />
      <Footer />
      <StickyCTA />
    </>
  );
}
