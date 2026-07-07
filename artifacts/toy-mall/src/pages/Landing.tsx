import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useSeo, SITE } from "@/lib/seo";
import {
  ScanLine, Receipt, QrCode, Boxes, BarChart3, Sparkles,
  Check, X, ArrowRight, Star, Shield, MessageCircle,
  ShoppingBag, Pill, Shirt, Gem, Smartphone, Wrench,
  PenTool, Heart, Menu, ChevronDown, TrendingUp,
  Headphones, Wifi, Lock, Banknote, Flame, Crown, Trophy,
  Instagram, Facebook, Youtube, Linkedin, Twitter, Mail, Phone,
  MapPin, Globe, Award,
} from "lucide-react";

const WHATSAPP_NUMBER = "919142647797";
const TRIAL_URL       = "/login";

/* ═══════════════════════════════════════════════════════════════
   Addison Bill — Indian-show landing.
   Bold copy, marigold garland, mandala motifs, gold-foil headings,
   wedding-invitation pricing card, Bollywood-poster shadows.
═══════════════════════════════════════════════════════════════ */
export default function Landing() {
  useSeo({
    path: "/",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  });
  return (
    <div className="min-h-screen text-slate-900 lp-cream overflow-x-hidden selection:bg-[#FF6B35] selection:text-white">
      <Garland />
      <OfferStrip />
      <Nav />
      <main>
        <Hero />
        <LiveCounter />
        <LogoMarquee />
        <Features />
        <HowItWorks />
        <Industries />
        <Comparison />
        <Pricing />
        <Testimonial />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
      <StickyCTA />
    </div>
  );
}

/* ─── 1. Animated bulb garland — sits behind everything ────── */
function Garland() {
  return (
    <div aria-hidden className="pointer-events-none fixed top-0 inset-x-0 z-40 overflow-hidden">
      <div className="relative h-7 w-full">
        {/* curve string */}
        <svg viewBox="0 0 1200 28" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          <path d="M0,4 Q300,22 600,8 T1200,6" stroke="rgba(120,53,15,0.35)" strokeWidth="1.5" fill="none" />
        </svg>
        {/* bulb row */}
        <div className="absolute inset-x-0 top-3 lp-garland" style={{ animation: "lp-garland-sway 4s ease-in-out infinite" }} />
      </div>
    </div>
  );
}

/* ─── 2. Top festive strip ─────────────────────────────────── */
function OfferStrip() {
  return (
    <div className="bg-gradient-to-r from-[#B83A0A] via-[#E94F18] to-[#B83A0A] text-white text-center py-2 px-4 text-[12px] md:text-[13px] font-bold mt-7 relative z-30">
      <span className="inline-flex items-center gap-2">
        <span className="text-base lp-flame inline-block">🎀</span>
        <span>RAKSHA BANDHAN DHAMAKA · pehle 100 dukaandaars ke liye — </span>
        <span className="bg-[#F59E0B] text-[#0B0B11] px-2 py-0.5 rounded-full font-black uppercase tracking-wider">50% DISCOUNT</span>
        <span className="text-base lp-flame inline-block">🎀</span>
      </span>
    </div>
  );
}

/* ─── 3. NAV ───────────────────────────────────────────────── */
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
    { href: "#faq",      label: "Sawal?" },
  ];

  return (
    <nav className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#FFFBF5]/90 backdrop-blur-xl border-b-2 border-[#FFC8A0]/60 shadow-sm" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-20 flex items-center justify-between">
        <a href="#top" className="flex items-center group">
          <img src="/logo2.png" alt="AddisonBill — Dukaan ka Software" className="h-14 md:h-16 w-auto transition-transform group-hover:scale-[1.03]" />
        </a>

        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <a key={l.href} href={l.href}
               className="px-3.5 py-2 rounded-full text-[13px] font-bold text-slate-700 hover:text-[#B83A0A] hover:bg-[#FFE4D1]/60 transition-all">
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=AddisonBill%20demo%20chahiye`} target="_blank" rel="noopener"
             className="group/wa flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-black text-white bg-gradient-to-r from-[#25D366] to-[#128C7E] ring-2 ring-[#25D366]/30 shadow-md shadow-[#128C7E]/30 hover:shadow-lg hover:shadow-[#128C7E]/40 hover:-translate-y-0.5 transition-all">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 transition-transform group-hover/wa:scale-110" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.967-.94 1.165-.173.197-.347.222-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Contact for Demo
          </a>
          <Link href={TRIAL_URL}
             className="group px-5 py-2.5 rounded-full text-[13px] font-black text-white bg-gradient-to-r from-[#FF6B35] to-[#B83A0A] hover:shadow-lg hover:shadow-[#B83A0A]/40 hover:-translate-y-0.5 transition-all ring-2 ring-[#F59E0B]/40">
            Sign In →
          </Link>
        </div>

        <button onClick={() => setOpen((v) => !v)}
                className="md:hidden w-9 h-9 rounded-xl bg-[#FF6B35]/10 text-[#B83A0A] flex items-center justify-center">
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
             className="block text-center mt-2 px-4 py-3 rounded-xl font-black text-white bg-gradient-to-r from-[#FF6B35] to-[#B83A0A]">
            Sign In →
          </Link>
        </div>
      )}
    </nav>
  );
}

/* ─── 4. HERO ──────────────────────────────────────────────── */
function Hero() {
  return (
    <section id="top" className="relative pt-10 md:pt-12 pb-16 md:pb-20 overflow-hidden">
      {/* Backdrop layers */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute inset-0 lp-mandala-bg" />
        <div className="absolute top-[-12%] left-[-8%] w-[55vw] h-[55vw] rounded-full bg-gradient-to-br from-[#FFA86B]/40 via-[#FF6B35]/25 to-transparent blur-3xl lp-animate-float-orb" />
        <div className="absolute top-[0%] right-[-15%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-br from-[#F59E0B]/35 to-rose-300/20 blur-3xl lp-animate-float-orb" style={{ animationDelay: "-9s" }} />
        <div className="absolute bottom-[-20%] left-[35%] w-[40vw] h-[40vw] rounded-full bg-gradient-to-br from-[#138808]/15 to-emerald-200/30 blur-3xl lp-animate-float-orb" style={{ animationDelay: "-14s" }} />

        {/* Falling petals (decorative) */}
        <span className="lp-petal text-2xl" style={{ left: "8%",  animationDuration: "14s", animationDelay: "0s",  color: "#FF6B35" }}>🌸</span>
        <span className="lp-petal text-xl"  style={{ left: "22%", animationDuration: "18s", animationDelay: "-3s", color: "#F59E0B" }}>🌼</span>
        <span className="lp-petal text-2xl" style={{ left: "45%", animationDuration: "16s", animationDelay: "-7s", color: "#FF6B35" }}>🌸</span>
        <span className="lp-petal text-xl"  style={{ left: "70%", animationDuration: "20s", animationDelay: "-10s",color: "#F59E0B" }}>🌼</span>
        <span className="lp-petal text-2xl" style={{ left: "90%", animationDuration: "15s", animationDelay: "-5s", color: "#FF6B35" }}>🌸</span>

        {/* Sparkles */}
        <span className="lp-sparkle absolute top-12 left-[6%] text-[#F59E0B] text-3xl" style={{ animationDelay: "0s" }}>✦</span>
        <span className="lp-sparkle absolute top-28 right-[10%] text-[#FF6B35] text-4xl" style={{ animationDelay: "-1s" }}>✦</span>
        <span className="lp-sparkle absolute bottom-32 left-[12%] text-[#FF6B35] text-2xl" style={{ animationDelay: "-2s" }}>✦</span>
        <span className="lp-sparkle absolute bottom-16 right-[8%] text-[#138808] text-3xl" style={{ animationDelay: "-1.5s" }}>✦</span>

        {/* Devanagari watermark behind headline (decorative only — no translation needed) */}
        <span className="lp-watermark hidden lg:block top-[28%] left-[2%] text-[12rem] leading-none">व्यापार</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 grid md:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-16 items-center">
        {/* LEFT */}
        <div className="lp-animate-fade-up relative z-10">

          {/* Live activity pill (above everything else) */}
          <div className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-full bg-white border-2 border-[#138808]/30 shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#138808] opacity-75 animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#138808]" />
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#0F7C57]">12 dukaan abhi billing kar rahi hain</span>
          </div>

          {/* Trust pills */}
          <div className="flex flex-wrap items-center gap-2 mb-7">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-white text-[#B83A0A] border-2 border-[#FFC8A0] shadow-sm">
              <span className="text-base">🇮🇳</span> Made in Bharat
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#138808] text-white shadow-sm">
              <Shield className="w-3 h-3" /> GST + UPI Ready
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#F59E0B] text-white shadow-sm">
              <Star className="w-3 h-3 fill-white" /> 4.9 · 100+ shops
            </span>
          </div>

          {/* Multi-color headline */}
          <h1 className="font-black tracking-tight leading-[0.9]">
            <span className="sr-only">Addison Bill — GST billing and inventory software for Indian shopkeepers. </span>
            <span className="block text-5xl md:text-6xl lg:text-7xl text-slate-900">
              Dukaan{" "}
              <span className="bg-gradient-to-br from-[#FF6B35] via-[#E94F18] to-[#B83A0A] bg-clip-text text-transparent">
                badhao,
              </span>
            </span>
            <span className="block text-5xl md:text-6xl lg:text-7xl mt-1">
              <span className="relative inline-block">
                <span className="lp-gold-foil">tension</span>
                <span aria-hidden className="absolute -bottom-1 left-0 right-0 h-4 bg-[#F59E0B]/35 rounded-full blur-md -z-0" />
              </span>
              {" "}
              <span className="lp-text-stroke">nahi!</span>
            </span>
          </h1>

          <p className="mt-5 text-base md:text-lg text-slate-700 leading-relaxed max-w-xl">
            <strong className="text-[#B83A0A]">5 second</strong> mein bill, UPI QR taiyaar, Stock apne aap count.
            <br />
            <span className="text-slate-600">Tally jaisa confusing nahi, WhatsApp jaisa simple.</span>
          </p>

          {/* CTAs */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href={TRIAL_URL}
               className="group relative inline-flex items-center gap-2 px-7 py-4 rounded-full font-black text-white bg-gradient-to-r from-[#FF6B35] via-[#E94F18] to-[#B83A0A] shadow-xl shadow-[#B83A0A]/40 hover:-translate-y-1 hover:shadow-2xl hover:shadow-[#B83A0A]/50 transition-all text-base ring-2 ring-[#F59E0B]/40">
              <Sparkles className="w-5 h-5" />
              <span>Free Trial shuru karein</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              {/* Pulse aura */}
              <span aria-hidden className="absolute inset-0 rounded-full lp-animate-pulse-soft pointer-events-none" />
            </Link>
            <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=Addison%20Bill%20demo%20chahiye`} target="_blank" rel="noopener"
               className="inline-flex items-center gap-2 px-5 py-4 rounded-full font-black text-[#0F7C57] bg-white border-2 border-[#138808]/40 hover:bg-[#138808]/5 hover:border-[#138808]/60 transition-all">
              <MessageCircle className="w-5 h-5" />
              <span>WhatsApp Demo</span>
            </a>
            <a href="#how" className="inline-flex items-center gap-2 px-3 py-3 rounded-full font-bold text-slate-700 hover:text-[#B83A0A] hover:bg-white/60 transition-all text-sm">
              <span className="inline-flex w-7 h-7 rounded-full bg-[#FFE4D1] items-center justify-center text-[#B83A0A]">▶</span>
              90-sec demo
            </a>
          </div>

          {/* Trust micro */}
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <div className="flex items-center gap-1.5 text-slate-600">
              <Check className="w-4 h-4 text-[#138808]" strokeWidth={3} /> <span>Credit card nahi</span>
            </div>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <div className="flex items-center gap-1.5 text-slate-600">
              <Check className="w-4 h-4 text-[#138808]" strokeWidth={3} /> <span>3 din Free</span>
            </div>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <div className="flex items-center gap-1.5 text-slate-600">
              <Check className="w-4 h-4 text-[#138808]" strokeWidth={3} /> <span>5-min setup</span>
            </div>
          </div>

          {/* Avatar stack with names */}
          <div className="mt-5 flex items-center gap-3 max-w-md">
            <div className="flex -space-x-2.5">
              {[
                { c: "#FF6B35", l: "HS" },
                { c: "#138808", l: "SK" },
                { c: "#F59E0B", l: "MG" },
                { c: "#8B5CF6", l: "AT" },
                { c: "#E94F18", l: "BP" },
              ].map((a, i) => (
                <div key={i}
                     className="w-9 h-9 rounded-full ring-2 ring-white shadow flex items-center justify-center font-black text-white text-[10px]"
                     style={{ background: `linear-gradient(135deg, ${a.c}, ${a.c}dd)` }}>
                  {a.l}
                </div>
              ))}
              <div className="w-9 h-9 rounded-full ring-2 ring-white shadow bg-slate-900 text-white flex items-center justify-center text-[9px] font-black">
                +95
              </div>
            </div>
            <div className="text-xs leading-tight">
              <div className="flex items-center gap-1 text-amber-500">
                {[1,2,3,4,5].map(i => <Star key={i} className="w-3 h-3 fill-current" />)}
                <span className="text-slate-900 font-black ml-1">4.9 / 5</span>
              </div>
              <div className="text-slate-500 text-[11px] font-bold">100+ dukaandaars · daily use</div>
            </div>
          </div>
        </div>

        {/* RIGHT — phone on mobile, laptop on desktop */}
        <div className="md:hidden">
          <PhoneMockup />
        </div>
        <div className="hidden md:block">
          <LaptopMockup />
        </div>
      </div>
    </section>
  );
}

function PhoneMockup() {
  return (
    <div className="relative mx-auto md:mr-0 max-w-[360px] lp-animate-fade-up" style={{ animationDelay: "150ms" }}>
      {/* Decorative ring behind phone */}
      <div className="absolute inset-[-30px] rounded-[3.5rem] bg-gradient-to-br from-[#F59E0B]/30 via-transparent to-[#FF6B35]/20 blur-2xl -z-10" />

      {/* Bharat-verified sticker */}
      <div className="absolute -top-4 -left-6 z-30 lp-animate-tilt">
        <div className="bg-gradient-to-br from-[#138808] to-[#0F7C57] text-white rounded-full px-3 py-2 shadow-xl shadow-[#138808]/30 ring-4 ring-white flex items-center gap-1.5">
          <span className="text-sm">🇮🇳</span>
          <span className="text-[10px] font-black uppercase tracking-wider leading-none">Bharat<br />Verified</span>
        </div>
      </div>

      {/* Floating ornate cards */}
      <div className="absolute -left-10 top-20 z-20 bg-white rounded-2xl px-3 py-2 shadow-xl shadow-[#B83A0A]/15 border border-[#FFC8A0]/50 lp-animate-float-y">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#138808] text-white flex items-center justify-center">
            <Check className="w-4 h-4" strokeWidth={3} />
          </div>
          <div className="text-xs">
            <div className="font-black text-slate-900">GST READY</div>
            <div className="text-slate-500 text-[10px]">CGST + SGST auto</div>
          </div>
        </div>
      </div>

      <div className="absolute -right-8 top-40 z-20 bg-white rounded-2xl px-3 py-2 shadow-xl shadow-[#F59E0B]/15 border border-[#FFC8A0]/50 lp-animate-float-y" style={{ animationDelay: "-2s" }}>
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

      <div className="absolute -left-6 bottom-32 z-20 bg-gradient-to-br from-[#FF6B35] to-[#B83A0A] text-white rounded-2xl px-3 py-2 shadow-xl shadow-[#B83A0A]/30 lp-animate-float-y" style={{ animationDelay: "-1s" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
            <Trophy className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="font-black">New sale!</div>
            <div className="text-white/80 text-[10px]">Bill #47 · ₹890</div>
          </div>
        </div>
      </div>

      {/* Live slide-in notification at top */}
      <div className="absolute right-[-20px] top-4 z-30 lp-animate-slide-in-right">
        <div className="bg-white rounded-2xl px-3 py-2 shadow-2xl border-2 border-[#138808]/30 flex items-center gap-2 min-w-[200px]">
          <div className="w-8 h-8 rounded-full bg-[#138808] text-white flex items-center justify-center">
            <Banknote className="w-4 h-4" />
          </div>
          <div className="text-xs flex-1">
            <div className="font-black text-slate-900">+ ₹950 just now</div>
            <div className="text-[#0F7C57] text-[10px] font-bold">Sharma Kirana · UPI</div>
          </div>
        </div>
      </div>

      {/* Phone — tilted slightly for drama */}
      <div className="relative bg-slate-900 rounded-[2.8rem] p-2.5 lp-poster-shadow"
           style={{ transform: "rotate(-2deg)" }}>
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-24 h-5 bg-slate-900 rounded-b-2xl z-10" />
        <div className="rounded-[2.2rem] bg-white overflow-hidden aspect-[9/19] relative">
          <div className="bg-gradient-to-br from-[#FFF6F0] via-white to-[#FFE4D1] h-full p-4 pt-8 flex flex-col">
            <div className="flex justify-between items-center text-[9px] text-slate-900 font-bold mb-3">
              <span>9:41</span>
              <span>5G ▮▮▮ 92%</span>
            </div>

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

/* ─── 4b. LAPTOP MOCKUP (desktop hero) ────────────────────── */
function LaptopMockup() {
  return (
    <div className="relative w-full max-w-[640px] mx-auto md:ml-auto lp-animate-fade-up" style={{ animationDelay: "150ms" }}>
      {/* Decorative halo behind laptop */}
      <div className="absolute inset-[-30px] rounded-[3rem] bg-gradient-to-br from-[#F59E0B]/30 via-transparent to-[#FF6B35]/20 blur-2xl -z-10" />

      {/* "Bharat Verified" sticker */}
      <div className="absolute -top-4 -left-4 z-30 lp-animate-tilt">
        <div className="bg-gradient-to-br from-[#138808] to-[#0F7C57] text-white rounded-full px-3 py-2 shadow-xl shadow-[#138808]/30 ring-4 ring-white flex items-center gap-1.5">
          <span className="text-sm">🇮🇳</span>
          <span className="text-[10px] font-black uppercase tracking-wider leading-none">Bharat<br />Verified</span>
        </div>
      </div>

      {/* Floating cards */}
      <div className="absolute -left-10 top-12 z-20 bg-white rounded-2xl px-3 py-2 shadow-xl shadow-[#B83A0A]/15 border border-[#FFC8A0]/50 lp-animate-float-y">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#138808] text-white flex items-center justify-center">
            <Check className="w-4 h-4" strokeWidth={3} />
          </div>
          <div className="text-xs">
            <div className="font-black text-slate-900">GST READY</div>
            <div className="text-slate-500 text-[10px]">CGST + SGST auto</div>
          </div>
        </div>
      </div>

      <div className="absolute -right-8 top-1/3 z-20 bg-white rounded-2xl px-3 py-2 shadow-xl shadow-[#F59E0B]/15 border border-[#FFC8A0]/50 lp-animate-float-y" style={{ animationDelay: "-2s" }}>
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

      {/* Live notification slide-in */}
      <div className="absolute right-[-20px] top-2 z-30 lp-animate-slide-in-right">
        <div className="bg-white rounded-2xl px-3 py-2 shadow-2xl border-2 border-[#138808]/30 flex items-center gap-2 min-w-[200px]">
          <div className="w-8 h-8 rounded-full bg-[#138808] text-white flex items-center justify-center">
            <Banknote className="w-4 h-4" />
          </div>
          <div className="text-xs flex-1">
            <div className="font-black text-slate-900">+ ₹950 just now</div>
            <div className="text-[#0F7C57] text-[10px] font-bold">Sharma Kirana · UPI</div>
          </div>
        </div>
      </div>

      {/* Laptop body */}
      <div className="relative">
        {/* Screen bezel */}
        <div className="relative bg-slate-900 rounded-t-2xl p-2.5 lp-poster-shadow">
          {/* Top notch (mac-style) */}
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-16 h-1 bg-slate-800 rounded-full z-10" />

          {/* Screen */}
          <div className="rounded-t-xl bg-[#0B0B11] overflow-hidden aspect-[16/10] relative border border-white/5">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-slate-900">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#4ADE5F]/70" />
              </div>
              <div className="ml-3 flex-1 flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/5 text-[9px] text-white/40" style={{ fontFamily: "var(--font-mono)" }}>
                <Lock className="w-2.5 h-2.5" /> addisonbill.in
              </div>
              <div className="text-[9px] text-white/30">9:41</div>
            </div>

            {/* Dashboard content — bento with light cream cards on dark screen */}
            <div className="p-4 grid grid-cols-12 gap-3 bg-gradient-to-br from-[#0B0B11] via-[#15151E] to-[#0B0B11]">

              {/* Header row */}
              <div className="col-span-12 flex items-center justify-between mb-1">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-white/40">Aapki dukaan</div>
                  <div className="text-base font-black text-white leading-tight">Aaj ka overview</div>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-[#138808]/20 text-[#B5FF6A]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8BFA3E] animate-pulse" /> LIVE
                </span>
              </div>

              {/* Big sales tile */}
              <div className="col-span-7 rounded-xl bg-gradient-to-br from-[#FF6B35]/15 to-[#FF6B35]/5 border border-[#FF6B35]/20 p-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#FF8A3D] to-transparent lp-animate-scan-line" />
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[8px] font-black tracking-widest uppercase text-[#FF8A3D]">Today's sales</div>
                    <div className="text-2xl font-black tabular-nums text-white mt-0.5">₹28,450</div>
                  </div>
                  <div className="text-[9px] text-[#8BFA3E] font-bold flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" />+52%
                  </div>
                </div>
                <div className="flex items-end gap-1 h-10 mt-2">
                  {[40, 55, 50, 70, 60, 85, 95, 75, 90].map((h, i) => (
                    <div key={i} className="flex-1 bg-gradient-to-t from-[#FF6B35] to-[#FFA86B] rounded-t opacity-90"
                         style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>

              {/* Bills */}
              <div className="col-span-5 rounded-xl bg-white/[0.03] border border-white/5 p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="text-[8px] font-black tracking-widest uppercase text-white/40">Bills</div>
                  <Receipt className="w-3 h-3 text-[#8BFA3E]" />
                </div>
                <div>
                  <div className="text-2xl font-black tabular-nums text-white">47</div>
                  <div className="text-[9px] text-white/50">vs 38 yesterday</div>
                </div>
              </div>

              {/* Mini stats row */}
              <div className="col-span-3 rounded-xl bg-white/[0.03] border border-white/5 p-3">
                <div className="text-[8px] font-black uppercase tracking-wider text-white/40">Items</div>
                <div className="text-lg font-black tabular-nums text-amber-300">134</div>
              </div>
              <div className="col-span-3 rounded-xl bg-white/[0.03] border border-white/5 p-3">
                <div className="text-[8px] font-black uppercase tracking-wider text-white/40">Stock</div>
                <div className="text-lg font-black tabular-nums text-violet-300">2,140</div>
              </div>
              <div className="col-span-3 rounded-xl bg-white/[0.03] border border-white/5 p-3">
                <div className="text-[8px] font-black uppercase tracking-wider text-white/40">Profit</div>
                <div className="text-lg font-black tabular-nums text-[#8BFA3E]">₹9.2k</div>
              </div>
              <div className="col-span-3 rounded-xl bg-white/[0.03] border border-white/5 p-3">
                <div className="text-[8px] font-black uppercase tracking-wider text-white/40">Margin</div>
                <div className="text-lg font-black tabular-nums text-rose-300">32%</div>
              </div>

              {/* Live bills row */}
              <div className="col-span-12 rounded-xl bg-white/[0.02] border border-white/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#8BFA3E] animate-pulse" />
                  <div className="text-[8px] font-black tracking-widest uppercase text-white/40">Live bills</div>
                  <div className="ml-auto text-[8px] text-white/30">just now</div>
                </div>
                <div className="space-y-1.5">
                  {[
                    { name: "Coffee Mug + Teddy Bear", amt: "₹449", t: "2s",  p: "UPI" },
                    { name: "Stationery Bundle",       amt: "₹275", t: "9s",  p: "CASH" },
                    { name: "Wooden Wind Chime",       amt: "₹598", t: "23s", p: "UPI" },
                  ].map((b, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px]">
                      <div className="w-0.5 h-5 rounded-full bg-gradient-to-b from-[#FF6B35] to-[#B83A0A]" />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-white truncate">{b.name}</div>
                        <div className="text-white/40 text-[9px]">{b.t} ago</div>
                      </div>
                      <div className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-white/5 text-white/60">{b.p}</div>
                      <div className="font-black tabular-nums text-white w-14 text-right">{b.amt}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Laptop base (keyboard hinge) */}
        <div className="relative h-3 bg-gradient-to-b from-slate-700 to-slate-900 rounded-b-[1.5rem]"
             style={{ width: "calc(100% + 28px)", marginLeft: "-14px" }}>
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-1.5 bg-slate-950 rounded-b-md" />
          {/* Foot */}
          <div className="absolute -bottom-1 inset-x-1/4 h-1 bg-slate-900 rounded-full opacity-50" />
        </div>
      </div>
    </div>
  );
}

/* ─── 5. LIVE COUNTER (Bollywood ticker) ──────────────────── */
function LiveCounter() {
  const [tracked, setTracked] = useState(2_84_50_823);
  useEffect(() => {
    const id = setInterval(() => setTracked((n) => n + Math.floor(Math.random() * 950 + 50)), 1700);
    return () => clearInterval(id);
  }, []);
  return (
    <section className="relative -mt-4 mb-12">
      <div className="max-w-5xl mx-auto px-4 md:px-8">
        <div className="rounded-3xl bg-gradient-to-r from-[#B83A0A] via-[#E94F18] to-[#FF6B35] text-white p-6 md:p-8 relative overflow-hidden shadow-2xl shadow-[#B83A0A]/30 lp-ornate-corner">
          <div className="absolute inset-0 opacity-10 pointer-events-none"
               style={{
                 backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 1px)",
                 backgroundSize: "20px 20px",
               }} />
          <div className="relative grid md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white/70">Aaj abhi tak</div>
              <div className="text-3xl md:text-5xl font-black tabular-nums mt-1 lp-counter-glow">
                ₹{tracked.toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] text-white/80 mt-0.5">tracked across all shops · live</div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white/70">Bills last hour</div>
              <div className="text-3xl md:text-5xl font-black tabular-nums mt-1 lp-gold-foil inline-block">2,847</div>
              <div className="text-[11px] text-white/80 mt-0.5">across India</div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white/70">Avg billing time</div>
              <div className="text-3xl md:text-5xl font-black tabular-nums mt-1 lp-gold-foil inline-block">3.2s</div>
              <div className="text-[11px] text-white/80 mt-0.5">scan → done</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── 6. LOGO MARQUEE ─────────────────────────────────────── */
function LogoMarquee() {
  const shops = [
    "Hira & Sons", "Sharma Kirana", "Mina Gift Shop", "Mukti Stationery",
    "Patel Medical", "Singh Cosmetics", "Royal Hardware", "Krishna Footwear",
    "Joy Bookstore", "Modern Mobile", "Anand Toys", "Bhagat Pharmacy",
  ];
  return (
    <section className="py-10 bg-white/60 border-y-2 border-[#FFC8A0]/40 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 md:px-8 mb-6">
        <p className="text-center text-[10px] font-black tracking-[0.3em] uppercase text-slate-500">
          ★ Trusted by 100+ shopkeepers across India ★
        </p>
      </div>
      <div className="lp-marquee gap-12 text-slate-400">
        {[...shops, ...shops].map((s, i) => (
          <div key={i} className="text-2xl whitespace-nowrap italic flex items-center gap-3" style={{ fontFamily: "var(--font-display)" }}>
            <span className="text-[#F59E0B]">✦</span>
            {s}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── 7. FEATURES (Bollywood poster cards) ─────────────────── */
function Features() {
  const features = [
    { Icon: ScanLine, color: "from-[#FF6B35] to-[#B83A0A]", chip: "bg-[#FFE4D1] text-[#B83A0A]",
      title: "3-second Billing", hindi: "3 second mein bill",
      desc: "Barcode scanner, camera, ya SKU type karo — cart instantly update ho jaata hai. Customer wait nahi karta." },
    { Icon: Receipt, color: "from-[#138808] to-[#0F7C57]", chip: "bg-[#D1FAE5] text-[#0F7C57]",
      title: "GST Invoice Print", hindi: "GST bill compliant",
      desc: "CGST + SGST auto-split, HSN, GSTIN, 80mm thermal — sab ready. Audit-proof." },
    { Icon: QrCode, color: "from-[#8B5CF6] to-[#6D28D9]", chip: "bg-violet-100 text-violet-700",
      title: "UPI QR on Bill", hindi: "Har bill par UPI",
      desc: "Customer scan kare, amount UPI app mein pre-filled. Paisa seconds mein." },
    { Icon: Boxes, color: "from-[#F59E0B] to-[#B45309]", chip: "bg-amber-100 text-amber-700",
      title: "Stock apne aap ghate", hindi: "Low-stock WhatsApp alert",
      desc: "Har bill par stock turant update. Out-of-stock se pehle WhatsApp alert." },
    { Icon: BarChart3, color: "from-rose-500 to-rose-700", chip: "bg-rose-100 text-rose-700",
      title: "Reports jo zaroori hai", hindi: "9pm Telegram digest",
      desc: "Roz profit, top sellers, slow movers — ek nazar mein. Phone vibrate hote hi pata chal jaye." },
    { Icon: Flame, color: "from-[#FF6B35] to-[#F59E0B]", chip: "bg-orange-100 text-orange-700",
      title: "Today's Deal", hindi: "One-tap discount",
      desc: "Ek tap mein sale price set karo, sab customer-facing pages par turant dikhe." },
  ];

  return (
    <section id="features" className="py-20 md:py-28 relative scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="text-[#F59E0B] text-xl">✦</span>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#B83A0A]">Features</p>
            <span className="text-[#F59E0B] text-xl">✦</span>
          </div>
          <h2 className="text-4xl md:text-7xl font-black tracking-tight leading-[0.9] text-slate-900">
            Jo chahiye, <span className="lp-gold-foil">sab hai.</span><br />
            <span className="text-slate-400 text-3xl md:text-5xl">Jo nahi chahiye, woh nahi.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div key={i}
                 className="group relative p-6 rounded-3xl bg-white border-2 border-[#FFC8A0]/40 hover:border-[#FF6B35]/60 lp-card-hover overflow-hidden transition-all"
                 style={{ animation: `lp-fade-up 0.6s ${i * 60}ms backwards` }}>
              <span className={`absolute top-4 right-4 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${f.chip}`}>
                {f.hindi}
              </span>
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${f.color} text-white flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-transform`}>
                <f.Icon className="w-7 h-7" />
              </div>
              <h3 className="mt-5 text-xl md:text-2xl font-black text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm md:text-base text-slate-600 leading-relaxed">{f.desc}</p>
              <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-gradient-to-br from-[#F59E0B]/20 to-transparent opacity-50 group-hover:opacity-100 transition-opacity blur-2xl" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── 8. HOW IT WORKS ──────────────────────────────────────── */
function HowItWorks() {
  const steps = [
    { n: 1, Icon: ScanLine, title: "Scan karo",        sub: "Add to cart",       desc: "Barcode scanner, USB, ya camera. Product turant cart mein." },
    { n: 2, Icon: Banknote, title: "Payment lo",       sub: "Cash ya UPI",       desc: "UPI QR auto-generate. Customer scan kare, paisa instant." },
    { n: 3, Icon: Sparkles, title: "App handle karegi", sub: "Baaki sab chhodo",  desc: "Stock update, daily report, GST — sab automatic." },
  ];
  return (
    <section id="how" className="py-20 md:py-28 bg-gradient-to-b from-white/60 to-transparent scroll-mt-24">
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="text-[#F59E0B] text-xl">✦</span>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#B83A0A]">How it works</p>
            <span className="text-[#F59E0B] text-xl">✦</span>
          </div>
          <h2 className="text-4xl md:text-7xl font-black tracking-tight text-slate-900 leading-[0.9]">
            3 step. <span className="lp-gold-foil">Poora din sorted.</span>
          </h2>
        </div>

        <div className="relative grid md:grid-cols-3 gap-6">
          {/* Dashed connector */}
          <div className="hidden md:block absolute top-20 left-[16%] right-[16%] -z-10">
            <svg viewBox="0 0 1000 10" className="w-full">
              <line x1="0" y1="5" x2="1000" y2="5" stroke="#F59E0B" strokeWidth="3" strokeDasharray="10 10" />
            </svg>
          </div>

          {steps.map((s, i) => (
            <div key={s.n} className="relative lp-animate-fade-up" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="lp-card lp-card-hover bg-white rounded-3xl p-7 transition-all border-2 border-[#FFC8A0]/40 hover:border-[#FF6B35]/60 relative overflow-hidden">
                {/* Giant step number watermark */}
                <div className="absolute -top-8 -right-4 text-[10rem] font-black text-[#FFC8A0]/30 leading-none select-none">{s.n}</div>

                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF6B35] to-[#B83A0A] text-white font-black flex items-center justify-center shadow-lg text-2xl ring-4 ring-white">
                    {s.n}
                  </div>
                  <s.Icon className="w-7 h-7 text-[#B83A0A] mt-4" />
                  <h3 className="text-2xl font-black text-slate-900 mt-3">{s.title}</h3>
                  <p className="text-sm font-bold text-[#B83A0A] uppercase tracking-wider mt-0.5">{s.sub}</p>
                  <p className="text-sm md:text-base text-slate-600 mt-3 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── 9. INDUSTRIES ────────────────────────────────────────── */
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
    <section id="industries" className="py-20 md:py-28 scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="text-[#F59E0B] text-xl">✦</span>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#B83A0A]">Who it's for</p>
            <span className="text-[#F59E0B] text-xl">✦</span>
          </div>
          <h2 className="text-4xl md:text-7xl font-black tracking-tight text-slate-900 leading-[0.9]">
            Aapki dukaan ke liye<br />
            <span className="lp-gold-foil">perfect hai?</span>
          </h2>
          <p className="mt-5 text-sm md:text-base text-slate-600 max-w-2xl mx-auto">
            Har woh dukaandaar jo 5 second mein bill chahta hai, GST compliant invoice chahta hai, aur apna time bachana chahta hai.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {shops.map((s, i) => (
            <div key={i}
                 className="group lp-card lp-card-hover p-5 rounded-2xl bg-white transition-all text-center border-2 border-[#FFC8A0]/40 hover:border-[#FF6B35]/60"
                 style={{ animation: `lp-fade-up 0.6s ${i * 50}ms backwards` }}>
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#FFE4D1] to-[#FCD9B6] text-[#B83A0A] flex items-center justify-center group-hover:bg-gradient-to-br group-hover:from-[#FF6B35] group-hover:to-[#B83A0A] group-hover:text-white group-hover:rotate-6 transition-all">
                <s.Icon className="w-7 h-7" />
              </div>
              <p className="font-black text-base mt-3 text-slate-900">{s.name}</p>
              <p className="text-xs font-bold text-[#B83A0A] mt-0.5">{s.hindi}</p>
            </div>
          ))}
        </div>

        <p className="text-center mt-10 text-sm text-slate-600">
          Aur restaurant, salon, jewellery, ya petrol pump bhi? <a href={`https://wa.me/${WHATSAPP_NUMBER}`} className="font-black text-[#B83A0A] hover:underline">WhatsApp par poochh lo →</a>
        </p>
      </div>
    </section>
  );
}

/* ─── 10. COMPARISON ───────────────────────────────────────── */
function Comparison() {
  const rows = [
    { feat: "5 second mein bill barcode se",      a: true, t: false as const },
    { feat: "Built-in UPI QR on checkout",        a: true, t: false as const },
    { feat: "Mobile + Desktop — same login",      a: true, t: false as const },
    { feat: "Today's Deal — instant discount",    a: true, t: false as const },
    { feat: "WhatsApp + Telegram daily report",   a: true, t: false as const },
    { feat: "Stock apne aap ghate",                a: true, t: "limited" as const },
    { feat: "GST / Accounting exports",            a: true, t: true as const },
  ];
  return (
    <section id="compare" className="py-20 md:py-28 bg-gradient-to-b from-[#FFE4D1]/30 to-transparent scroll-mt-24">
      <div className="max-w-5xl mx-auto px-4 md:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="text-[#F59E0B] text-xl">⚔️</span>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#B83A0A]">vs Tally / Vyapar</p>
            <span className="text-[#F59E0B] text-xl">⚔️</span>
          </div>
          <h2 className="text-3xl md:text-6xl font-black leading-[1.05] text-slate-900">
            <span className="text-slate-400 line-through decoration-2 decoration-rose-300">Tally accountants ke liye hai.</span><br />
            <span className="lp-gold-foil">Addison Bill</span> dukaandaaron ke liye.
          </h2>
        </div>

        <div className="rounded-3xl bg-white shadow-2xl shadow-[#B83A0A]/10 overflow-hidden lp-conic-border">
          <div className="grid grid-cols-[1.4fr_1fr_1fr] text-[11px] md:text-sm font-black uppercase tracking-wider">
            <div className="p-4 md:p-5 bg-[#FFE4D1]/40 text-slate-700">Feature</div>
            <div className="p-4 md:p-5 text-center bg-gradient-to-br from-[#FF6B35] via-[#E94F18] to-[#B83A0A] text-white relative">
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[#F59E0B] text-white text-[9px] rounded-full font-black lp-animate-badge-bounce whitespace-nowrap ring-2 ring-white">
                <Crown className="inline w-3 h-3 mr-1 -mt-0.5" /> RECOMMENDED
              </span>
              Addison Bill
            </div>
            <div className="p-4 md:p-5 text-center bg-slate-100 text-slate-500">Tally / Vyapar</div>
          </div>

          {rows.map((r, i) => (
            <div key={i} className={`grid grid-cols-[1.4fr_1fr_1fr] text-sm border-t border-[#FFC8A0]/40 ${i % 2 === 0 ? "bg-white" : "bg-[#FFE4D1]/15"}`}>
              <div className="p-4 md:p-5 font-bold text-slate-800">{r.feat}</div>
              <div className="p-4 md:p-5 text-center">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#138808] text-white shadow-md shadow-[#138808]/40">
                  <Check className="w-5 h-5" strokeWidth={3} />
                </span>
              </div>
              <div className="p-4 md:p-5 text-center">
                {r.t === true ? (
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-200 text-slate-600">
                    <Check className="w-4 h-4" />
                  </span>
                ) : r.t === false ? (
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-rose-100 text-rose-500">
                    <X className="w-4 h-4" />
                  </span>
                ) : (
                  <span className="inline-block px-2 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-700">limited</span>
                )}
              </div>
            </div>
          ))}

          <div className="grid grid-cols-[1.4fr_1fr_1fr] text-sm border-t-2 border-[#FFC8A0]/60 bg-[#FFE4D1]/40">
            <div className="p-4 md:p-5 font-black uppercase text-[11px] tracking-wider text-slate-700">Built for</div>
            <div className="p-4 md:p-5 text-center font-black text-[#B83A0A] text-base">Dukaandaars 👑</div>
            <div className="p-4 md:p-5 text-center font-black text-slate-500">CA / Accountants</div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">
          *Tally and Vyapar are great tools — for accountants. Addison Bill is built shoulder-to-shoulder with shopkeepers.
        </p>
      </div>
    </section>
  );
}

/* ─── 11. PRICING (Wedding-invite card) ────────────────────── */
function Pricing() {
  /* Price is vendor-controlled from /admin (platform_settings) and served by
     the public /api/public/pricing endpoint. Defaults keep the card populated
     on first paint and if the API is ever unreachable. ₹/month and ₹/day are
     DERIVED from the deal price so they can never disagree with it. */
  const [pricing, setPricing] = useState({ dealPrice: 4999, originalPrice: 9999 });
  useEffect(() => {
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    fetch(`${base}/api/public/pricing`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const deal = Number(d?.dealPrice);
        const orig = Number(d?.originalPrice);
        if (Number.isFinite(deal) && Number.isFinite(orig)) {
          setPricing({ dealPrice: deal, originalPrice: orig });
        }
      })
      .catch(() => {});
  }, []);
  const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  const perMonth = Math.round(pricing.dealPrice / 12);
  const perDay   = Math.round(pricing.dealPrice / 365);
  return (
    <section id="pricing" className="py-20 md:py-28 relative overflow-hidden scroll-mt-24">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/2 -left-20 w-80 h-80 rounded-full bg-[#FFA86B]/30 blur-3xl lp-animate-float-orb" />
        <div className="absolute top-1/2 -right-20 w-80 h-80 rounded-full bg-[#F59E0B]/25 blur-3xl lp-animate-float-orb" style={{ animationDelay: "-9s" }} />
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="text-[#F59E0B] text-xl">✦</span>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#B83A0A]">Pricing</p>
            <span className="text-[#F59E0B] text-xl">✦</span>
          </div>
          <h2 className="text-4xl md:text-7xl font-black tracking-tight text-slate-900 leading-[0.9]">
            <span className="lp-gold-foil">Honest pricing.</span><br />
            Koi chhupa charge nahi.
          </h2>
          <p className="mt-5 text-sm md:text-base text-slate-600">
            Pay monthly ya yearly. Cancel anytime. Setup <strong>FREE</strong>.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 md:gap-6 max-w-4xl mx-auto">
          {/* Free Trial */}
          <div className="relative p-7 md:p-8 rounded-3xl bg-white border-2 border-[#FFC8A0]/40">
            <div className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 mb-4">Free Trial</div>
            <h3 className="text-2xl font-black text-slate-900">Pehle try karo, baad mein decide</h3>
            <div className="text-6xl md:text-7xl font-black tabular-nums mt-5 text-slate-900">3 <span className="text-2xl text-slate-500">din</span></div>
            <p className="text-sm text-slate-500 mt-1">Koi credit card nahi</p>

            <ul className="mt-7 space-y-2.5 text-sm">
              {[
                "Unlimited products + bills",
                "GST invoice + UPI QR",
                "Stock auto-update",
                "Email + WhatsApp support",
                "Sab features ON",
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

          {/* Paid — wedding-invitation style */}
          <div className="relative rounded-3xl bg-gradient-to-br from-[#FF6B35] via-[#E94F18] to-[#B83A0A] text-white overflow-hidden shadow-2xl shadow-[#B83A0A]/40 p-7 md:p-9 lp-ornate-corner ring-4 ring-[#F59E0B]/50">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[#F59E0B]/30 blur-2xl" />
            <div className="absolute inset-0 opacity-15"
                 style={{
                   backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 1px)",
                   backgroundSize: "20px 20px",
                 }} />

            <div className="relative">
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#F59E0B] text-white">★ BESTSELLER</span>
                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 backdrop-blur">1 Year</span>
              </div>

              <p className="text-center text-[11px] font-bold uppercase tracking-[0.25em] opacity-80">— Most popular —</p>
              <h3 className="text-center text-3xl font-black mt-1">Pro · Annual</h3>
              <p className="text-center text-sm opacity-80 mt-1">90%+ shopkeepers choose this</p>

              <div className="text-center mt-6 flex items-baseline gap-3 justify-center">
                <span className="text-xl line-through opacity-50 tabular-nums">{inr(pricing.originalPrice)}</span>
                <span className="text-7xl md:text-8xl font-black tabular-nums lp-counter-glow">{inr(pricing.dealPrice)}</span>
              </div>
              <p className="text-center text-sm opacity-90 mt-1.5">
                = <strong>{inr(perMonth)}/month</strong> · {inr(perDay)}/day · ek chai se kam
              </p>
              <p className="text-center text-[11px] font-black uppercase tracking-wider mt-2 text-[#FFE4D1]">
                🔥 Sirf pehle 100 dukaandaar ke liye
              </p>

              <div className="my-7 flex items-center gap-3">
                <div className="flex-1 h-px bg-white/30" />
                <span className="text-[#F59E0B] text-xl">✦</span>
                <div className="flex-1 h-px bg-white/30" />
              </div>

              <ul className="space-y-2.5 text-sm">
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
                 className="mt-7 inline-flex w-full items-center justify-center gap-2 px-5 py-4 rounded-2xl font-black text-[#B83A0A] bg-white hover:bg-[#FFE4D1] hover:-translate-y-0.5 transition-all shadow-xl text-base">
                Subscribe karein <ArrowRight className="w-4 h-4" />
              </Link>

              <p className="text-[11px] text-center opacity-80 mt-3">
                ✓ 3 din free trial &nbsp;·&nbsp; ✓ Pro-rata refund &nbsp;·&nbsp; ✓ Kabhi bhi cancel
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── 12. TESTIMONIAL ──────────────────────────────────────── */
function Testimonial() {
  return (
    <section className="py-20 md:py-28 bg-gradient-to-br from-[#FF6B35] via-[#E94F18] to-[#B83A0A] text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-15 pointer-events-none"
           style={{
             backgroundImage: "radial-gradient(circle at 25% 25%, white 1px, transparent 1px)",
             backgroundSize: "32px 32px",
           }} />

      <div className="max-w-4xl mx-auto px-4 md:px-8 text-center relative">
        <div className="flex justify-center gap-1 mb-6">
          {[1,2,3,4,5].map(i => <Star key={i} className="w-7 h-7 fill-[#F59E0B] text-[#F59E0B]" />)}
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70 mb-4">— What shopkeepers say —</p>
        <blockquote className="text-3xl md:text-5xl font-black leading-tight">
          "Hamara cashier saalon se Tally par tha. 2 din mein Addison Bill seekh gaya. <span className="lp-gold-foil inline-block">Ab wapas nahi jaayega.</span>"
        </blockquote>
        <div className="mt-10 inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/15 backdrop-blur border border-white/20">
          <div className="w-12 h-12 rounded-full bg-[#F59E0B] flex items-center justify-center font-black text-white text-lg ring-2 ring-white">SK</div>
          <div className="text-left">
            <p className="font-black text-base">Sharma Kirana Store</p>
            <p className="text-xs opacity-80">Indore · 4 months on Addison Bill</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── 13. FAQ ──────────────────────────────────────────────── */
export const FAQS = [
    { q: "Kya mujhe install karna padega?",
      a: "Nahi. Addison Bill cloud par chalta hai — Chrome, Edge, Safari, ya mobile par browser kholo, login karo, bas." },
    { q: "Kaun sa hardware chahiye?",
      a: "Minimum: ek Android phone ya laptop. Recommended: 80mm thermal printer (agar bill print karna hai), USB barcode scanner." },
    { q: "Internet zaroori hai?",
      a: "Haan — Addison Bill cloud par chalta hai, isliye aapka data har device par turant sync aur auto-backup rehta hai, kabhi kho nahi sakta. Ek normal mobile data ya WiFi connection kaafi hai." },
    { q: "Mera data safe hai?",
      a: "Bank-grade encryption, daily backups, Indian servers. Koi access nahi karta aapka data — hum bhi nahi." },
    { q: "GST ke setup mein help milegi?",
      a: "Haan. Free onboarding call (Hindi/English) — aapka GSTIN, HSN codes, opening stock — sab hum setup kar denge." },
    { q: "Cancel karna ho toh?",
      a: "Ek click. Pro-rata refund. Koi 'cancellation fee' nahi. Aapka data bhi CSV mein export karke de denge." },
];

function FAQ() {
  const faqs = FAQS;
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-20 md:py-28 scroll-mt-24">
      <div className="max-w-3xl mx-auto px-4 md:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="text-[#F59E0B] text-xl">?</span>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#B83A0A]">FAQ</p>
            <span className="text-[#F59E0B] text-xl">?</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 leading-[0.9]">
            Shuru karne se pehle<br />
            <span className="lp-gold-foil">kuchh sawal?</span>
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((f, i) => (
            <div key={i} className="rounded-2xl bg-white border-2 border-[#FFC8A0]/40 overflow-hidden hover:border-[#FF6B35]/50 transition-colors">
              <button onClick={() => setOpen(open === i ? null : i)}
                      className="w-full flex items-center justify-between gap-4 p-5 text-left">
                <span className="font-black text-base md:text-lg text-slate-900">{f.q}</span>
                <ChevronDown className={`w-5 h-5 text-[#B83A0A] shrink-0 transition-transform ${open === i ? "rotate-180" : ""}`} />
              </button>
              {open === i && (
                <div className="px-5 pb-5 text-sm md:text-base text-slate-600 leading-relaxed border-t-2 border-[#FFC8A0]/40 pt-4">
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

/* ─── 14. FINAL CTA (fireworks finale) ─────────────────────── */
function FinalCTA() {
  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 md:px-8">
        <div className="rounded-[2.5rem] bg-gradient-to-br from-[#FF6B35] via-[#E94F18] to-[#B83A0A] p-10 md:p-16 text-center relative overflow-hidden shadow-2xl shadow-[#B83A0A]/40 lp-ornate-corner ring-4 ring-[#F59E0B]/30">
          <div className="absolute inset-0 opacity-15 pointer-events-none"
               style={{
                 backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 1px)",
                 backgroundSize: "24px 24px",
               }} />
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-[#F59E0B]/30 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-rose-400/30 blur-3xl" />

          {/* Sparkle decoration */}
          <span className="lp-sparkle absolute top-8 left-12 text-white text-3xl" style={{ animationDelay: "0s" }}>✦</span>
          <span className="lp-sparkle absolute top-16 right-16 text-white text-2xl" style={{ animationDelay: "-1s" }}>✦</span>
          <span className="lp-sparkle absolute bottom-12 left-20 text-white text-2xl" style={{ animationDelay: "-2s" }}>✦</span>
          <span className="lp-sparkle absolute bottom-20 right-12 text-white text-3xl" style={{ animationDelay: "-1.5s" }}>✦</span>

          <div className="relative text-white">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#F59E0B] text-white mb-6 lp-animate-badge-bounce ring-2 ring-white/30">
              🪔 3 din free trial — koi credit card nahi · 🪔
            </div>
            <h2 className="text-5xl md:text-8xl font-black leading-[0.9]">
              Dukaan badhao.<br />
              <span className="lp-gold-foil inline-block">Hum sab handle karenge.</span>
            </h2>
            <p className="mt-6 text-base md:text-lg opacity-90 max-w-xl mx-auto">
              3 din free. Koi credit card nahi. WhatsApp par 24×7 support.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link href={TRIAL_URL}
                 className="inline-flex items-center gap-2 px-8 py-5 rounded-full font-black text-[#B83A0A] bg-white hover:-translate-y-1 hover:shadow-2xl transition-all text-xl ring-2 ring-[#F59E0B]/30">
                <Sparkles className="w-5 h-5" />
                Free Trial shuru karein <ArrowRight className="w-5 h-5" />
              </Link>
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener"
                 className="inline-flex items-center gap-2 px-7 py-5 rounded-full font-black text-white bg-[#138808] hover:bg-[#0F7C57] transition-all text-lg">
                <MessageCircle className="w-5 h-5" /> WhatsApp Demo
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── 15. FOOTER ───────────────────────────────────────────── */
function Footer() {
  const cities = [
    "Mumbai", "Delhi", "Bengaluru", "Pune", "Indore", "Hyderabad",
    "Jaipur", "Ahmedabad", "Lucknow", "Kanpur", "Surat", "Patna",
    "Bhopal", "Ranchi", "Nagpur", "Kochi", "Coimbatore", "Chandigarh",
  ];

  return (
    <footer className="relative bg-slate-900 text-white pt-20 pb-8 overflow-hidden">
      {/* Scalloped/dotted top edge */}
      <div aria-hidden className="absolute top-0 inset-x-0 h-6 lp-section-divider opacity-50" />

      {/* Background orbs */}
      <div aria-hidden className="absolute inset-0 -z-0 pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-[#FF6B35]/10 blur-3xl lp-animate-float-orb" />
        <div className="absolute bottom-0 -right-32 w-96 h-96 rounded-full bg-[#F59E0B]/10 blur-3xl lp-animate-float-orb" style={{ animationDelay: "-9s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#138808]/5 blur-3xl" />
        {/* Faint dot grid */}
        <div className="absolute inset-0 opacity-[0.06]"
             style={{
               backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
               backgroundSize: "32px 32px",
             }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">

        {/* ─ 1. Newsletter / connect card ─ */}
        <div className="rounded-3xl bg-gradient-to-br from-[#FF6B35]/15 via-slate-800/40 to-[#138808]/15 backdrop-blur p-6 md:p-10 border border-white/10 mb-14 relative overflow-hidden">
          <div aria-hidden className="absolute top-0 right-0 w-64 h-64 rounded-full bg-[#F59E0B]/10 blur-3xl" />
          <div className="relative grid md:grid-cols-[1.3fr_1fr] gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#F59E0B]/20 text-[#FBBF24] border border-[#F59E0B]/40 mb-4">
                <Sparkles className="w-3 h-3" /> Weekly tips for dukaandaars
              </div>
              <h3 className="text-3xl md:text-4xl font-black leading-tight">
                Dukaan-growth tips, <span className="lp-gold-foil">har Sunday subah.</span>
              </h3>
              <p className="mt-2 text-sm md:text-base text-white/60 max-w-md">
                Free WhatsApp digest — GST updates, festival sale ideas, real shopkeeper stories. Spam nahi, unsubscribe kabhi bhi.
              </p>
            </div>
            <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=Subscribe%20Sunday%20Tips`}
               target="_blank" rel="noopener"
               className="group inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-black text-white bg-[#138808] hover:bg-[#0F7C57] hover:-translate-y-0.5 transition-all shadow-xl shadow-[#138808]/30 ring-2 ring-[#138808]/40 text-base">
              <MessageCircle className="w-5 h-5" />
              <span>Join WhatsApp list</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>

        {/* ─ 2. Trust badge strip ─ */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-14">
          {[
            { Icon: Lock,       label: "Bank-grade",      sub: "encryption",       color: "text-[#FFA86B]" },
            { Icon: Shield,     label: "GST Certified",   sub: "audit-ready",      color: "text-[#B5FF6A]" },
            { Icon: Headphones, label: "Live Support",    sub: "12-min avg reply", color: "text-amber-300" },
            { Icon: Wifi,       label: "Realtime Sync",   sub: "cloud backup",     color: "text-violet-300" },
            { Icon: Award,      label: "100+ shops",      sub: "4.9 stars",        color: "text-rose-300" },
          ].map((b, i) => (
            <div key={i} className="px-3 py-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl bg-white/[0.05] flex items-center justify-center shrink-0 ${b.color}`}>
                <b.Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-white truncate">{b.label}</div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider truncate">{b.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ─ 3. Main grid ─ */}
        <div className="grid md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10">

          {/* Brand col */}
          <div>
            <a href="#top" className="inline-flex mb-5 group">
              <div className="rounded-2xl bg-[#FFFBF5] px-4 py-2.5 ring-1 ring-white/10 shadow-lg shadow-black/30 group-hover:scale-[1.02] transition-transform">
                <img src="/logo2.png" alt="Addison Bill — Dukaan ka Software" className="h-10 w-auto" />
              </div>
            </a>
            <p className="text-sm text-white/65 leading-relaxed max-w-xs mb-5">
              India's simplest billing software. Made by shopkeepers, for shopkeepers — not by accountants for CAs.
            </p>

            {/* Social */}
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-3">Follow us</p>
            <div className="flex items-center gap-2">
              {[
                { Icon: Instagram, label: "Instagram", color: "hover:bg-gradient-to-br hover:from-purple-500 hover:via-pink-500 hover:to-yellow-400" },
                { Icon: Youtube,   label: "YouTube",   color: "hover:bg-red-500" },
                { Icon: Facebook,  label: "Facebook",  color: "hover:bg-blue-500" },
                { Icon: Twitter,   label: "X",         color: "hover:bg-slate-700" },
                { Icon: Linkedin,  label: "LinkedIn",  color: "hover:bg-blue-600" },
              ].map((s, i) => (
                <a key={i} href="#" aria-label={s.label}
                   className={`w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 hover:border-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all ${s.color}`}>
                  <s.Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {[
            { title: "Product", links: [
              { label: "Features", href: "#features", kind: "anchor" },
              { label: "Pricing",  href: "#pricing",  kind: "anchor" },
              { label: "vs Tally", href: "#compare",  kind: "anchor" },
              { label: "FAQ",      href: "#faq",      kind: "anchor" },
              { label: "Sign In",  href: TRIAL_URL,   kind: "route" },
            ]},
            { title: "Industries", links: [
              { label: "Kirana",    href: "#industries", kind: "anchor" },
              { label: "Gift Shop", href: "#industries", kind: "anchor" },
              { label: "Pharmacy",  href: "#industries", kind: "anchor" },
              { label: "Mobile",    href: "#industries", kind: "anchor" },
              { label: "Fashion",   href: "#industries", kind: "anchor" },
            ]},
            { title: "Company", links: [
              { label: "About us", href: "#compare", kind: "anchor" },
              { label: "Contact",  href: `https://wa.me/${WHATSAPP_NUMBER}?text=Addison%20Bill%20demo%20chahiye`, kind: "external" },
              { label: "Terms",    href: "/terms",   kind: "route" },
              { label: "Privacy",  href: "/privacy", kind: "route" },
              { label: "Refund",   href: "/refund",  kind: "route" },
            ]},
          ].map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-4 flex items-center gap-1.5">
                <span className="w-4 h-px bg-[#FFA86B]" />
                {col.title}
              </p>
              <ul className="space-y-2.5">
                {col.links.map((l) => {
                  const cls = "text-sm text-white/70 hover:text-[#FFA86B] hover:translate-x-1 inline-block transition-all";
                  return (
                    <li key={l.label}>
                      {l.kind === "route" ? (
                        <Link href={l.href} className={cls}>{l.label}</Link>
                      ) : l.kind === "external" ? (
                        <a href={l.href} target="_blank" rel="noopener" className={cls}>{l.label}</a>
                      ) : (
                        <a href={l.href} className={cls}>{l.label}</a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>
          ))}
        </div>

        {/* ─ 4. Direct contact row ─ */}
        <div className="mt-12 grid md:grid-cols-3 gap-3">
          <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener"
             className="group flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/10 hover:bg-[#138808]/15 hover:border-[#138808]/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#138808] text-white flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-white/40">WhatsApp</div>
              <div className="font-black text-white">+91 91426 47797</div>
            </div>
          </a>
          <a href="mailto:contact@addisonbill.in"
             className="group flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/10 hover:bg-[#FF6B35]/15 hover:border-[#FF6B35]/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#FF6B35] text-white flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-wider text-white/40">Email</div>
              <div className="font-black text-white text-sm truncate">contact@addisonbill.in</div>
            </div>
          </a>
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/10">
            <div className="w-10 h-10 rounded-xl bg-[#F59E0B] text-white flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-white/40">HQ</div>
              <div className="font-black text-white text-sm">Ranchi</div>
            </div>
          </div>
        </div>

        {/* ─ 5. Cities marquee ─ */}
        <div className="mt-12 pt-8 border-t border-white/10 overflow-hidden">
          <p className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-4">
            Dukaandaars in
          </p>
          <div className="lp-marquee gap-8 text-sm text-white/40">
            {[...cities, ...cities].map((c, i) => (
              <span key={i} className="whitespace-nowrap flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#FFA86B]" />
                {c}
              </span>
            ))}
          </div>
        </div>

        {/* ─ 6. Bottom row ─ */}
        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs">
          <p className="text-white/40">
            © {new Date().getFullYear()} Addison Bill Media · Built with <span className="text-[#FF6B35]">♥</span> in <span className="text-[#FFA86B] font-bold">Bharat 🇮🇳</span>
          </p>
          <div className="flex items-center gap-2 text-white/40">
            <span className="font-bold uppercase tracking-wider text-[10px]">We accept</span>
            <span className="px-2 py-1 rounded-md bg-white/5 text-[10px] font-black text-white border border-white/10">UPI</span>
            <span className="px-2 py-1 rounded-md bg-white/5 text-[10px] font-black text-white border border-white/10">Razorpay</span>
            <span className="px-2 py-1 rounded-md bg-white/5 text-[10px] font-black text-white border border-white/10">VISA</span>
            <span className="px-2 py-1 rounded-md bg-white/5 text-[10px] font-black text-white border border-white/10">Mastercard</span>
          </div>
        </div>

        {/* ─ 7. Giant brand word (tasteful footer flourish) ─ */}
        <div aria-hidden className="mt-10 select-none pointer-events-none overflow-hidden">
          <div className="text-center font-black tracking-tight leading-none text-[8rem] md:text-[14rem] lg:text-[18rem] lp-text-stroke opacity-30">
            Addison Bill
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─── 16. STICKY MOBILE CTA ────────────────────────────────── */
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
         className="flex items-center justify-center gap-2 w-full px-5 py-4 rounded-full font-black text-white bg-gradient-to-r from-[#FF6B35] via-[#E94F18] to-[#B83A0A] shadow-2xl shadow-[#B83A0A]/50 ring-2 ring-[#F59E0B]/30">
        <Sparkles className="w-5 h-5" />
        Free Trial shuru karein
        <ArrowRight className="w-5 h-5" />
      </Link>
    </div>
  );
}
