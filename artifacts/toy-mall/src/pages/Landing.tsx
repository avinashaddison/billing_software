import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ScanLine, Receipt, QrCode, Boxes, BarChart3, Sparkles,
  Check, X, ArrowRight, Star, Shield, MessageCircle,
  ShoppingBag, Pill, Shirt, Gem, Smartphone, Wrench,
  PenTool, Heart, Menu, ChevronDown, TrendingUp,
  Headphones, Cpu, Wifi, Cloud, Lock, Activity, Bot, Banknote,
} from "lucide-react";

const WHATSAPP_NUMBER = "919999999999";
const TRIAL_URL       = "/login";

/* ═══════════════════════════════════════════════════════════════
   PUBLIC MARKETING LANDING — dark / premium SaaS feel.
   English-first headlines with Hindi accents in subtitles.
═══════════════════════════════════════════════════════════════ */
export default function Landing() {
  return (
    <div className="min-h-screen bg-[#050507] text-white overflow-x-hidden selection:bg-[#FF6B35] selection:text-white">
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
    { href: "#how",      label: "How it works" },
    { href: "#compare",  label: "vs Tally" },
    { href: "#pricing",  label: "Pricing" },
    { href: "#faq",      label: "FAQ" },
  ];

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#050507]/80 backdrop-blur-xl border-b border-white/5" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5 group">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF8A3D] via-[#FF6B35] to-[#E94F18] flex items-center justify-center text-white font-black shadow-lg shadow-[#FF6B35]/40">
              <span className="text-lg italic" style={{ fontFamily: "var(--font-display)" }}>A</span>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#8BFA3E] ring-2 ring-[#050507]" />
          </div>
          <div className="leading-tight">
            <div className="font-black text-base text-white">AddisonX</div>
            <div className="text-[9px] font-black tracking-[0.2em] uppercase text-[#FF8A3D] -mt-0.5">Billing OS</div>
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
             className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold text-[#B5FF6A] hover:bg-[#8BFA3E]/10 transition-all">
            <MessageCircle className="w-3.5 h-3.5" />
            Talk to us
          </a>
          <Link href={TRIAL_URL}
             className="relative group px-4 py-2 rounded-full text-[13px] font-black text-[#050507] bg-white hover:bg-[#B5FF6A] transition-colors">
            <span className="flex items-center gap-1.5">
              Start Free Trial
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </Link>
        </div>

        <button onClick={() => setOpen((v) => !v)}
                className="md:hidden w-9 h-9 rounded-xl bg-white/5 text-white flex items-center justify-center">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-[#0B0B11]/95 backdrop-blur-xl border-t border-white/5 px-4 py-3 space-y-1">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}
               className="block py-2.5 px-3 rounded-xl text-sm font-bold text-white/80 hover:bg-white/5">
              {l.label}
            </a>
          ))}
          <Link href={TRIAL_URL}
             className="block text-center mt-2 px-4 py-3 rounded-xl font-black text-[#050507] bg-white">
            Start Free Trial →
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
    <section id="top" className="relative pt-32 md:pt-40 pb-24 overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 lp-dot-grid opacity-50" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120vw] h-[60vh] bg-[radial-gradient(ellipse_at_top,rgba(255,107,53,0.18),transparent_60%)]" />
        <div className="absolute top-1/3 left-0 w-[55vw] h-[55vw] rounded-full bg-[#FF6B35]/15 blur-[120px] lp-animate-float-orb" />
        <div className="absolute top-1/2 right-0 w-[45vw] h-[45vw] rounded-full bg-[#4ADE5F]/10 blur-[120px] lp-animate-float-orb" style={{ animationDelay: "-9s" }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8">

        <div className="flex flex-wrap items-center justify-center gap-2 mb-8 lp-animate-fade-up">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.15em] lp-glass text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8BFA3E] animate-pulse" />
            Live · 247 shops billing right now
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.15em] lp-glass text-white">
            🇮🇳 Made in Bharat
          </span>
        </div>

        <h1 className="text-center font-black tracking-tight leading-[0.92] lp-animate-fade-up" style={{ animationDelay: "60ms" }}>
          <span className="block text-5xl md:text-7xl lg:text-[7rem]">
            Bill faster. <span className="lp-gradient-saffron">Stress less.</span>
          </span>
          <span className="block text-3xl md:text-5xl lg:text-6xl mt-3 text-white/70" style={{ fontFamily: "var(--font-hindi)" }}>
            दुकान चलाओ, <span className="lp-gradient-shimmer lp-animate-shimmer-text">सॉफ्टवेयर नहीं</span>।
          </span>
        </h1>

        <p className="mt-7 text-center text-base md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed lp-animate-fade-up" style={{ animationDelay: "140ms" }}>
          The cloud billing OS that runs your kirana, gift shop, or pharmacy.
          <br className="hidden md:inline" />
          <span className="text-white/80 font-semibold">5-second bills · GST invoices · UPI QR · Live stock · WhatsApp reports.</span>
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 lp-animate-fade-up" style={{ animationDelay: "220ms" }}>
          <Link href={TRIAL_URL}
             className="group relative inline-flex items-center gap-2 px-6 py-4 rounded-full font-black text-[#050507] bg-white hover:bg-[#B5FF6A] transition-colors text-base lp-animate-glow-pulse">
            <Sparkles className="w-5 h-5" />
            <span>Start 14-day Free Trial</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=AddisonX%20demo%20चाहिए`} target="_blank" rel="noopener"
             className="inline-flex items-center gap-2 px-5 py-4 rounded-full font-bold text-white lp-glass lp-glass-hover transition-all">
            <MessageCircle className="w-5 h-5 text-[#8BFA3E]" />
            Book WhatsApp Demo
          </a>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/40 lp-animate-fade-up" style={{ animationDelay: "300ms" }}>
          <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#8BFA3E]" /> No credit card</div>
          <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#8BFA3E]" /> Cancel anytime</div>
          <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#8BFA3E]" /> Setup in 5 min</div>
        </div>

        <div className="mt-16 relative lp-animate-fade-up" style={{ animationDelay: "380ms" }}>
          <DashboardMockup tracked={tracked} />
        </div>
      </div>
    </section>
  );
}

function DashboardMockup({ tracked }: { tracked: number }) {
  return (
    <div className="relative max-w-5xl mx-auto">
      <div className="absolute -top-4 -left-2 md:-left-12 z-20 lp-glass rounded-2xl px-3 py-2 lp-animate-float-y">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#FF6B35] flex items-center justify-center text-white">
            <ScanLine className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="font-black text-white">SCAN</div>
            <div className="text-white/50 text-[10px]">3.2s avg</div>
          </div>
        </div>
      </div>

      <div className="absolute -top-2 right-0 md:-right-10 z-20 lp-glass rounded-2xl px-3 py-2 lp-animate-float-y" style={{ animationDelay: "-2s" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#4ADE5F] flex items-center justify-center text-[#050507]">
            <QrCode className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="font-black text-white">UPI</div>
            <div className="text-white/50 text-[10px]">Auto-QR</div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-4 left-1/4 z-20 lp-glass rounded-2xl px-3 py-2 lp-animate-float-y" style={{ animationDelay: "-1s" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#8B5CF6] flex items-center justify-center text-white">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="font-black text-white">Live</div>
            <div className="text-white/50 text-[10px]">Daily report</div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl lp-glass p-2 md:p-3 shadow-2xl lp-conic-border">
        <div className="rounded-2xl bg-[#0B0B11] overflow-hidden border border-white/5">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#4ADE5F]/70" />
            </div>
            <div className="ml-auto text-[10px] text-white/30" style={{ fontFamily: "var(--font-mono)" }}>billing.addisonxmedia.com</div>
          </div>

          <div className="p-4 md:p-6 grid grid-cols-12 gap-3 md:gap-4">
            <div className="col-span-12 md:col-span-7 rounded-2xl bg-gradient-to-br from-[#FF6B35]/15 to-[#FF6B35]/5 border border-[#FF6B35]/20 p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#FF8A3D] to-transparent lp-animate-scan-line" />
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-[10px] font-black tracking-widest uppercase text-[#FF8A3D]">Today's Sales</div>
                  <div className="mt-1 text-3xl md:text-4xl font-black tabular-nums text-white">
                    ₹{tracked.toLocaleString("en-IN")}
                  </div>
                </div>
                <div className="text-[11px] text-[#8BFA3E] font-bold flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  +24%
                </div>
              </div>
              <div className="flex items-end gap-1.5 h-16 mt-3">
                {[35, 55, 40, 70, 50, 85, 60, 75, 90, 55, 80, 95].map((h, i) => (
                  <div key={i} className="flex-1 bg-gradient-to-t from-[#FF6B35] to-[#FFA86B] rounded-t opacity-90"
                       style={{ height: `${h}%` }} />
                ))}
              </div>
              <div className="flex justify-between mt-1 text-[8px] font-bold text-white/30">
                <span>00</span><span>02</span><span>04</span><span>06</span><span>08</span><span>10</span><span>12</span><span>14</span><span>16</span><span>18</span><span>20</span><span>22</span>
              </div>
            </div>

            <div className="col-span-6 md:col-span-5 rounded-2xl bg-white/[0.03] border border-white/5 p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-black tracking-widest uppercase text-white/40">Bills</div>
                <Receipt className="w-4 h-4 text-[#8BFA3E]" />
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-black tabular-nums text-white">134</div>
                <div className="text-xs text-white/50 mt-1">vs 108 yesterday</div>
              </div>
            </div>

            <div className="col-span-12 rounded-2xl bg-white/[0.02] border border-white/5 p-3 md:p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-3.5 h-3.5 text-[#8BFA3E]" />
                <div className="text-[10px] font-black tracking-widest uppercase text-white/40">Live Bills</div>
                <div className="ml-auto text-[10px] text-white/30">just now</div>
              </div>
              <div className="space-y-2">
                {[
                  { name: "Coffee Mug + Teddy Bear",  amt: "₹449",   t: "2s ago",  p: "UPI" },
                  { name: "Stationery Bundle",        amt: "₹275",   t: "9s ago",  p: "CASH" },
                  { name: "Wooden Wind Chime",        amt: "₹598",   t: "23s ago", p: "UPI" },
                ].map((b, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <div className="w-1 h-8 rounded-full bg-gradient-to-b from-[#FF6B35] to-[#B83A0A]" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white truncate">{b.name}</div>
                      <div className="text-white/40 text-[10px]">{b.t}</div>
                    </div>
                    <div className="text-[9px] font-black px-2 py-0.5 rounded-full bg-white/5 text-white/60">{b.p}</div>
                    <div className="font-black tabular-nums text-white text-sm w-16 text-right">{b.amt}</div>
                  </div>
                ))}
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
    <section className="border-y border-white/5 py-10 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 md:px-8 mb-6">
        <p className="text-center text-[10px] font-black tracking-[0.3em] uppercase text-white/30">
          Powering 100+ shops across India
        </p>
      </div>
      <div className="lp-marquee gap-12 text-white/30">
        {[...shops, ...shops].map((s, i) => (
          <div key={i} className="text-2xl whitespace-nowrap italic" style={{ fontFamily: "var(--font-display)" }}>{s}</div>
        ))}
      </div>
    </section>
  );
}

/* ─── FEATURES (BENTO) ─────────────────────────────────────── */
function Features() {
  return (
    <section id="features" className="py-24 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="text-center mb-16">
          <p className="inline-block text-[10px] font-black uppercase tracking-[0.3em] text-[#FF8A3D] mb-4">Capabilities</p>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[0.95]">
            Every tool a <span className="lp-gradient-saffron">shopkeeper</span><br />
            actually needs.
          </h2>
          <p className="mt-5 text-white/50 max-w-xl mx-auto" style={{ fontFamily: "var(--font-hindi)" }}>
            जो चाहिए, सब है। जो नहीं चाहिए, वो नहीं।
          </p>
        </div>

        <div className="grid grid-cols-12 gap-4 md:gap-5">
          <FeatureCard
            className="col-span-12 md:col-span-7 lg:col-span-8 row-span-2 md:p-8"
            Icon={ScanLine}
            iconColor="text-[#FF8A3D]"
            iconBg="bg-[#FF6B35]/10"
            title="3-second billing"
            hindi="3 सेकंड में बिल"
            desc="USB scanner, phone camera, or type the SKU — cart updates instantly. No 'loading'. No 'syncing'. Just bill, print, done."
            badge="MOST LOVED"
            big
          >
            <div className="mt-6 rounded-xl bg-white/5 border border-white/5 p-3 text-xs" style={{ fontFamily: "var(--font-mono)" }}>
              <div className="flex items-center gap-2 mb-2 text-white/40 text-[10px]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#8BFA3E] animate-pulse" />
                terminal
              </div>
              <div className="text-white/70">$ scan <span className="text-[#FFA86B]">TB-035</span></div>
              <div className="text-[#8BFA3E]">→ Kuromi Big · ₹1,050 · added</div>
              <div className="text-white/70 mt-1">$ scan <span className="text-[#FFA86B]">M-002</span></div>
              <div className="text-[#8BFA3E]">→ Yellow Coffee Mug · ₹550 · added</div>
              <div className="text-white/70 mt-1">$ checkout<span className="lp-animate-blink">_</span></div>
            </div>
          </FeatureCard>

          <FeatureCard className="col-span-6 md:col-span-5 lg:col-span-4" Icon={Receipt}
            iconColor="text-[#8BFA3E]" iconBg="bg-[#4ADE5F]/10"
            title="GST Invoices" hindi="GST बिल प्रिंट"
            desc="Auto-split CGST + SGST. HSN codes. 80mm thermal print-ready." />

          <FeatureCard className="col-span-6 md:col-span-5 lg:col-span-4" Icon={QrCode}
            iconColor="text-[#A78BFA]" iconBg="bg-[#8B5CF6]/10"
            title="UPI QR on every bill" hindi="UPI QR हर बिल पर"
            desc="Customer scans, amount pre-filled. Money in your account in seconds." />

          <FeatureCard className="col-span-12 md:col-span-7 lg:col-span-4" Icon={Boxes}
            iconColor="text-[#FF8A3D]" iconBg="bg-[#FF6B35]/10"
            title="Stock auto-updates" hindi="Stock अपने आप घटे"
            desc="Sold → stock −1. Low-stock alert in WhatsApp." />

          <FeatureCard className="col-span-6 md:col-span-7 lg:col-span-5" Icon={BarChart3}
            iconColor="text-[#8BFA3E]" iconBg="bg-[#4ADE5F]/10"
            title="Daily report on Telegram" hindi="रिपोर्ट जो ज़रूरी है"
            desc="9pm sharp — your phone vibrates with today's sales, top sellers, profit margin." />

          <FeatureCard className="col-span-6 md:col-span-5 lg:col-span-3" Icon={Sparkles}
            iconColor="text-[#FF8A3D]" iconBg="bg-[#FF6B35]/10"
            title="Today's Deal" hindi="One-tap discount"
            desc="One tap to put a product on sale. Instant." />

          <FeatureCard className="col-span-12 md:col-span-4 lg:col-span-4" Icon={Wifi}
            iconColor="text-[#8BFA3E]" iconBg="bg-[#4ADE5F]/10"
            title="Works offline" hindi="Internet गया? चलता रहेगा।"
            desc="Bills queue locally, auto-sync when internet returns." />

          <FeatureCard className="col-span-6 md:col-span-4" Icon={Cloud}
            iconColor="text-[#A78BFA]" iconBg="bg-[#8B5CF6]/10"
            title="Cloud-synced" hindi="हर device पर"
            desc="Phone, laptop, tablet — same data, instant." />

          <FeatureCard className="col-span-6 md:col-span-4" Icon={Lock}
            iconColor="text-[#FF8A3D]" iconBg="bg-[#FF6B35]/10"
            title="Bank-grade security" hindi="Data सुरक्षित"
            desc="Encrypted at rest + in transit. Indian servers." />
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
    <div className={`relative group rounded-3xl lp-glass lp-glass-hover transition-all p-5 md:p-6 overflow-hidden ${className}`}>
      {badge && (
        <span className="absolute top-4 right-4 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-[#FF6B35]/20 text-[#FFA86B] border border-[#FF6B35]/30">
          {badge}
        </span>
      )}
      <div className={`w-11 h-11 rounded-2xl ${iconBg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <h3 className={`font-black tracking-tight ${big ? "text-2xl md:text-3xl" : "text-lg md:text-xl"}`}>{title}</h3>
      <p className="text-xs font-bold text-[#FFA86B]/80 mt-0.5" style={{ fontFamily: "var(--font-hindi)" }}>{hindi}</p>
      <p className={`mt-3 text-white/55 leading-relaxed ${big ? "text-base" : "text-sm"}`}>{desc}</p>
      {children}
    </div>
  );
}

/* ─── HOW IT WORKS ─────────────────────────────────────────── */
function HowItWorks() {
  const steps = [
    { n: "01", Icon: ScanLine, title: "Scan",      hindi: "Add to cart",  desc: "Bar code, camera, or type. Product flies into cart in milliseconds." },
    { n: "02", Icon: Banknote, title: "Get paid",  hindi: "Cash या UPI",   desc: "UPI QR auto-generated. Customer pays, you get a ping." },
    { n: "03", Icon: Bot,      title: "We handle the rest", hindi: "बाकी सब छोड़ो", desc: "Stock −1, GST entries, daily report, customer DB — all automatic." },
  ];
  return (
    <section id="how" className="py-24 md:py-32 relative">
      <div className="absolute inset-0 -z-10"><div className="absolute inset-0 lp-dot-grid opacity-30" /></div>
      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <div className="text-center mb-16">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#FF8A3D] mb-4">How it works</p>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.95]">
            Three steps to <span className="lp-gradient-saffron">a full day sorted.</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5 md:gap-6">
          {steps.map((s, i) => (
            <div key={s.n} className="group relative lp-glass rounded-3xl p-6 md:p-8 overflow-hidden hover:-translate-y-1 transition-transform"
                 style={{ animation: `lp-fade-up 0.8s ${i * 100}ms backwards` }}>
              <div className="absolute -top-8 -right-8 text-9xl font-black text-white/[0.03] select-none">{s.n}</div>
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-[#FF6B35]/10 text-[#FF8A3D] flex items-center justify-center mb-5 group-hover:bg-[#FF6B35] group-hover:text-[#050507] transition-colors">
                  <s.Icon className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-white/30" style={{ fontFamily: "var(--font-mono)" }}>{s.n}</span>
                  <span className="w-8 h-px bg-white/15" />
                </div>
                <h3 className="text-2xl font-black">{s.title}</h3>
                <p className="text-xs font-bold text-[#FFA86B] mt-0.5" style={{ fontFamily: "var(--font-hindi)" }}>{s.hindi}</p>
                <p className="mt-3 text-sm text-white/55 leading-relaxed">{s.desc}</p>
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
    { Icon: ShoppingBag, name: "Kirana / General",      hindi: "किराना" },
    { Icon: Heart,       name: "Gift & Toys",           hindi: "गिफ्ट शॉप" },
    { Icon: Smartphone,  name: "Mobile & Accessories",  hindi: "मोबाइल" },
    { Icon: PenTool,     name: "Stationery",            hindi: "स्टेशनरी" },
    { Icon: Gem,         name: "Cosmetics & Beauty",    hindi: "कॉस्मेटिक्स" },
    { Icon: Wrench,      name: "Hardware",              hindi: "हार्डवेयर" },
    { Icon: Shirt,       name: "Footwear & Fashion",    hindi: "कपड़े जूते" },
    { Icon: Pill,        name: "Pharmacy",              hindi: "मेडिकल" },
  ];
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="text-center mb-14">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#FF8A3D] mb-4">Who it's for</p>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.95]">
            Built for <span className="lp-gradient-saffron">your dukaan.</span>
          </h2>
          <p className="mt-4 text-white/50 max-w-xl mx-auto">
            Any retail shop where speed at the counter matters more than spreadsheet wizardry.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {shops.map((s, i) => (
            <div key={i} className="group lp-glass lp-glass-hover rounded-2xl p-4 md:p-5 text-center hover:-translate-y-1 transition-all"
                 style={{ animation: `lp-fade-up 0.6s ${i * 50}ms backwards` }}>
              <div className="w-12 h-12 mx-auto rounded-2xl bg-[#FF6B35]/10 text-[#FF8A3D] flex items-center justify-center group-hover:bg-[#FF6B35] group-hover:text-[#050507] group-hover:rotate-6 transition-all">
                <s.Icon className="w-6 h-6" />
              </div>
              <p className="font-black text-sm mt-3 text-white">{s.name}</p>
              <p className="text-[11px] font-bold text-[#FFA86B]/70 mt-0.5" style={{ fontFamily: "var(--font-hindi)" }}>{s.hindi}</p>
            </div>
          ))}
        </div>
        <p className="text-center mt-10 text-sm text-white/50">
          Restaurant, salon, jewellery, or पेट्रोल पंप भी? <a href={`https://wa.me/${WHATSAPP_NUMBER}`} className="font-black text-[#FF8A3D] hover:underline">Talk to us →</a>
        </p>
      </div>
    </section>
  );
}

/* ─── COMPARISON ───────────────────────────────────────────── */
function Comparison() {
  const rows = [
    { feat: "Barcode bill in 3 seconds",          a: true, t: false as const },
    { feat: "UPI QR built into checkout",         a: true, t: false as const },
    { feat: "Same login on phone + desktop",      a: true, t: false as const },
    { feat: "One-tap Today's Deal",               a: true, t: false as const },
    { feat: "Daily Telegram / WhatsApp reports",  a: true, t: false as const },
    { feat: "Stock auto-decrement",                a: true, t: "limited" as const },
    { feat: "GST returns / Accounting exports",    a: true, t: true as const },
  ];
  return (
    <section id="compare" className="py-24 md:py-32 relative">
      <div className="max-w-5xl mx-auto px-4 md:px-8">
        <div className="text-center mb-14">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#FF8A3D] mb-4">vs Tally / Vyapar</p>
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-black leading-[1.05]">
            <span className="text-white/30">Tally is for accountants.</span><br />
            <span className="lp-gradient-saffron">AddisonX is for you.</span>
          </h2>
        </div>

        <div className="rounded-3xl lp-glass overflow-hidden lp-conic-border">
          <div className="grid grid-cols-[1.4fr_1fr_1fr] text-[11px] md:text-sm font-black uppercase tracking-wider">
            <div className="p-4 md:p-5 text-white/50">Feature</div>
            <div className="p-4 md:p-5 text-center bg-gradient-to-br from-[#FF6B35] to-[#E94F18] text-white relative">
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-[#8BFA3E] text-[#050507] text-[9px] rounded-full font-black lp-animate-badge-bounce whitespace-nowrap">
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
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#4ADE5F] text-[#050507]">
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

          <div className="grid grid-cols-[1.4fr_1fr_1fr] text-sm border-t border-white/5">
            <div className="p-4 md:p-5 font-black uppercase text-[11px] tracking-wider text-white/40">Built for</div>
            <div className="p-4 md:p-5 text-center font-black text-[#FFA86B]">Shopkeepers</div>
            <div className="p-4 md:p-5 text-center font-black text-white/30">CAs / Accountants</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── PRICING ──────────────────────────────────────────────── */
function Pricing() {
  return (
    <section id="pricing" className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/2 -left-20 w-80 h-80 rounded-full bg-[#FF6B35]/15 blur-[120px] lp-animate-float-orb" />
        <div className="absolute top-1/2 -right-20 w-80 h-80 rounded-full bg-[#4ADE5F]/10 blur-[120px] lp-animate-float-orb" style={{ animationDelay: "-9s" }} />
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8">
        <div className="text-center mb-14">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#FF8A3D] mb-4">Pricing</p>
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-black leading-[0.95]">
            One price. <span className="lp-gradient-saffron">No hidden charges.</span>
          </h2>
          <p className="mt-5 text-white/50 max-w-xl mx-auto" style={{ fontFamily: "var(--font-hindi)" }}>
            Honest pricing. कोई छुपा charge नहीं। Cancel anytime.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
          <div className="relative lp-glass rounded-3xl p-7 md:p-8">
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
                  <Check className="w-4 h-4 text-[#8BFA3E] mt-0.5 shrink-0" strokeWidth={3} />
                  <span>{p}</span>
                </li>
              ))}
            </ul>

            <Link href={TRIAL_URL}
               className="mt-8 inline-flex w-full items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-black text-white bg-white/10 border border-white/10 hover:bg-white/15 transition-all">
              Start free <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="relative rounded-3xl bg-gradient-to-br from-[#FF6B35] via-[#E94F18] to-[#B83A0A] text-white overflow-hidden shadow-2xl shadow-[#FF6B35]/40 p-7 md:p-8">
            <div className="absolute top-0 left-0 right-0 h-px bg-white/30" />
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute inset-0 opacity-10"
                 style={{
                   backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 1px)",
                   backgroundSize: "20px 20px",
                 }} />

            <div className="relative">
              <div className="flex items-center gap-2 mb-5">
                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#050507] text-[#B5FF6A]">★ Bestseller</span>
                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 backdrop-blur">1 Year</span>
              </div>
              <h3 className="text-2xl font-black">Pro · annual</h3>
              <p className="text-sm opacity-80 mt-1" style={{ fontFamily: "var(--font-hindi)" }}>90% shopkeepers इसी पर हैं</p>

              <div className="mt-6 flex items-baseline gap-3">
                <span className="text-lg line-through opacity-50 tabular-nums">₹14,999</span>
                <span className="text-6xl md:text-7xl font-black tabular-nums">₹9,999</span>
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

              <Link href={TRIAL_URL}
                 className="mt-8 inline-flex w-full items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-black text-[#B83A0A] bg-white hover:bg-[#B5FF6A] transition-colors">
                Get started <ArrowRight className="w-4 h-4" />
              </Link>

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

/* ─── TESTIMONIAL ──────────────────────────────────────────── */
function Testimonial() {
  return (
    <section className="py-24 md:py-32 relative">
      <div className="max-w-4xl mx-auto px-4 md:px-8">
        <div className="rounded-3xl lp-glass p-8 md:p-12 text-center relative overflow-hidden lp-conic-border">
          <div className="absolute top-4 left-4 text-7xl text-white/[0.04] italic select-none" style={{ fontFamily: "var(--font-display)" }}>"</div>
          <div className="absolute bottom-4 right-8 text-7xl text-white/[0.04] italic select-none" style={{ fontFamily: "var(--font-display)" }}>"</div>

          <div className="flex justify-center gap-1 mb-6 relative">
            {[1,2,3,4,5].map(i => <Star key={i} className="w-5 h-5 fill-[#FF8A3D] text-[#FF8A3D]" />)}
          </div>
          <blockquote className="text-2xl md:text-4xl font-black leading-tight relative" style={{ fontFamily: "var(--font-hindi)" }}>
            "हमारा cashier सालों से Tally पर था. <span className="lp-gradient-saffron">2 दिन में AddisonX सीख गया.</span> अब वापस नहीं जाएगा."
          </blockquote>
          <div className="mt-8 inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF8A3D] to-[#E94F18] flex items-center justify-center font-black text-[#050507]">
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

/* ─── FAQ ─────────────────────────────────────────────────── */
function FAQ() {
  const faqs = [
    { q: "Do I have to install anything?", qh: "क्या install करना पड़ेगा?",
      a: "Nothing. AddisonX runs in your browser — Chrome, Edge, Safari, or mobile. Open the link, log in, start billing. कुछ install नहीं करना।" },
    { q: "What hardware do I need?", qh: "क्या hardware चाहिए?",
      a: "Minimum: an Android phone or any laptop. Recommended: 80mm thermal printer + USB barcode scanner. हम बता देंगे क्या खरीदना है — total under ₹6,000." },
    { q: "What if internet goes down?", qh: "Internet नहीं हो तो?",
      a: "Offline mode kicks in automatically — bills queue locally and auto-sync the moment internet returns. Your shop never stops." },
    { q: "Is my data safe?", qh: "मेरा data safe है?",
      a: "Bank-grade encryption (at rest + in transit), daily backups, Indian servers. We literally can't access your data — neither can anyone else." },
    { q: "Will you help me with GST setup?", qh: "GST setup में help मिलेगी?",
      a: "Free onboarding call (Hindi/English). We set up your GSTIN, HSN codes, opening stock — सब हम कर देंगे।" },
    { q: "What if I want to cancel?", qh: "Cancel करना हो तो?",
      a: "One click. Pro-rata refund. No 'cancellation fee'. We'll even export your data as CSV so you can take it anywhere." },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-24 md:py-32">
      <div className="max-w-3xl mx-auto px-4 md:px-8">
        <div className="text-center mb-14">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#FF8A3D] mb-4">FAQ</p>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.95]">
            Questions before <span className="lp-gradient-saffron">you start.</span>
          </h2>
        </div>
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <div key={i} className="lp-glass rounded-2xl overflow-hidden">
              <button onClick={() => setOpen(open === i ? null : i)}
                      className="w-full flex items-start justify-between gap-4 p-5 text-left">
                <div className="flex-1">
                  <div className="font-black text-base">{f.q}</div>
                  <div className="text-xs font-bold text-[#FFA86B]/70 mt-1" style={{ fontFamily: "var(--font-hindi)" }}>{f.qh}</div>
                </div>
                <ChevronDown className={`w-5 h-5 text-[#FF8A3D] shrink-0 transition-transform ${open === i ? "rotate-180" : ""}`} />
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

/* ─── FINAL CTA ────────────────────────────────────────────── */
function FinalCTA() {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 md:px-8">
        <div className="rounded-[2.5rem] bg-gradient-to-br from-[#FF6B35] via-[#E94F18] to-[#B83A0A] p-10 md:p-16 text-center relative overflow-hidden shadow-2xl shadow-[#FF6B35]/30">
          <div className="absolute inset-0 opacity-15"
               style={{
                 backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 1px)",
                 backgroundSize: "24px 24px",
               }} />
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-[#8BFA3E]/15 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-[#8BFA3E]/15 blur-3xl" />

          <div className="relative text-white">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#050507] text-[#B5FF6A] mb-6 lp-animate-badge-bounce">
              <Sparkles className="w-3.5 h-3.5" />
              14-day free trial · no credit card
            </div>
            <h2 className="text-5xl md:text-7xl lg:text-8xl font-black leading-[0.95]">
              Run your shop.<br />
              <span className="text-[#B5FF6A]" style={{ fontFamily: "var(--font-hindi)" }}>हम सब handle करेंगे.</span>
            </h2>
            <p className="mt-6 text-base md:text-xl opacity-90 max-w-xl mx-auto">
              Stop spending evenings on Tally. Stop losing stock. Stop guessing your profit.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link href={TRIAL_URL}
                 className="inline-flex items-center gap-2 px-7 py-4 rounded-full font-black text-[#B83A0A] bg-white hover:bg-[#B5FF6A] hover:text-[#050507] transition-all text-lg shadow-2xl">
                Start Free Trial <ArrowRight className="w-5 h-5" />
              </Link>
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener"
                 className="inline-flex items-center gap-2 px-6 py-4 rounded-full font-black text-white bg-[#050507] hover:bg-[#15151E] transition-all">
                <MessageCircle className="w-5 h-5" /> WhatsApp us
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
    <footer className="border-t border-white/5 pt-16 pb-8 bg-[#050507]">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex flex-wrap items-center justify-center gap-6 pb-10 border-b border-white/5 text-xs font-bold uppercase tracking-widest text-white/40">
          <div className="flex items-center gap-2"><Cpu className="w-4 h-4 text-[#FF8A3D]" /> Bank-grade Encryption</div>
          <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-[#8BFA3E]" /> GST Certified</div>
          <div className="flex items-center gap-2"><Headphones className="w-4 h-4 text-[#A78BFA]" /> Live Support</div>
          <div className="flex items-center gap-2"><span className="text-base">🇮🇳</span> Made in Bharat</div>
        </div>

        <div className="grid md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10 mt-10">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6B35] to-[#B83A0A] flex items-center justify-center text-white font-black">
                  <span className="italic text-lg" style={{ fontFamily: "var(--font-display)" }}>A</span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#8BFA3E] ring-2 ring-[#050507]" />
              </div>
              <div>
                <div className="font-black text-lg text-white">AddisonX</div>
                <div className="text-[10px] font-black tracking-[0.2em] text-[#FF8A3D] -mt-0.5">BILLING OS</div>
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
                    <a href="#" className="text-sm text-white/65 hover:text-[#FF8A3D] transition-colors">{it}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-white/5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs text-white/30">
          <p>© {new Date().getFullYear()} AddisonX Media. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`} className="hover:text-[#FF8A3D] font-bold">+91 99999 99999</a>
            <span className="text-white/15">·</span>
            <a href="mailto:hello@addisonxmedia.com" className="hover:text-[#FF8A3D] font-bold">hello@addisonxmedia.com</a>
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
         className="flex items-center justify-center gap-2 w-full px-5 py-4 rounded-full font-black text-[#050507] bg-white shadow-2xl">
        <Sparkles className="w-5 h-5" />
        Start 14-day Free Trial
        <ArrowRight className="w-5 h-5" />
      </Link>
    </div>
  );
}
