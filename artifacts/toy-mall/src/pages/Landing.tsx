import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ScanLine, Receipt, QrCode, Boxes, BarChart3, Sparkles,
  Check, X, ArrowRight, Star, Shield, MessageCircle,
  ShoppingBag, Pill, Shirt, Gem, Smartphone, Wrench,
  PenTool, Heart, Menu, ChevronDown, TrendingUp,
  Headphones, Wifi, Cloud, Lock, Activity, Bot, Banknote, Flame,
} from "lucide-react";

const WHATSAPP_NUMBER = "919999999999";
const TRIAL_URL       = "/login";

/* ═══════════════════════════════════════════════════════════════
   PUBLIC MARKETING LANDING — Light Indian Premium

   Cream paper background, saffron + marigold + mehndi-green palette,
   subtle paisley & mandala motifs. Hindi + English mixed throughout.
═══════════════════════════════════════════════════════════════ */
export default function Landing() {
  return (
    <div className="min-h-screen text-slate-900 lp-cream overflow-x-hidden selection:bg-[#FF6B35] selection:text-white">
      <DiwaliStrip />
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
    </div>
  );
}

/* ─── Top festive strip ────────────────────────────────────── */
function DiwaliStrip() {
  return (
    <div className="bg-gradient-to-r from-[#FF6B35] via-[#F59E0B] to-[#FF6B35] text-white text-center py-2 px-4 text-[12px] md:text-[13px] font-bold">
      <span className="inline-flex items-center gap-2">
        <span className="text-base">🪔</span>
        <span>Diwali Offer · pehle 100 dukaandaars ke liye — </span>
        <span className="bg-white/25 px-2 py-0.5 rounded-full font-black">First month FREE</span>
        <span className="text-base">🪔</span>
      </span>
    </div>
  );
}

/* ─── NAV ──────────────────────────────────────────────────── */
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
    { href: "#how",      label: "Kaise kaam karta hai" },
    { href: "#compare",  label: "vs Tally" },
    { href: "#pricing",  label: "Pricing" },
    { href: "#faq",      label: "FAQ" },
  ];

  return (
    <nav className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/85 backdrop-blur-xl border-b border-[#FFC8A0]/60 shadow-sm" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5 group">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FFA86B] via-[#FF6B35] to-[#E94F18] flex items-center justify-center text-white font-black shadow-lg shadow-[#FF6B35]/30 ring-2 ring-white">
              <span className="text-lg italic" style={{ fontFamily: "var(--font-display)" }}>A</span>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#138808] ring-2 ring-white" />
          </div>
          <div className="leading-tight">
            <div className="font-black text-base text-slate-900">AddisonX</div>
            <div className="text-[9px] font-black tracking-[0.2em] uppercase text-[#E94F18] -mt-0.5">Dukaan ka Software</div>
          </div>
        </a>

        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <a key={l.href} href={l.href}
               className="px-3.5 py-2 rounded-full text-[13px] font-semibold text-slate-700 hover:text-[#E94F18] hover:bg-[#FFE4D1]/50 transition-all">
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener"
             className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold text-[#0F7C57] hover:bg-[#138808]/10 transition-all">
            <MessageCircle className="w-3.5 h-3.5" />
            +91 99999 99999
          </a>
          <Link href={TRIAL_URL}
             className="group px-4 py-2 rounded-full text-[13px] font-black text-white bg-gradient-to-r from-[#FF6B35] to-[#E94F18] hover:shadow-lg hover:shadow-[#FF6B35]/40 hover:-translate-y-0.5 transition-all">
            <span className="flex items-center gap-1.5">
              Sign In
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </Link>
        </div>

        <button onClick={() => setOpen((v) => !v)}
                className="md:hidden w-9 h-9 rounded-xl bg-[#FF6B35]/10 text-[#E94F18] flex items-center justify-center">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-white/95 backdrop-blur-xl border-t border-[#FFE4D1] px-4 py-3 space-y-1">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}
               className="block py-2.5 px-3 rounded-xl text-sm font-bold text-slate-700 hover:bg-[#FFE4D1]/40">
              {l.label}
            </a>
          ))}
          <Link href={TRIAL_URL}
             className="block text-center mt-2 px-4 py-3 rounded-xl font-black text-white bg-gradient-to-r from-[#FF6B35] to-[#E94F18]">
            Sign In →
          </Link>
        </div>
      )}
    </nav>
  );
}

/* ─── HERO ─────────────────────────────────────────────────── */
function Hero() {
  const [tracked, setTracked] = useState(2_84_50_823);
  useEffect(() => {
    const id = setInterval(() => setTracked((n) => n + Math.floor(Math.random() * 950 + 50)), 1700);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="top" className="relative pt-12 md:pt-20 pb-20 overflow-hidden">
      {/* Soft decorative blobs + mandala */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 lp-mandala" />
        <div className="absolute top-[-12%] left-[-8%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-br from-[#FFA86B]/40 via-[#FF6B35]/25 to-transparent blur-3xl lp-animate-float-orb" />
        <div className="absolute top-[5%] right-[-12%] w-[45vw] h-[45vw] rounded-full bg-gradient-to-br from-[#F59E0B]/30 to-rose-300/20 blur-3xl lp-animate-float-orb" style={{ animationDelay: "-9s" }} />
        <div className="absolute bottom-[-15%] left-[30%] w-[35vw] h-[35vw] rounded-full bg-gradient-to-br from-[#138808]/15 to-emerald-200/30 blur-3xl lp-animate-float-orb" style={{ animationDelay: "-14s" }} />
        {/* Sparkle accents */}
        <div className="absolute top-12 left-[8%] text-[#F59E0B]/60 text-2xl select-none rotate-12">✦</div>
        <div className="absolute top-32 right-[12%] text-[#FF6B35]/50 text-3xl select-none">✦</div>
        <div className="absolute bottom-32 left-[15%] text-[#FF6B35]/40 text-2xl select-none">✦</div>
        <div className="absolute bottom-20 right-[6%] text-[#138808]/40 text-3xl select-none">✦</div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 grid md:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-16 items-center">
        {/* LEFT: copy */}
        <div className="lp-animate-fade-up">
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-[#FFE4D1] to-[#FCD9B6] text-[#B83A0A] border border-[#FFC8A0]">
              🇮🇳 Made in Bharat
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#138808]/10 text-[#0F7C57] border border-[#138808]/20">
              <Shield className="w-3 h-3" /> GST + UPI Ready
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#F59E0B]/10 text-[#B45309] border border-[#F59E0B]/20">
              <Star className="w-3 h-3 fill-current" /> 4.9 · 100+ shops
            </span>
          </div>

          <h1 className="font-black tracking-tight leading-[0.95]">
            <span className="block text-5xl md:text-7xl lg:text-[5.5rem] text-slate-900">Dukaan badhao,</span>
            <span className="block text-5xl md:text-7xl lg:text-[5.5rem] mt-1">
              <span className="relative inline-block">
                <span className="relative z-10 lp-gradient-marigold">tension</span>
                <span aria-hidden className="absolute -bottom-1 left-0 right-0 h-3 bg-[#F59E0B]/30 rounded-full blur-sm -z-0" />
              </span>
              {" "}<span className="text-slate-900">nahi!</span>
            </span>
          </h1>

          <p className="mt-6 text-base md:text-lg text-slate-700 leading-relaxed max-w-xl">
            <strong className="text-[#E94F18]">5 second</strong> mein bill, UPI QR taiyaar, Stock apne aap count.
            <br />
            <span className="text-slate-600">Tally jaisa confusing nahi, WhatsApp jaisa simple.</span>
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={TRIAL_URL}
               className="group inline-flex items-center gap-2 px-6 py-4 rounded-full font-black text-white bg-gradient-to-r from-[#FF6B35] to-[#E94F18] shadow-xl shadow-[#FF6B35]/40 hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#FF6B35]/50 transition-all">
              <Sparkles className="w-5 h-5" />
              <span>Abhi shuru karein — Free</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=AddisonX%20demo%20chahiye`} target="_blank" rel="noopener"
               className="inline-flex items-center gap-2 px-5 py-4 rounded-full font-black text-[#0F7C57] bg-white border-2 border-[#138808]/30 hover:bg-[#138808]/5 hover:border-[#138808]/50 transition-all">
              <MessageCircle className="w-5 h-5" />
              <span>WhatsApp par baat karein</span>
            </a>
          </div>

          <div className="mt-6 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-slate-600">
              <Check className="w-4 h-4 text-[#138808]" strokeWidth={3} /> <span>Credit card nahi chahiye</span>
            </div>
            <span className="text-slate-300">·</span>
            <div className="flex items-center gap-1.5 text-slate-600">
              <Check className="w-4 h-4 text-[#138808]" strokeWidth={3} /> <span>14 din Free</span>
            </div>
          </div>

          {/* Live tracker */}
          <div className="mt-6 inline-flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-[#FFC8A0]/50 shadow-sm">
            <div className="relative">
              <div className="w-2.5 h-2.5 rounded-full bg-[#138808]" />
              <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-[#138808] animate-ping" />
            </div>
            <div className="text-xs leading-tight">
              <div className="text-slate-500 font-semibold">Aaj trade hua</div>
              <div className="font-black tabular-nums text-[#B83A0A] text-base">
                ₹{tracked.toLocaleString("en-IN")}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Phone mockup */}
        <PhoneMockup />
      </div>
    </section>
  );
}

function PhoneMockup() {
  return (
    <div className="relative mx-auto md:mr-0 max-w-[340px] lp-animate-fade-up" style={{ animationDelay: "150ms" }}>
      {/* Floating tags around mockup */}
      <div className="absolute -left-6 top-10 z-20 bg-white rounded-2xl px-3 py-2 shadow-lg shadow-[#FF6B35]/15 border border-[#FFC8A0]/40 lp-animate-float-y">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#138808] text-white flex items-center justify-center">
            <ScanLine className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="font-black text-slate-900">GST READY</div>
            <div className="text-slate-500 text-[10px]">CGST + SGST auto</div>
          </div>
        </div>
      </div>

      <div className="absolute -right-4 top-28 z-20 bg-white rounded-2xl px-3 py-2 shadow-lg shadow-[#F59E0B]/15 border border-[#FFC8A0]/40 lp-animate-float-y" style={{ animationDelay: "-2s" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#8B5CF6] text-white flex items-center justify-center">
            <QrCode className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="font-black text-slate-900">UPI QR</div>
            <div className="text-slate-500 text-[10px]">Har bill par</div>
          </div>
        </div>
      </div>

      <div className="absolute -left-2 bottom-24 z-20 bg-white rounded-2xl px-3 py-2 shadow-lg shadow-rose-500/15 border border-[#FFC8A0]/40 lp-animate-float-y" style={{ animationDelay: "-1s" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#FF6B35] text-white flex items-center justify-center">
            <span className="text-base">🎉</span>
          </div>
          <div className="text-xs">
            <div className="font-black text-slate-900">New sale!</div>
            <div className="text-slate-500 text-[10px]">Bill #47 · ₹890</div>
          </div>
        </div>
      </div>

      {/* Phone */}
      <div className="relative bg-slate-900 rounded-[2.8rem] p-2.5 shadow-2xl shadow-slate-900/30">
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-24 h-5 bg-slate-900 rounded-b-2xl z-10" />
        <div className="rounded-[2.2rem] bg-white overflow-hidden aspect-[9/19] relative">
          <div className="bg-gradient-to-br from-[#FFF6F0] via-white to-[#FFE4D1] h-full p-4 pt-8 flex flex-col">
            <div className="flex justify-between items-center text-[9px] text-slate-900 font-bold mb-3">
              <span>9:41</span>
              <span>5G ▮▮▮ 92%</span>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Aapki dukaan</div>
                <div className="text-xl font-black text-slate-900 leading-tight">Aaj ka overview</div>
                <div className="text-[10px] text-slate-500">Sabse achha din! 🎉</div>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-[#138808]/10 text-[#0F7C57]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#138808] animate-pulse" /> LIVE
              </span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-gradient-to-br from-[#FFE4D1] to-[#FFC8A0]/40 rounded-xl p-2.5 border border-[#FFC8A0]/50">
                <div className="text-[8px] font-bold uppercase tracking-wider text-[#B83A0A]/70">Aaj ki kamaai</div>
                <div className="text-base font-black tabular-nums text-[#B83A0A]">₹28,450</div>
              </div>
              <div className="bg-rose-100/50 rounded-xl p-2.5 border border-rose-200/50">
                <div className="text-[8px] font-bold uppercase tracking-wider text-rose-700/70">Bills bane</div>
                <div className="text-base font-black tabular-nums text-rose-700">47</div>
              </div>
              <div className="bg-amber-100/50 rounded-xl p-2.5 border border-amber-200/50">
                <div className="text-[8px] font-bold uppercase tracking-wider text-amber-700/70">Items bike</div>
                <div className="text-base font-black tabular-nums text-amber-700">134</div>
              </div>
              <div className="bg-violet-100/40 rounded-xl p-2.5 border border-violet-200/50">
                <div className="text-[8px] font-bold uppercase tracking-wider text-violet-700/70">Stock</div>
                <div className="text-base font-black tabular-nums text-violet-700">2,140</div>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white/70 backdrop-blur rounded-2xl p-3 border border-[#FFC8A0]/30 flex-1">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Revenue · 7 days</div>
                <span className="text-[10px] font-black text-[#138808]">+52%</span>
              </div>
              <div className="flex items-end gap-1.5 h-20">
                {[40, 55, 50, 70, 60, 85, 95].map((h, i) => (
                  <div key={i} className="flex-1 bg-gradient-to-t from-[#FF6B35] to-[#FFA86B] rounded-t opacity-90"
                       style={{ height: `${h}%` }} />
                ))}
              </div>
              <div className="flex justify-between mt-1 text-[7px] font-bold text-slate-400">
                <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
              </div>
            </div>

            <div className="mt-3 rounded-2xl bg-slate-900 text-white p-2.5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#138808]/30 flex items-center justify-center">
                <ScanLine className="w-4 h-4 text-[#B5FF6A]" />
              </div>
              <div className="flex-1 text-[10px]">
                <div className="font-black">Just sold · Steel Tiffin Set</div>
                <div className="text-white/60 text-[9px]">₹890 · 2 min ago</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── LOGO MARQUEE ─────────────────────────────────────────── */
function LogoMarquee() {
  const shops = [
    "Hira & Sons", "Sharma Kirana", "Mina Gift Shop", "Mukti Stationery",
    "Patel Medical", "Singh Cosmetics", "Royal Hardware", "Krishna Footwear",
    "Joy Bookstore", "Modern Mobile", "Anand Toys", "Bhagat Pharmacy",
  ];
  return (
    <section className="border-y border-[#FFC8A0]/40 py-10 bg-white/40 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 md:px-8 mb-6">
        <p className="text-center text-[10px] font-black tracking-[0.3em] uppercase text-slate-500">
          ★ 100+ shopkeepers already running across India ★
        </p>
      </div>
      <div className="lp-marquee gap-12 text-slate-400">
        {[...shops, ...shops].map((s, i) => (
          <div key={i} className="text-2xl whitespace-nowrap italic" style={{ fontFamily: "var(--font-display)" }}>
            {s}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── FEATURES ─────────────────────────────────────────────── */
function Features() {
  const features = [
    { Icon: ScanLine,  iconBg: "bg-[#FF6B35]", title: "5-second Billing", hindi: "5 second mein bill",
      desc: "Barcode scanner, camera, ya SKU type karo — cart instantly update ho jaata hai." },
    { Icon: Receipt, iconBg: "bg-[#138808]", title: "GST Invoice Print", hindi: "GST bill compliant",
      desc: "CGST + SGST auto-split, HSN, GSTIN, 80mm thermal ready — sab set." },
    { Icon: QrCode, iconBg: "bg-[#8B5CF6]", title: "UPI QR on Bill", hindi: "Har bill par UPI",
      desc: "Customer scan kare, amount UPI app mein pre-filled — paise minto mein." },
    { Icon: Boxes, iconBg: "bg-[#F59E0B]", title: "Stock apne aap ghate", hindi: "Low-stock WhatsApp alert",
      desc: "Har bill par stock apne aap ghate, low-stock alerts WhatsApp par." },
    { Icon: BarChart3, iconBg: "bg-rose-500", title: "Reports jo zaroori hai", hindi: "Live dikh raha hai",
      desc: "Roz profit, top sellers, slow movers — sab ek nazar mein." },
    { Icon: Flame, iconBg: "bg-amber-500", title: "Today's Deal", hindi: "One-tap discount setup",
      desc: "Ek tap mein sale price set karo, sab customer-facing pages par turant dikhe." },
  ];

  return (
    <section id="features" className="py-20 md:py-28 relative">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="text-center mb-14">
          <p className="inline-block text-[11px] font-black uppercase tracking-[0.3em] text-[#E94F18] mb-3">Features</p>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.95] text-slate-900">
            Jo chahiye, sab hai.<br />
            <span className="lp-gradient-marigold">Jo nahi chahiye, woh nahi.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div key={i}
                 className="group relative p-6 rounded-3xl lp-card lp-card-hover transition-all"
                 style={{ animation: `lp-fade-up 0.6s ${i * 60}ms backwards` }}>
              <div className={`w-12 h-12 rounded-2xl ${f.iconBg} text-white flex items-center justify-center shadow-md group-hover:scale-110 group-hover:rotate-3 transition-transform`}>
                <f.Icon className="w-6 h-6" />
              </div>
              <h3 className="mt-5 text-lg font-black text-slate-900">{f.title}</h3>
              <p className="text-sm font-bold text-[#E94F18] mt-0.5">{f.hindi}</p>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── HOW IT WORKS ─────────────────────────────────────────── */
function HowItWorks() {
  const steps = [
    { n: 1, Icon: ScanLine, title: "Scan karo",        hindi: "Add to cart",     desc: "Barcode scanner, USB, ya camera. Product turant cart mein." },
    { n: 2, Icon: Banknote, title: "Payment lo",       hindi: "Cash ya UPI",     desc: "UPI QR auto. Customer scan kare, paisa instant." },
    { n: 3, Icon: Sparkles, title: "App handle karegi", hindi: "Baaki sab chhodo", desc: "Stock update, daily report, GST — sab automatic." },
  ];
  return (
    <section id="how" className="py-20 md:py-28 bg-gradient-to-b from-white/60 to-white/0">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <div className="text-center mb-14">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#E94F18] mb-3">How it works</p>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900">
            3 step, <span className="lp-gradient-marigold">poora din sorted</span>
          </h2>
        </div>

        <div className="relative grid md:grid-cols-3 gap-6">
          {/* Connecting dashed line behind cards (desktop) */}
          <div className="hidden md:block absolute top-16 left-[16%] right-[16%] -z-10">
            <svg viewBox="0 0 1000 10" className="w-full">
              <line x1="0" y1="5" x2="1000" y2="5" stroke="#FFA86B" strokeWidth="2" strokeDasharray="8 8" />
            </svg>
          </div>

          {steps.map((s, i) => (
            <div key={s.n} className="relative lp-animate-fade-up" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="lp-card lp-card-hover bg-white rounded-3xl p-6 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FF6B35] to-[#E94F18] text-white font-black flex items-center justify-center shadow-md text-lg ring-2 ring-white">
                    {s.n}
                  </div>
                  <s.Icon className="w-6 h-6 text-[#E94F18]" />
                </div>
                <h3 className="text-xl font-black text-slate-900">{s.title}</h3>
                <p className="text-sm font-bold text-[#E94F18]">{s.hindi}</p>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── INDUSTRIES ───────────────────────────────────────────── */
function Industries() {
  const shops = [
    { Icon: ShoppingBag, name: "Kirana / General Store", hindi: "Kirana dukaan" },
    { Icon: Heart,       name: "Gift & Toy Shop",         hindi: "Gift shop" },
    { Icon: Smartphone,  name: "Mobile & Accessories",    hindi: "Mobile shop" },
    { Icon: PenTool,     name: "Stationery Shop",         hindi: "Stationery" },
    { Icon: Gem,         name: "Cosmetics & Beauty",      hindi: "Cosmetics" },
    { Icon: Wrench,      name: "Hardware & Electrical",   hindi: "Hardware" },
    { Icon: Shirt,       name: "Footwear & Fashion",      hindi: "Kapde / jootein" },
    { Icon: Pill,        name: "Pharmacy / Medical",      hindi: "Medical" },
  ];
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="text-center mb-12">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#E94F18] mb-3">Who is it for</p>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900">
            Aapki dukaan ke liye <span className="lp-gradient-marigold">perfect hai?</span>
          </h2>
          <p className="mt-4 text-sm md:text-base text-slate-600 max-w-2xl mx-auto">
            Har woh dukaandaar jo 5 second mein bill chahta hai, GST compliant invoice chahta hai, aur apna time bachana chahta hai.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {shops.map((s, i) => (
            <div key={i}
                 className="group lp-card lp-card-hover p-4 md:p-5 rounded-2xl bg-white transition-all text-center"
                 style={{ animation: `lp-fade-up 0.6s ${i * 50}ms backwards` }}>
              <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-[#FFE4D1] to-[#FCD9B6] text-[#E94F18] flex items-center justify-center group-hover:bg-gradient-to-br group-hover:from-[#FF6B35] group-hover:to-[#E94F18] group-hover:text-white group-hover:rotate-6 transition-all">
                <s.Icon className="w-6 h-6" />
              </div>
              <p className="font-black text-sm mt-3 text-slate-900">{s.name}</p>
              <p className="text-xs font-bold text-[#E94F18] mt-0.5">{s.hindi}</p>
            </div>
          ))}
        </div>

        <p className="text-center mt-8 text-sm text-slate-600">
          Aur restaurant, salon, jewellery, ya petrol pump bhi? <a href={`https://wa.me/${WHATSAPP_NUMBER}`} className="font-black text-[#E94F18] hover:underline">WhatsApp par poochh lo →</a>
        </p>
      </div>
    </section>
  );
}

/* ─── COMPARISON ───────────────────────────────────────────── */
function Comparison() {
  const rows = [
    { feat: "5 second mein bill barcode se",      a: true, t: false as const },
    { feat: "Built-in UPI QR on checkout",        a: true, t: false as const },
    { feat: "Mobile + Desktop — same login",      a: true, t: false as const },
    { feat: "Today's Deal — instant discount",    a: true, t: false as const },
    { feat: "WhatsApp + Telegram daily report",   a: true, t: false as const },
    { feat: "Stock apne aap ghate",                a: true, t: "limited" as const },
    { feat: "Accounting / Balance-sheet exports", a: true, t: true as const },
  ];
  return (
    <section id="compare" className="py-20 md:py-28 bg-gradient-to-b from-[#FFE4D1]/30 to-white/0">
      <div className="max-w-5xl mx-auto px-4 md:px-8">
        <div className="text-center mb-12">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#E94F18] mb-3">Comparison</p>
          <h2 className="text-3xl md:text-5xl font-black leading-tight text-slate-900">
            <span className="text-slate-400">Tally accountants ke liye hai.</span><br />
            <span className="lp-gradient-marigold">AddisonX</span> dukaandaaron ke liye.
          </h2>
        </div>

        <div className="rounded-3xl bg-white shadow-xl shadow-[#FF6B35]/10 overflow-hidden lp-conic-border">
          <div className="grid grid-cols-[1.4fr_1fr_1fr] text-[11px] md:text-sm font-black uppercase tracking-wider">
            <div className="p-4 md:p-5 bg-[#FFE4D1]/40 text-slate-700">Feature</div>
            <div className="p-4 md:p-5 text-center bg-gradient-to-br from-[#FF6B35] to-[#E94F18] text-white relative">
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[#F59E0B] text-white text-[9px] rounded-full font-black lp-animate-badge-bounce whitespace-nowrap">
                ★ RECOMMENDED
              </span>
              AddisonX
            </div>
            <div className="p-4 md:p-5 text-center bg-slate-100 text-slate-500">Tally / Vyapar</div>
          </div>

          {rows.map((r, i) => (
            <div key={i} className={`grid grid-cols-[1.4fr_1fr_1fr] text-sm border-t border-[#FFC8A0]/40 ${i % 2 === 0 ? "bg-white" : "bg-[#FFE4D1]/15"}`}>
              <div className="p-4 md:p-5 font-bold text-slate-800">{r.feat}</div>
              <div className="p-4 md:p-5 text-center">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#138808] text-white">
                  <Check className="w-4 h-4" strokeWidth={3} />
                </span>
              </div>
              <div className="p-4 md:p-5 text-center">
                {r.t === true ? (
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-200 text-slate-600">
                    <Check className="w-4 h-4" />
                  </span>
                ) : r.t === false ? (
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-rose-100 text-rose-500">
                    <X className="w-4 h-4" />
                  </span>
                ) : (
                  <span className="inline-block px-2 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-700">limited</span>
                )}
              </div>
            </div>
          ))}

          <div className="grid grid-cols-[1.4fr_1fr_1fr] text-sm border-t border-[#FFC8A0]/40 bg-[#FFE4D1]/40">
            <div className="p-4 md:p-5 font-black uppercase text-[11px] tracking-wider text-slate-700">Built for</div>
            <div className="p-4 md:p-5 text-center font-black text-[#B83A0A]">Dukaandaars</div>
            <div className="p-4 md:p-5 text-center font-black text-slate-500">CA / Accountants</div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">
          *Tally and Vyapar are great tools — for accountants. AddisonX is built shoulder-to-shoulder with shopkeepers.
        </p>
      </div>
    </section>
  );
}

/* ─── PRICING ──────────────────────────────────────────────── */
function Pricing() {
  return (
    <section id="pricing" className="py-20 md:py-28 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/2 -left-20 w-80 h-80 rounded-full bg-[#FFA86B]/30 blur-3xl lp-animate-float-orb" />
        <div className="absolute top-1/2 -right-20 w-80 h-80 rounded-full bg-[#F59E0B]/25 blur-3xl lp-animate-float-orb" style={{ animationDelay: "-9s" }} />
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <div className="text-center mb-12">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#E94F18] mb-3">Pricing</p>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900">
            Honest pricing. <span className="lp-gradient-marigold">Koi chhupa charge nahi.</span>
          </h2>
          <p className="mt-4 text-sm md:text-base text-slate-600">
            Pay monthly ya yearly. Cancel anytime. Setup <strong>FREE</strong>.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Free Trial */}
          <div className="relative p-7 md:p-8 rounded-3xl bg-white border-2 border-[#FFC8A0]/40">
            <div className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 mb-4">Free Trial</div>
            <h3 className="text-2xl font-black text-slate-900">Pehle try karo, baad mein decide</h3>
            <div className="text-6xl md:text-7xl font-black tabular-nums mt-5 text-slate-900">14 <span className="text-2xl text-slate-500">din</span></div>
            <p className="text-sm text-slate-500 mt-1">Koi credit card nahi</p>

            <ul className="mt-7 space-y-2.5 text-sm">
              {[
                "Unlimited products + bills",
                "GST invoice + UPI QR",
                "Stock auto-update",
                "Email + WhatsApp support",
                "Sab features ON, no upgrade gimmick",
              ].map((p, i) => (
                <li key={i} className="flex items-start gap-2.5 text-slate-700">
                  <Check className="w-4 h-4 text-[#138808] mt-0.5 shrink-0" strokeWidth={3} />
                  <span>{p}</span>
                </li>
              ))}
            </ul>

            <Link href={TRIAL_URL}
               className="mt-7 inline-flex w-full items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-black text-[#B83A0A] bg-[#FFE4D1] border border-[#FFC8A0] hover:bg-[#FCD9B6] transition-all">
              Abhi shuru karein <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Paid */}
          <div className="relative rounded-3xl bg-gradient-to-br from-[#FF6B35] via-[#E94F18] to-[#B83A0A] text-white overflow-hidden shadow-2xl shadow-[#FF6B35]/40 p-7 md:p-8">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[#F59E0B]/30 blur-2xl" />
            <div className="absolute inset-0 opacity-15"
                 style={{
                   backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 1px)",
                   backgroundSize: "20px 20px",
                 }} />

            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#F59E0B] text-white">★ Bestseller</span>
                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 backdrop-blur">1 Year Plan</span>
              </div>
              <h3 className="text-2xl font-black">Most popular — 90%+ choose this</h3>
              <div className="flex items-baseline gap-2 mt-5">
                <span className="text-lg line-through opacity-50 tabular-nums">₹14,999</span>
                <div className="text-6xl md:text-7xl font-black tabular-nums">₹9,999</div>
                <span className="text-sm font-bold opacity-80">/year</span>
              </div>
              <p className="text-sm opacity-90 mt-1.5">
                = <strong>₹833/month</strong> · ₹27/day · ek chai se kam
              </p>

              <ul className="mt-6 space-y-2.5 text-sm">
                {[
                  "Everything in Free Trial",
                  "Telegram + WhatsApp daily reports",
                  "Today's Deal + customer database",
                  "Multi-staff PIN logins",
                  "Priority WhatsApp support",
                  "Free onboarding call (Hindi/English)",
                ].map((p, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={3} />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>

              <Link href={TRIAL_URL}
                 className="mt-7 inline-flex w-full items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-black text-[#B83A0A] bg-white hover:bg-[#FFE4D1] hover:-translate-y-0.5 transition-all shadow-xl">
                Subscribe karein <ArrowRight className="w-4 h-4" />
              </Link>

              <p className="text-[11px] text-center opacity-80 mt-3">
                ✓ 14 din free trial &nbsp;·&nbsp; ✓ Credit card nahi chahiye &nbsp;·&nbsp; ✓ Kabhi bhi cancel
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── TESTIMONIAL ──────────────────────────────────────────── */
function Testimonial() {
  return (
    <section className="py-20 md:py-28 bg-gradient-to-br from-[#FF6B35] via-[#E94F18] to-rose-500 text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-15 pointer-events-none"
           style={{
             backgroundImage: "radial-gradient(circle at 25% 25%, white 1px, transparent 1px)",
             backgroundSize: "32px 32px",
           }} />

      <div className="max-w-4xl mx-auto px-4 md:px-8 text-center relative">
        <div className="flex justify-center gap-1 mb-6">
          {[1,2,3,4,5].map(i => <Star key={i} className="w-6 h-6 fill-[#F59E0B] text-[#F59E0B]" />)}
        </div>
        <blockquote className="text-2xl md:text-4xl font-black leading-tight">
          "Hamara cashier saalon se Tally par tha. 2 din mein AddisonX seekh gaya. <span className="text-[#F59E0B]">Ab wapas nahi jaayega.</span>"
        </blockquote>
        <div className="mt-8 inline-flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/15 backdrop-blur border border-white/20">
          <div className="w-10 h-10 rounded-full bg-[#F59E0B] flex items-center justify-center font-black text-white">SK</div>
          <div className="text-left">
            <p className="font-black text-sm">Sharma Kirana Store</p>
            <p className="text-xs opacity-80">Indore · 4 months on AddisonX</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ ─────────────────────────────────────────────────── */
function FAQ() {
  const faqs = [
    { q: "Kya mujhe install karna padega?",
      a: "Nahi. AddisonX cloud par chalta hai — Chrome, Edge, Safari, ya mobile par browser kholo, login karo, bas." },
    { q: "Kaun sa hardware chahiye?",
      a: "Minimum: ek Android phone ya laptop. Recommended: 80mm thermal printer (agar bill print karna hai), USB barcode scanner." },
    { q: "Internet nahi ho toh?",
      a: "Offline mode kaam karta hai — bills queue mein jaayenge, internet aate hi auto-sync. Aapka din rukta nahi." },
    { q: "Mera data safe hai?",
      a: "Bank-grade encryption, daily backups, Indian servers. Koi access nahi karta aapka data — hum bhi nahi." },
    { q: "GST ke setup mein help milegi?",
      a: "Haan. Free onboarding call (Hindi/English) — aapka GSTIN, HSN codes, opening stock — sab hum setup kar denge." },
    { q: "Cancel karna ho toh?",
      a: "Ek click. Pro-rata refund. Koi 'cancellation fee' nahi. Aapka data bhi CSV mein export karke de denge." },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-20 md:py-28">
      <div className="max-w-3xl mx-auto px-4 md:px-8">
        <div className="text-center mb-12">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#E94F18] mb-3">FAQ</p>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">
            Shuru karne se pehle <span className="lp-gradient-marigold">kuchh sawal?</span>
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((f, i) => (
            <div key={i} className="rounded-2xl bg-white border border-[#FFC8A0]/40 overflow-hidden hover:border-[#FFA86B]/60 transition-colors">
              <button onClick={() => setOpen(open === i ? null : i)}
                      className="w-full flex items-center justify-between gap-4 p-5 text-left">
                <span className="font-black text-sm md:text-base text-slate-900">{f.q}</span>
                <ChevronDown className={`w-5 h-5 text-[#E94F18] shrink-0 transition-transform ${open === i ? "rotate-180" : ""}`} />
              </button>
              {open === i && (
                <div className="px-5 pb-5 text-sm text-slate-600 leading-relaxed border-t border-[#FFC8A0]/40 pt-4">
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

/* ─── FINAL CTA ────────────────────────────────────────────── */
function FinalCTA() {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 md:px-8">
        <div className="rounded-[2.5rem] bg-gradient-to-br from-[#FF6B35] via-rose-500 to-[#E94F18] p-10 md:p-16 text-center relative overflow-hidden shadow-2xl shadow-[#FF6B35]/30">
          <div className="absolute inset-0 opacity-15 pointer-events-none"
               style={{
                 backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 1px)",
                 backgroundSize: "24px 24px",
               }} />
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-[#F59E0B]/30 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-rose-400/30 blur-3xl" />

          <div className="relative text-white">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#F59E0B] text-white mb-6 lp-animate-badge-bounce">
              🪔 14 din ka free trial · 🪔
            </div>
            <h2 className="text-5xl md:text-7xl font-black leading-[0.95]">
              Dukaan badhao.<br />
              <span className="text-[#FFE4D1]">Hum sab handle karenge.</span>
            </h2>
            <p className="mt-6 text-base md:text-lg opacity-90 max-w-xl mx-auto">
              14 din free. Koi credit card nahi. WhatsApp par 24×7 support.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link href={TRIAL_URL}
                 className="inline-flex items-center gap-2 px-7 py-4 rounded-full font-black text-[#B83A0A] bg-white hover:-translate-y-1 hover:shadow-2xl transition-all text-lg">
                Free Trial shuru karein <ArrowRight className="w-5 h-5" />
              </Link>
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener"
                 className="inline-flex items-center gap-2 px-6 py-4 rounded-full font-black text-white bg-[#138808] hover:bg-[#0F7C57] transition-all">
                <MessageCircle className="w-5 h-5" /> WhatsApp Demo
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── FOOTER ───────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="bg-slate-900 text-white pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex flex-wrap items-center justify-center gap-6 pb-10 border-b border-white/10 text-xs font-bold uppercase tracking-widest text-white/50">
          <div className="flex items-center gap-2"><Lock className="w-4 h-4 text-[#FFA86B]" /> Bank-grade Encryption</div>
          <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-[#B5FF6A]" /> GST Certified</div>
          <div className="flex items-center gap-2"><Headphones className="w-4 h-4 text-amber-300" /> Live Support</div>
          <div className="flex items-center gap-2"><span className="text-base">🇮🇳</span> Made in Bharat</div>
        </div>

        <div className="grid md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10 mt-10">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6B35] to-[#E94F18] flex items-center justify-center text-white font-black ring-2 ring-white/10">
                <span className="italic text-lg" style={{ fontFamily: "var(--font-display)" }}>A</span>
              </div>
              <div>
                <div className="font-black text-lg">AddisonX</div>
                <div className="text-[10px] font-black tracking-[0.2em] text-[#FFA86B] -mt-0.5">Dukaan ka Software</div>
              </div>
            </div>
            <p className="text-sm text-white/60 leading-relaxed max-w-xs">
              India's simplest billing software. Made by shopkeepers, for shopkeepers.
            </p>
          </div>

          {[
            { title: "Product",    items: ["Features", "Pricing", "Demo", "Sign In"] },
            { title: "Industries", items: ["Kirana", "Gift Shop", "Pharmacy", "Mobile"] },
            { title: "Company",    items: ["About", "Blog", "Terms", "Privacy", "Refund"] },
          ].map((col, i) => (
            <div key={i}>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-4">{col.title}</p>
              <ul className="space-y-2.5">
                {col.items.map((it, j) => (
                  <li key={j}>
                    <a href="#" className="text-sm text-white/70 hover:text-[#FFA86B] transition-colors">{it}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs text-white/40">
          <p>© {new Date().getFullYear()} AddisonX Media. All rights reserved.</p>
          <div className="flex items-center gap-3">
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`} className="hover:text-[#FFA86B] font-bold">+91 99999 99999</a>
            <span className="text-white/20">·</span>
            <a href="mailto:hello@addisonxmedia.com" className="hover:text-[#FFA86B] font-bold">hello@addisonxmedia.com</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─── STICKY MOBILE CTA ────────────────────────────────────── */
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
    <div className="md:hidden fixed bottom-4 inset-x-4 z-40 lp-animate-fade-up">
      <Link href={TRIAL_URL}
         className="flex items-center justify-center gap-2 w-full px-5 py-4 rounded-full font-black text-white bg-gradient-to-r from-[#FF6B35] to-[#E94F18] shadow-2xl shadow-[#FF6B35]/40">
        <Sparkles className="w-5 h-5" />
        Free Trial shuru karein — 14 din
        <ArrowRight className="w-5 h-5" />
      </Link>
    </div>
  );
}
