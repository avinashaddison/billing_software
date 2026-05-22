import { useEffect, useState } from "react";
import {
  ScanLine, Receipt, QrCode, Boxes, BarChart3, Sparkles,
  Check, X, ArrowRight, Phone, Star, Shield, Zap, Clock,
  ShoppingBag, Pill, Shirt, Gem, Smartphone, Wrench,
  PenTool, Heart, Menu, Play, ChevronDown, MessageCircle,
  Flame, TrendingUp, IndianRupee, Headphones, Cpu,
} from "lucide-react";

const WHATSAPP_NUMBER = "919999999999"; // TODO replace with real number
const TRIAL_URL       = "https://billing.addisonxmedia.com";

/* ─────────────────────────────────────────────────────────────────
   NAV
─────────────────────────────────────────────────────────────────── */
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
    { href: "#features",   label: "Features" },
    { href: "#how",        label: "कैसे काम करता है" },
    { href: "#compare",    label: "Tally vs AddisonX" },
    { href: "#pricing",    label: "Pricing" },
    { href: "#faq",        label: "FAQ" },
  ];

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all ${scrolled ? "bg-white/85 backdrop-blur-xl border-b border-black/5 shadow-sm" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-saffron-500 via-saffron-400 to-saffron-600 flex items-center justify-center text-white font-black shadow-lg shadow-saffron-500/30 group-hover:scale-105 transition-transform">
            <span className="text-lg">A</span>
          </div>
          <div className="leading-tight">
            <div className="font-black text-lg">AddisonX</div>
            <div className="text-[10px] font-bold text-saffron-600 -mt-0.5 tracking-widest uppercase">Billing</div>
          </div>
        </a>

        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <a key={l.href} href={l.href}
               className="px-3.5 py-2 rounded-full text-[13px] font-bold text-ink-900/70 hover:text-saffron-600 hover:bg-saffron-50 transition-all">
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener"
             className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-all">
            <MessageCircle className="w-3.5 h-3.5" /> +91 99999 99999
          </a>
          <a href={TRIAL_URL} target="_blank" rel="noopener"
             className="px-4 py-2 rounded-full text-[13px] font-black text-white bg-gradient-to-r from-saffron-500 to-saffron-600 hover:shadow-lg hover:shadow-saffron-500/40 hover:-translate-y-0.5 transition-all">
            Sign In →
          </a>
        </div>

        <button onClick={() => setOpen((v) => !v)}
                className="md:hidden w-9 h-9 rounded-xl bg-saffron-500/10 text-saffron-600 flex items-center justify-center">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-white border-t border-black/5 px-4 py-3 space-y-1">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}
               className="block py-2.5 px-3 rounded-xl text-sm font-bold hover:bg-saffron-50">
              {l.label}
            </a>
          ))}
          <a href={TRIAL_URL} target="_blank" rel="noopener"
             className="block text-center mt-2 px-4 py-3 rounded-xl font-black text-white bg-gradient-to-r from-saffron-500 to-saffron-600">
            Free Trial शुरू करें →
          </a>
        </div>
      )}
    </nav>
  );
}

/* ─────────────────────────────────────────────────────────────────
   HERO
─────────────────────────────────────────────────────────────────── */
function Hero() {
  // Live-feel ticker that counts up the "₹ tracked today" number
  const [tracked, setTracked] = useState(2_84_50_823);
  useEffect(() => {
    const id = setInterval(() => setTracked((n) => n + Math.floor(Math.random() * 850 + 50)), 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="top" className="relative pt-28 md:pt-36 pb-16 overflow-hidden">
      {/* Floating gradient orbs */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-15%] left-[-10%] w-[55vw] h-[55vw] rounded-full bg-gradient-to-br from-saffron-300/50 to-saffron-500/30 blur-3xl animate-float-orb" />
        <div className="absolute top-[10%] right-[-15%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-br from-amber-200/50 to-rose-300/30 blur-3xl animate-float-orb" style={{ animationDelay: "-9s" }} />
        <div className="absolute bottom-[-20%] left-[20%] w-[40vw] h-[40vw] rounded-full bg-gradient-to-br from-emerald-200/40 to-cyan-200/30 blur-3xl animate-float-orb" style={{ animationDelay: "-14s" }} />

        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.025]"
             style={{
               backgroundImage: "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
               backgroundSize: "32px 32px",
             }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 grid md:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-16 items-center">

        {/* ── Left: copy ── */}
        <div className="animate-fade-up">
          {/* Eyebrow badges */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-saffron-100 to-amber-100 text-saffron-700 border border-saffron-200">
              🇮🇳 Made in Bharat
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200">
              <Shield className="w-3 h-3" /> GST Compliant
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200">
              <Zap className="w-3 h-3" /> 100+ शॉप्स पर चल रहा है
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-black tracking-tight leading-[0.95]" style={{ fontFamily: "var(--font-hindi)" }}>
            <span className="text-5xl md:text-7xl lg:text-[5.5rem] block">दुकान चलाओ,</span>
            <span className="text-5xl md:text-7xl lg:text-[5.5rem] block">
              <span className="relative inline-block">
                <span className="relative z-10 gradient-brand animate-shimmer-text">सॉफ्टवेयर</span>
                <span className="absolute -bottom-2 left-0 right-0 h-3 bg-saffron-400/30 -z-0 rounded-full blur-sm" />
              </span>
              {" "}नहीं!
            </span>
          </h1>

          <p className="mt-6 text-base md:text-lg text-ink-900/70 leading-relaxed max-w-xl">
            <strong className="text-saffron-600">5 second</strong> में बिल, UPI QR तैयार, Stock अपने आप count.
            <br />
            <span className="text-ink-900/60">Tally जैसी confusing नहीं — WhatsApp जैसी simple.</span>
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href={TRIAL_URL} target="_blank" rel="noopener"
               className="group inline-flex items-center gap-2 px-6 py-4 rounded-full font-black text-white bg-gradient-to-r from-saffron-500 to-saffron-600 shadow-xl shadow-saffron-500/40 hover:-translate-y-1 hover:shadow-2xl hover:shadow-saffron-500/50 transition-all">
              <span>14 दिन Free Trial शुरू करें</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
            <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=AddisonX%20demo%20चाहिए`} target="_blank" rel="noopener"
               className="inline-flex items-center gap-2 px-5 py-4 rounded-full font-black text-emerald-700 bg-emerald-50 border-2 border-emerald-200 hover:bg-emerald-100 transition-all">
              <MessageCircle className="w-5 h-5" />
              <span>WhatsApp पर डेमो</span>
            </a>
          </div>

          {/* Trust strip */}
          <div className="mt-6 flex items-center gap-4 text-sm">
            <div className="flex -space-x-2">
              {["FF6B35","FFA86B","E94F18","FFC8A0","B83A0A"].map((c, i) => (
                <div key={i} className="w-8 h-8 rounded-full ring-2 ring-white"
                     style={{ background: `linear-gradient(135deg, #${c}, #${c}dd)` }} />
              ))}
            </div>
            <div>
              <div className="flex items-center gap-1 text-amber-500">
                {[1,2,3,4,5].map(i => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}
                <span className="text-ink-900 font-black ml-1.5">4.9 / 5</span>
              </div>
              <div className="text-[11px] text-ink-900/60 font-semibold">100+ shopkeepers · रोज़ इस्तेमाल</div>
            </div>
          </div>

          {/* Live ticker */}
          <div className="mt-6 inline-flex items-center gap-3 px-4 py-3 rounded-2xl glass">
            <div className="relative">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500" style={{ animation: "pulse-ring 1.6s ease-out infinite" }} />
            </div>
            <div className="text-xs leading-tight">
              <div className="text-ink-900/60 font-semibold">आज trade हुआ</div>
              <div className="font-black tabular-nums text-saffron-700">
                ₹{tracked.toLocaleString("en-IN")}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: phone mockup ── */}
        <PhoneMockup />
      </div>

      {/* Scroll hint */}
      <div className="text-center mt-12 text-[11px] font-bold uppercase tracking-[0.3em] text-ink-900/40 flex items-center justify-center gap-1.5">
        Scroll <ChevronDown className="w-3 h-3 animate-bounce" />
      </div>
    </section>
  );
}

function PhoneMockup() {
  return (
    <div className="relative mx-auto md:mr-0 max-w-[340px] animate-fade-up" style={{ animationDelay: "150ms" }}>
      {/* Floating tags */}
      <div className="absolute -left-8 top-12 z-20 glass rounded-2xl px-3 py-2 animate-float-medium">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
            <ScanLine className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="font-black">SCAN</div>
            <div className="text-ink-900/60 text-[10px]">3 secs</div>
          </div>
        </div>
      </div>

      <div className="absolute -right-4 top-32 z-20 glass rounded-2xl px-3 py-2 animate-float-medium" style={{ animationDelay: "-2s" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-500 text-white flex items-center justify-center">
            <QrCode className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="font-black">UPI QR</div>
            <div className="text-ink-900/60 text-[10px]">Auto</div>
          </div>
        </div>
      </div>

      <div className="absolute -left-6 bottom-24 z-20 glass rounded-2xl px-3 py-2 animate-float-medium" style={{ animationDelay: "-1s" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-saffron-500 text-white flex items-center justify-center">
            <Receipt className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="font-black">GST Bill</div>
            <div className="text-ink-900/60 text-[10px]">Print Ready</div>
          </div>
        </div>
      </div>

      {/* Phone body */}
      <div className="relative bg-ink-900 rounded-[2.8rem] p-2.5 shadow-2xl shadow-ink-900/30">
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-24 h-5 bg-ink-900 rounded-b-2xl z-10" />
        <div className="rounded-[2.2rem] bg-white overflow-hidden aspect-[9/19] relative">

          {/* Screen */}
          <div className="bg-gradient-to-br from-saffron-50 via-white to-amber-50 h-full p-4 pt-8 flex flex-col">
            {/* Status bar */}
            <div className="flex justify-between items-center text-[9px] text-ink-900 font-bold mb-3">
              <span>9:41</span>
              <div className="flex items-center gap-1">
                <div className="flex gap-px">
                  <div className="w-0.5 h-1.5 bg-ink-900 rounded-sm" />
                  <div className="w-0.5 h-2 bg-ink-900 rounded-sm" />
                  <div className="w-0.5 h-2.5 bg-ink-900 rounded-sm" />
                  <div className="w-0.5 h-3 bg-ink-900 rounded-sm" />
                </div>
                <span>5G</span>
                <div className="w-5 h-2.5 border border-ink-900 rounded-sm relative">
                  <div className="absolute inset-0.5 right-1 bg-ink-900 rounded-sm" />
                </div>
              </div>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[9px] font-black uppercase tracking-widest text-ink-900/50">Today's Sales</div>
                <div className="text-xl font-black tabular-nums text-ink-900">₹28,450</div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-saffron-500 to-saffron-600 flex items-center justify-center text-white font-black text-sm">
                HK
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-white/80 backdrop-blur rounded-xl p-2.5 border border-saffron-100">
                <div className="text-[8px] font-bold uppercase tracking-wider text-ink-900/50">Bills</div>
                <div className="text-base font-black text-ink-900 tabular-nums">134</div>
              </div>
              <div className="bg-white/80 backdrop-blur rounded-xl p-2.5 border border-emerald-100">
                <div className="text-[8px] font-bold uppercase tracking-wider text-ink-900/50">Items</div>
                <div className="text-base font-black text-emerald-600 tabular-nums">2,140</div>
              </div>
            </div>

            {/* Chart placeholder — simple bar viz */}
            <div className="bg-white/70 backdrop-blur rounded-2xl p-3 border border-saffron-100 mb-3">
              <div className="text-[8px] font-bold uppercase tracking-wider text-ink-900/50 mb-2">This Week</div>
              <div className="flex items-end gap-1.5 h-16">
                {[35, 55, 40, 70, 50, 85, 60].map((h, i) => (
                  <div key={i} className="flex-1 bg-gradient-to-t from-saffron-500 to-saffron-300 rounded-t" style={{ height: `${h}%` }} />
                ))}
              </div>
              <div className="flex justify-between mt-1 text-[7px] font-bold text-ink-900/50">
                <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
              </div>
            </div>

            {/* Scanner CTA */}
            <div className="mt-auto bg-gradient-to-r from-saffron-500 to-saffron-600 rounded-2xl p-3 flex items-center gap-3 text-white shadow-lg relative overflow-hidden">
              <div className="absolute inset-x-0 -top-1 h-px bg-white/40 animate-scan-line" />
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <ScanLine className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="font-black text-sm leading-tight">Tap to Scan</div>
                <div className="text-[10px] opacity-80">USB / Camera ready</div>
              </div>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* Soft reflection */}
          <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   STATS STRIP
─────────────────────────────────────────────────────────────────── */
function Stats() {
  const stats = [
    { value: "100+",   label: "Happy Paid Shops",    icon: ShoppingBag },
    { value: "2L+",    label: "Bills Run",           icon: Receipt },
    { value: "₹3 Cr+", label: "Sales Tracked",       icon: TrendingUp },
    { value: "0",      label: "Setup Fees",          icon: Sparkles },
  ];
  return (
    <section className="py-12 md:py-16 border-y border-saffron-100 bg-gradient-to-r from-saffron-50/40 via-white to-amber-50/40">
      <div className="max-w-7xl mx-auto px-4 md:px-8 grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <div key={i} className="text-center md:text-left">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-saffron-500/10 text-saffron-600 mb-3">
              <s.icon className="w-5 h-5" />
            </div>
            <div className="text-3xl md:text-5xl font-black gradient-brand">{s.value}</div>
            <div className="text-[11px] md:text-xs font-bold uppercase tracking-widest text-ink-900/60 mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────
   FEATURES
─────────────────────────────────────────────────────────────────── */
function Features() {
  const features = [
    { Icon: Zap,         color: "from-saffron-500 to-saffron-600", bgColor: "bg-saffron-50",
      title: "5-second Billing", titleHindi: "5 सेकंड में बिल",
      desc: "USB scanner, camera, या type — SKU डालो, cart instantly update हो।" },
    { Icon: Receipt,     color: "from-emerald-500 to-emerald-600", bgColor: "bg-emerald-50",
      title: "GST Invoice Print", titleHindi: "GST बिल प्रिंट",
      desc: "CGST + SGST auto-split, HSN, GSTIN, 80mm thermal — सब ready।" },
    { Icon: QrCode,      color: "from-blue-500 to-blue-600",       bgColor: "bg-blue-50",
      title: "UPI QR on Bill", titleHindi: "UPI QR हर बिल पर",
      desc: "Customer scans, UPI app में amount pre-filled — कोई fuss नहीं।" },
    { Icon: Boxes,       color: "from-purple-500 to-purple-600",   bgColor: "bg-purple-50",
      title: "Stock Auto-Updates", titleHindi: "Stock अपने आप घटे",
      desc: "हर बिल पर stock automatic घटे, low-stock alerts WhatsApp / Telegram पर।" },
    { Icon: BarChart3,   color: "from-rose-500 to-rose-600",       bgColor: "bg-rose-50",
      title: "Live Reports", titleHindi: "जो ज़रूरी है, वो ही",
      desc: "रोज़ profit, top sellers, slow movers — सब एक नज़र में।" },
    { Icon: Flame,       color: "from-amber-500 to-amber-600",     bgColor: "bg-amber-50",
      title: "Today's Deal", titleHindi: "Discount setup",
      desc: "एक tap में sale price, सब platforms पर तुरंत दिखे — Tally में possible नहीं।" },
  ];

  return (
    <section id="features" className="py-20 md:py-28 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="text-center mb-14">
          <p className="inline-block text-[11px] font-black uppercase tracking-[0.3em] text-saffron-600 mb-3">Features</p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight" style={{ fontFamily: "var(--font-hindi)" }}>
            जो चाहिए, सब है.<br />
            <span className="gradient-brand">जो नहीं चाहिए,</span> वो नहीं.
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div key={i}
                 className="group relative p-6 rounded-3xl bg-white border border-black/5 hover:border-saffron-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-saffron-500/10 transition-all animate-fade-up"
                 style={{ animationDelay: `${i * 60}ms` }}>
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.color} text-white flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-transform`}>
                <f.Icon className="w-6 h-6" />
              </div>
              <h3 className="mt-5 text-lg font-black">{f.title}</h3>
              <p className="text-sm font-bold text-saffron-700 mt-0.5" style={{ fontFamily: "var(--font-hindi)" }}>{f.titleHindi}</p>
              <p className="mt-2 text-sm text-ink-900/65 leading-relaxed">{f.desc}</p>

              <div className={`absolute -top-2 -right-2 w-20 h-20 rounded-full ${f.bgColor} opacity-50 blur-2xl group-hover:opacity-80 transition-opacity -z-10`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────
   HOW IT WORKS
─────────────────────────────────────────────────────────────────── */
function HowItWorks() {
  const steps = [
    { n: 1, Icon: ScanLine, title: "Scan करो",         hindi: "Add to cart",         desc: "Barcode scanner, USB, या camera. Product तुरंत cart में।" },
    { n: 2, Icon: IndianRupee, title: "Payment लो",     hindi: "Cash या UPI",         desc: "UPI QR auto. Customer scan करे, paisa instant।" },
    { n: 3, Icon: Sparkles,   title: "App handle करेगी", hindi: "बाकी सब छोड़ो",      desc: "Stock update, daily report, GST entries — सब automatic।" },
  ];
  return (
    <section id="how" className="py-20 md:py-28 bg-gradient-to-b from-white via-saffron-50/30 to-white">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <div className="text-center mb-14">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-saffron-600 mb-3">How it works</p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight" style={{ fontFamily: "var(--font-hindi)" }}>
            3 step, <span className="gradient-brand">पूरा दिन sorted</span>
          </h2>
        </div>

        <div className="relative grid md:grid-cols-3 gap-6">
          {/* Connecting line behind cards (desktop) */}
          <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-saffron-200 via-saffron-400 to-saffron-200 -z-10" />

          {steps.map((s, i) => (
            <div key={s.n} className="relative animate-fade-up" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="bg-white rounded-3xl p-6 border border-saffron-100 hover:border-saffron-300 hover:-translate-y-1 transition-all shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-saffron-500 to-saffron-600 text-white font-black flex items-center justify-center shadow-md text-lg">
                    {s.n}
                  </div>
                  <s.Icon className="w-6 h-6 text-saffron-600" />
                </div>
                <h3 className="text-xl font-black">{s.title}</h3>
                <p className="text-sm font-bold text-saffron-700" style={{ fontFamily: "var(--font-hindi)" }}>{s.hindi}</p>
                <p className="text-sm text-ink-900/65 mt-2 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────
   WHO IS IT FOR
─────────────────────────────────────────────────────────────────── */
function Industries() {
  const shops = [
    { Icon: ShoppingBag, name: "Kirana / General Store", hindi: "किराना दुकान" },
    { Icon: Heart,       name: "Gift & Toy Shop",         hindi: "गिफ्ट शॉप" },
    { Icon: Smartphone,  name: "Mobile & Accessories",    hindi: "मोबाइल शॉप" },
    { Icon: PenTool,     name: "Stationery Shop",         hindi: "स्टेशनरी" },
    { Icon: Gem,         name: "Cosmetics & Beauty",      hindi: "कॉस्मेटिक्स" },
    { Icon: Wrench,      name: "Hardware & Electrical",   hindi: "हार्डवेयर" },
    { Icon: Shirt,       name: "Footwear & Fashion",      hindi: "कपड़े / जूते" },
    { Icon: Pill,        name: "Pharmacy / Medical",      hindi: "मेडिकल" },
  ];
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="text-center mb-12">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-saffron-600 mb-3">Who is it for</p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight" style={{ fontFamily: "var(--font-hindi)" }}>
            आपकी दुकान के लिए <span className="gradient-brand">perfect है?</span>
          </h2>
          <p className="mt-4 text-sm md:text-base text-ink-900/60 max-w-2xl mx-auto">
            जो भी 5 second में बिल चाहता है, GST compliant invoice चाहता है, और रोज़ का अकाउंट देखना चाहता है — यानी हर वो दुकानदार जो अपना समय बचाना चाहता है।
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {shops.map((s, i) => (
            <div key={i}
                 className="group p-4 md:p-5 rounded-2xl bg-white border border-black/5 hover:border-saffron-200 hover:bg-saffron-50/50 hover:-translate-y-1 transition-all animate-fade-up text-center"
                 style={{ animationDelay: `${i * 50}ms` }}>
              <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-saffron-100 to-amber-100 text-saffron-600 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-transform">
                <s.Icon className="w-6 h-6" />
              </div>
              <p className="font-black text-sm mt-3">{s.name}</p>
              <p className="text-xs font-bold text-saffron-600 mt-0.5" style={{ fontFamily: "var(--font-hindi)" }}>{s.hindi}</p>
            </div>
          ))}
        </div>

        <p className="text-center mt-8 text-sm text-ink-900/60">
          और हाँ — restaurant, salon, jewellery, या पेट्रोल पंप भी? <a href={`https://wa.me/${WHATSAPP_NUMBER}`} className="font-black text-saffron-600 hover:underline">WhatsApp से पूछ लो →</a>
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────
   COMPARISON
─────────────────────────────────────────────────────────────────── */
function Comparison() {
  const rows = [
    { feat: "5 सेकंड में बिल barcode से",                a: true, t: false },
    { feat: "Built-in UPI QR on checkout",                a: true, t: false },
    { feat: "Mobile + Desktop — same login",              a: true, t: false },
    { feat: "Today's Deal — instant discount",            a: true, t: false },
    { feat: "WhatsApp + Telegram daily report",           a: true, t: false },
    { feat: "Stock अपने आप घटे",                          a: true, t: "limited" },
    { feat: "Accounting / Balance-sheet exports",         a: true, t: true },
  ];
  return (
    <section id="compare" className="py-20 md:py-28 bg-gradient-to-b from-saffron-50/30 to-white">
      <div className="max-w-5xl mx-auto px-4 md:px-8">
        <div className="text-center mb-12">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-saffron-600 mb-3">Comparison</p>
          <h2 className="text-3xl md:text-5xl font-black leading-tight" style={{ fontFamily: "var(--font-hindi)" }}>
            <span className="text-ink-900/40">Tally accountants के लिए है.</span><br />
            <span className="gradient-brand">AddisonX</span> दुकानदारों के लिए.
          </h2>
        </div>

        <div className="rounded-3xl border border-black/5 bg-white overflow-hidden shadow-xl shadow-saffron-500/5">
          {/* Header */}
          <div className="grid grid-cols-[1.4fr_1fr_1fr] text-[11px] md:text-sm font-black uppercase tracking-wider">
            <div className="p-4 md:p-5 bg-saffron-50/50">Feature</div>
            <div className="p-4 md:p-5 text-center bg-gradient-to-br from-saffron-500 to-saffron-600 text-white relative">
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-yellow-300 text-ink-900 text-[9px] rounded-full font-black animate-badge-bounce">
                RECOMMENDED
              </span>
              AddisonX
            </div>
            <div className="p-4 md:p-5 text-center bg-gray-50 text-ink-900/60">Tally / Vyapar</div>
          </div>

          {/* Rows */}
          {rows.map((r, i) => (
            <div key={i} className={`grid grid-cols-[1.4fr_1fr_1fr] text-sm border-t border-black/5 ${i % 2 === 0 ? "bg-white" : "bg-saffron-50/20"}`}>
              <div className="p-4 md:p-5 font-bold">{r.feat}</div>
              <div className="p-4 md:p-5 text-center">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500 text-white">
                  <Check className="w-4 h-4" />
                </span>
              </div>
              <div className="p-4 md:p-5 text-center">
                {r.t === true ? (
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500 text-white">
                    <Check className="w-4 h-4" />
                  </span>
                ) : r.t === false ? (
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-500">
                    <X className="w-4 h-4" />
                  </span>
                ) : (
                  <span className="inline-block px-2 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-700">limited</span>
                )}
              </div>
            </div>
          ))}

          {/* Built-for */}
          <div className="grid grid-cols-[1.4fr_1fr_1fr] text-sm border-t border-black/5 bg-saffron-50/40">
            <div className="p-4 md:p-5 font-black uppercase text-[11px] tracking-wider">Built for</div>
            <div className="p-4 md:p-5 text-center font-black text-saffron-700">दुकानदार</div>
            <div className="p-4 md:p-5 text-center font-black text-ink-900/60">CA / Accountants</div>
          </div>
        </div>

        <p className="text-center text-xs text-ink-900/50 mt-4">
          *Tally and Vyapar are great tools — for accountants. AddisonX is built shoulder-to-shoulder with shopkeepers.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────
   PRICING
─────────────────────────────────────────────────────────────────── */
function Pricing() {
  return (
    <section id="pricing" className="py-20 md:py-28 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/2 -left-20 w-80 h-80 rounded-full bg-saffron-300/30 blur-3xl animate-float-orb" />
        <div className="absolute top-1/2 -right-20 w-80 h-80 rounded-full bg-amber-300/30 blur-3xl animate-float-orb" style={{ animationDelay: "-9s" }} />
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <div className="text-center mb-12">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-saffron-600 mb-3">Pricing</p>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight" style={{ fontFamily: "var(--font-hindi)" }}>
            Honest pricing. <span className="gradient-brand">कोई छुपा charge नहीं.</span>
          </h2>
          <p className="mt-4 text-sm md:text-base text-ink-900/60">
            Pay monthly या yearly. Cancel anytime. Setup <strong>FREE</strong>.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Free Trial */}
          <div className="relative p-7 rounded-3xl bg-white border-2 border-black/5">
            <div className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-ink-900/5 text-ink-900/70 mb-4">Free Trial</div>
            <h3 className="text-2xl font-black mb-2">पहले try करो, बाद में decide</h3>
            <div className="text-5xl font-black tabular-nums mt-4">14 दिन</div>
            <p className="text-sm text-ink-900/60 mt-1">कोई credit card नहीं</p>

            <ul className="mt-6 space-y-2.5 text-sm">
              {[
                "Unlimited products + bills",
                "GST invoice + UPI QR",
                "Stock auto-update",
                "Email + WhatsApp support",
                "सब features ON, no upgrade गिमिक",
              ].map((p, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>

            <a href={TRIAL_URL} target="_blank" rel="noopener"
               className="mt-7 inline-flex w-full items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-black text-saffron-700 bg-saffron-50 border border-saffron-200 hover:bg-saffron-100 transition-all">
              अभी शुरू करें <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Paid */}
          <div className="relative p-7 rounded-3xl bg-gradient-to-br from-saffron-500 via-saffron-500 to-saffron-600 text-white overflow-hidden shadow-2xl shadow-saffron-500/40">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 animate-blob-morph" />

            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-yellow-300 text-ink-900">★ Bestseller</span>
                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/15 backdrop-blur">1 Year Plan</span>
              </div>
              <h3 className="text-2xl font-black mb-1">Most popular — 90%+ choose this</h3>
              <div className="flex items-baseline gap-2 mt-5">
                <span className="text-lg line-through opacity-60 tabular-nums">₹4,799</span>
                <div className="text-6xl font-black tabular-nums">₹2,999</div>
                <span className="text-sm font-bold opacity-80">/year</span>
              </div>
              <p className="text-sm opacity-90 mt-1">= ₹250/month · ₹8/day · एक चाय से कम</p>

              <ul className="mt-6 space-y-2.5 text-sm">
                {[
                  "Unlimited products + bills",
                  "GST invoice + UPI QR",
                  "Telegram + WhatsApp reports",
                  "Today's Deal + customer database",
                  "Priority WhatsApp support",
                  "Free onboarding + training",
                ].map((p, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>

              <a href={TRIAL_URL} target="_blank" rel="noopener"
                 className="mt-7 inline-flex w-full items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-black text-saffron-700 bg-white hover:bg-yellow-50 hover:-translate-y-0.5 transition-all shadow-xl">
                Subscribe करें <ArrowRight className="w-4 h-4" />
              </a>

              <p className="text-[11px] text-center opacity-80 mt-3">
                ✓ 14 दिन free trial &nbsp;&nbsp;✓ Credit card नहीं चाहिए &nbsp;&nbsp;✓ कभी भी cancel
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────
   TESTIMONIAL
─────────────────────────────────────────────────────────────────── */
function Testimonial() {
  return (
    <section className="py-20 md:py-28 bg-gradient-to-br from-saffron-500 via-saffron-600 to-rose-500 text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none"
           style={{
             backgroundImage: "radial-gradient(circle at 25% 25%, white 1px, transparent 1px)",
             backgroundSize: "32px 32px",
           }} />

      <div className="max-w-4xl mx-auto px-4 md:px-8 text-center relative">
        <div className="flex justify-center gap-1 mb-6">
          {[1,2,3,4,5].map(i => <Star key={i} className="w-6 h-6 fill-current text-yellow-300" />)}
        </div>
        <blockquote className="text-2xl md:text-4xl font-black leading-tight" style={{ fontFamily: "var(--font-hindi)" }}>
          "हमारा cashier सालों से Tally पर था. 2 दिन में AddisonX सीख गया. अब वापस नहीं जाएगा."
        </blockquote>
        <div className="mt-8 inline-flex items-center gap-3 px-4 py-3 rounded-2xl glass-dark">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 flex items-center justify-center font-black text-ink-900">
            SK
          </div>
          <div className="text-left">
            <p className="font-black text-sm">Sharma Kirana Store</p>
            <p className="text-xs opacity-80">Indore · Joined 4 months ago</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────
   FAQ
─────────────────────────────────────────────────────────────────── */
function FAQ() {
  const faqs = [
    {
      q: "क्या मुझे install करना पड़ेगा?",
      a: "नहीं. AddisonX cloud पर चलता है — Chrome, Edge, Safari, या मोबाइल पर browser खोलो, login करो, बस। कुछ install नहीं करना।",
    },
    {
      q: "कौन सा hardware चाहिए?",
      a: "Minimum: एक Android फ़ोन या laptop. Recommended: 80mm thermal printer (अगर bill print करना है), USB barcode scanner. हम बता देंगे क्या खरीदना है।",
    },
    {
      q: "Internet नहीं हो तो?",
      a: "Offline mode काम करता है — bills queue में जाएँगे, internet आते ही auto-sync. आपका दिन रुकता नहीं।",
    },
    {
      q: "मेरा data safe है?",
      a: "Bank-grade encryption, daily backups, Indian servers. कोई access नहीं करता आपका data — ना हम भी नहीं।",
    },
    {
      q: "GST के setup में help मिलेगी?",
      a: "हाँ. Free onboarding call (Hindi/English) — आपका GSTIN, HSN codes, opening stock — सब हम setup कर देंगे।",
    },
    {
      q: "Cancel करना हो तो?",
      a: "एक click. Pro-rata refund. कोई 'cancellation fee' नहीं. आपका data भी export करके दे देंगे।",
    },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-20 md:py-28">
      <div className="max-w-3xl mx-auto px-4 md:px-8">
        <div className="text-center mb-12">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-saffron-600 mb-3">FAQ</p>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight" style={{ fontFamily: "var(--font-hindi)" }}>
            शुरू करने से पहले <span className="gradient-brand">कुछ सवाल?</span>
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((f, i) => (
            <div key={i} className="rounded-2xl border border-black/5 bg-white overflow-hidden hover:border-saffron-200 transition-colors">
              <button onClick={() => setOpen(open === i ? null : i)}
                      className="w-full flex items-center justify-between gap-4 p-5 text-left">
                <span className="font-black text-sm md:text-base">{f.q}</span>
                <ChevronDown className={`w-5 h-5 text-saffron-600 shrink-0 transition-transform ${open === i ? "rotate-180" : ""}`} />
              </button>
              {open === i && (
                <div className="px-5 pb-5 text-sm text-ink-900/70 leading-relaxed border-t border-black/5 pt-4">
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

/* ─────────────────────────────────────────────────────────────────
   FINAL CTA
─────────────────────────────────────────────────────────────────── */
function FinalCTA() {
  return (
    <section className="py-20 md:py-28 bg-gradient-to-br from-saffron-500 via-rose-500 to-saffron-600 text-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-1/4 w-80 h-80 rounded-full bg-yellow-300/20 blur-3xl animate-float-orb" />
        <div className="absolute bottom-10 right-1/4 w-80 h-80 rounded-full bg-rose-300/30 blur-3xl animate-float-orb" style={{ animationDelay: "-7s" }} />
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-8 text-center relative">
        <div className="inline-block px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-yellow-300 text-ink-900 mb-6 animate-badge-bounce">
          🎁 14 दिन का free trial
        </div>
        <h2 className="text-5xl md:text-7xl font-black leading-[0.95]" style={{ fontFamily: "var(--font-hindi)" }}>
          दुकान चलाओ.<br />
          हम सब <span className="text-yellow-300">handle करेंगे.</span>
        </h2>
        <p className="mt-6 text-base md:text-lg opacity-90 max-w-xl mx-auto">
          14 दिन free. कोई credit card नहीं. WhatsApp पर 24×7 support.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <a href={TRIAL_URL} target="_blank" rel="noopener"
             className="inline-flex items-center gap-2 px-7 py-4 rounded-full font-black text-saffron-700 bg-white hover:-translate-y-1 hover:shadow-2xl transition-all text-lg">
            Free Trial शुरू करें <ArrowRight className="w-5 h-5" />
          </a>
          <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener"
             className="inline-flex items-center gap-2 px-6 py-4 rounded-full font-black text-white bg-emerald-600 hover:bg-emerald-700 transition-all">
            <MessageCircle className="w-5 h-5" /> WhatsApp Demo
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────
   FOOTER
─────────────────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="bg-ink-900 text-white pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 md:px-8">

        {/* Trust strip */}
        <div className="flex flex-wrap items-center justify-center gap-6 pb-10 border-b border-white/10 text-xs font-bold uppercase tracking-widest text-white/50">
          <div className="flex items-center gap-2"><Cpu className="w-4 h-4 text-saffron-400" /> Bank-grade Encryption</div>
          <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-emerald-400" /> GST Certified</div>
          <div className="flex items-center gap-2"><Headphones className="w-4 h-4 text-blue-400" /> Live Support</div>
          <div className="flex items-center gap-2"><span className="text-base">🇮🇳</span> Made in Bharat</div>
        </div>

        <div className="grid md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-8 mt-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-saffron-500 to-saffron-600 flex items-center justify-center text-white font-black">A</div>
              <div>
                <div className="font-black text-lg">AddisonX</div>
                <div className="text-[10px] font-black tracking-widest text-saffron-400 -mt-0.5">BILLING</div>
              </div>
            </div>
            <p className="text-sm text-white/60 leading-relaxed max-w-xs">
              India's simplest billing software. Made by shopkeepers, for shopkeepers.
            </p>
          </div>

          {/* Cols */}
          {[
            { title: "Product",   items: ["Features", "Pricing", "Demo", "Sign In"] },
            { title: "Industries", items: ["Kirana", "Gift Shop", "Pharmacy", "Mobile"] },
            { title: "Company",   items: ["About", "Blog", "Terms", "Privacy", "Refund"] },
          ].map((col, i) => (
            <div key={i}>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-4">{col.title}</p>
              <ul className="space-y-2.5">
                {col.items.map((it, j) => (
                  <li key={j}>
                    <a href="#" className="text-sm text-white/70 hover:text-saffron-400 transition-colors">{it}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs text-white/40">
          <p>© {new Date().getFullYear()} AddisonX Media. All rights reserved.</p>
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5" />
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`} className="hover:text-saffron-400 font-bold">+91 99999 99999</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────────────────────────
   STICKY MOBILE CTA
─────────────────────────────────────────────────────────────────── */
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
         className="flex items-center justify-center gap-2 w-full px-5 py-4 rounded-full font-black text-white bg-gradient-to-r from-saffron-500 to-saffron-600 shadow-2xl shadow-saffron-500/50">
        <Clock className="w-5 h-5" />
        Free Trial शुरू करें — 14 दिन
        <ArrowRight className="w-5 h-5" />
      </a>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   APP
─────────────────────────────────────────────────────────────────── */
export default function App() {
  return (
    <>
      <Nav />
      <Hero />
      <Stats />
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
