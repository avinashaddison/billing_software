import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ScanLine, Receipt, IndianRupee, BarChart3, Package, Sparkles,
  ShieldCheck, Zap, MessageCircle, Phone, Mail, MapPin,
  ChevronDown, Check, ArrowRight, X, Star, Menu, Flame, Trophy,
  PartyPopper, Store, Smartphone, Heart, Headphones, Lock, Award,
} from "lucide-react";

/**
 * Public marketing landing page for Indian shopkeepers.
 *
 * Design rules tuned for an Indian SMB audience (not a Western SaaS look):
 *  - Saffron + magenta + emerald palette, lots of gradients, festival sparkle
 *  - Hindi+English mixed throughout, not just one decorative tagline
 *  - Sticker-style badges, big ₹ price callouts, prominent strike-throughs
 *  - WhatsApp green floating CTA + phone number always visible
 *  - "Made in Bharat" badges, real-feeling stats, dukaan testimonials
 *  - Heavy typography hierarchy — big bold headlines that read across the room
 */
export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq,  setOpenFaq]  = useState<number | null>(0);

  useEffect(() => {
    const close = () => setMenuOpen(false);
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, []);

  return (
    <div className="min-h-screen bg-[#fff8ee] text-slate-900 selection:bg-orange-300 selection:text-slate-900 overflow-x-hidden">
      {/* ── Top offer strip (festival flavor) ───────────────────── */}
      <div className="bg-gradient-to-r from-rose-600 via-orange-500 to-amber-500 text-white text-center text-[12px] md:text-[13px] font-bold tracking-wide py-2 px-4">
        <span className="inline-flex items-center gap-1.5">
          <PartyPopper className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Diwali Offer · पहले 100 दुकानदारों के लिए — </span>
          <span className="sm:hidden">Diwali Offer — </span>
          <span className="bg-white/25 px-2 py-0.5 rounded-full">First month <span className="underline">FREE</span></span>
          <PartyPopper className="w-3.5 h-3.5" />
        </span>
      </div>

      {/* ── Sticky top nav ──────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#fff8ee]/85 backdrop-blur-xl border-b-2 border-orange-200/60">
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/40 ring-2 ring-white">
              <Zap className="w-5 h-5" strokeWidth={2.8} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-base font-black tracking-tight">AddisonX</span>
              <span className="text-[10px] font-bold text-orange-700 tracking-widest uppercase">दुकान का सॉफ्टवेयर</span>
            </div>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-[14px] font-bold text-slate-700">
            <a href="#features"   className="hover:text-orange-600 transition-colors">Features</a>
            <a href="#how"        className="hover:text-orange-600 transition-colors">कैसे काम करता है</a>
            <a href="#pricing"    className="hover:text-orange-600 transition-colors">Pricing</a>
            <a href="#faq"        className="hover:text-orange-600 transition-colors">सवाल?</a>
          </nav>

          <div className="flex items-center gap-2">
            <a href="tel:+919999999999" className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-emerald-700 text-[13px] font-bold hover:bg-emerald-50">
              <Phone className="w-3.5 h-3.5" /> +91 99999 99999
            </a>
            <Link href="/login"
              className="hidden md:inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-gradient-to-br from-rose-600 to-orange-600 text-white text-[14px] font-black shadow-lg shadow-rose-500/30 hover:scale-[1.03] active:scale-95 transition-all">
              Sign In <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button onClick={() => setMenuOpen(true)}
              className="md:hidden w-10 h-10 rounded-xl border-2 border-orange-200 flex items-center justify-center text-orange-700">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] bg-[#fff8ee] p-5 md:hidden">
          <div className="flex items-center justify-between mb-8">
            <span className="text-lg font-black">Menu</span>
            <button onClick={() => setMenuOpen(false)} className="w-10 h-10 rounded-xl border-2 border-orange-200 flex items-center justify-center text-orange-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex flex-col gap-1 text-[17px] font-black">
            <a href="#features"  onClick={() => setMenuOpen(false)} className="py-3 border-b border-orange-100">Features</a>
            <a href="#how"       onClick={() => setMenuOpen(false)} className="py-3 border-b border-orange-100">कैसे काम करता है</a>
            <a href="#pricing"   onClick={() => setMenuOpen(false)} className="py-3 border-b border-orange-100">Pricing</a>
            <a href="#faq"       onClick={() => setMenuOpen(false)} className="py-3 border-b border-orange-100">सवाल?</a>
            <Link href="/login"
              className="mt-6 inline-flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-2xl bg-gradient-to-br from-rose-600 to-orange-600 text-white text-base font-black shadow-lg shadow-rose-500/30">
              Sign In <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="https://wa.me/?text=Hi%20AddisonX%2C%20demo%20chahiye"
              target="_blank" rel="noreferrer"
              className="mt-3 inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-emerald-500 text-white text-base font-black shadow-lg shadow-emerald-500/30">
              <MessageCircle className="w-4 h-4" /> WhatsApp Demo
            </a>
          </div>
        </div>
      )}

      {/* ── HERO ──────────────────────────────────────────────────── */}
      <section id="top" className="relative overflow-hidden">
        {/* Layered ambient backdrop — three blurred radial glows + a soft dotted grid + sparkles */}
        <div aria-hidden className="pointer-events-none absolute -top-40 -right-32 w-[680px] h-[680px] rounded-full bg-gradient-to-br from-amber-300/55 via-orange-400/45 to-rose-400/35 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-48 -left-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-fuchsia-300/45 via-rose-300/40 to-orange-300/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full bg-emerald-300/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.22]"
          style={{ backgroundImage: "radial-gradient(circle, #f97316 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div aria-hidden className="pointer-events-none absolute top-12  left-[8%]  text-amber-400/50 text-[28px] select-none rotate-12">✦</div>
        <div aria-hidden className="pointer-events-none absolute top-32  right-[12%] text-rose-400/40  text-5xl select-none">✦</div>
        <div aria-hidden className="pointer-events-none absolute bottom-24 left-[14%] text-orange-400/45 text-3xl select-none -rotate-12">✦</div>
        <div aria-hidden className="pointer-events-none absolute bottom-44 right-[8%] text-fuchsia-400/40 text-4xl select-none rotate-[20deg]">✦</div>

        <div className="relative max-w-6xl mx-auto px-5 md:px-8 pt-10 pb-20 md:pt-16 md:pb-28 grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center">
          {/* ─── Left: copy ─── */}
          <div>
            {/* Top trust pill row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border-2 border-orange-300 text-rose-600 text-[11px] font-black shadow-sm">
                <Flame className="w-3.5 h-3.5 text-rose-600" />
                Made in Bharat 🇮🇳
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border-2 border-emerald-300 text-emerald-700 text-[11px] font-black">
                GST + UPI Ready
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-50 border-2 border-violet-300 text-violet-700 text-[11px] font-black">
                4.9 ⭐ · 100+ shops
              </span>
            </div>

            <h1 className="mt-6 text-[44px] md:text-[60px] lg:text-[76px] font-black tracking-tight leading-[0.95] text-slate-900">
              <span className="block">दुकान चलाओ,</span>
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-rose-600 via-orange-600 to-amber-500 bg-clip-text text-transparent">
                  सॉफ्टवेयर
                </span>
                {/* Hand-drawn underline */}
                <svg aria-hidden viewBox="0 0 220 12" className="absolute -bottom-1 left-0 w-full h-3 text-amber-500">
                  <path d="M2 8 Q 55 2, 110 7 T 218 6" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
                </svg>
              </span>
              <span className="block">नहीं!</span>
            </h1>

            <p className="mt-6 text-xl md:text-2xl font-bold text-slate-700 leading-snug">
              <span className="bg-amber-200/80 px-1.5 rounded shadow-sm">5 second</span> में Bill.
              UPI QR तैयार. <br className="hidden md:block" />
              Stock अपने आप count.
            </p>

            <p className="mt-4 text-[15px] md:text-[17px] text-slate-600 leading-relaxed max-w-lg">
              भारत के लाला जी, kirana वाले, और gift shop walas के लिए बना सबसे आसान billing software.
              <span className="font-bold text-slate-800"> Tally जैसा confusing नहीं, WhatsApp जैसा simple.</span>
            </p>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <Link href="/login"
                className="group relative inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-gradient-to-br from-rose-600 via-orange-600 to-amber-500 text-white font-black text-[15px] shadow-2xl shadow-rose-500/40 ring-2 ring-white hover:scale-[1.03] active:scale-[0.98] transition-all overflow-hidden">
                {/* Shimmer sweep on hover */}
                <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
                <span className="relative">अभी शुरू करें — Free</span>
                <ArrowRight className="relative w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a href="https://wa.me/?text=Hi%20AddisonX%2C%20demo%20chahiye"
                target="_blank" rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-white text-emerald-700 font-black text-[15px] border-2 border-emerald-500 hover:bg-emerald-50 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98] transition-all">
                <MessageCircle className="w-5 h-5 text-emerald-600" /> WhatsApp पर बात करें
              </a>
            </div>

            {/* Inline trust micro-row */}
            <div className="mt-6 grid grid-cols-3 gap-3 max-w-md">
              {[
                ["Credit card", "नहीं चाहिए"],
                ["14 दिन",       "Free Trial"],
                ["कभी भी",       "Cancel"],
              ].map(([a, b], i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] leading-tight">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={3} />
                  <span><span className="font-black text-slate-900">{a}</span><br /><span className="text-slate-500">{b}</span></span>
                </div>
              ))}
            </div>

            {/* Social proof footer row */}
            <div className="mt-8 flex items-center gap-5 pt-6 border-t-2 border-dashed border-orange-200">
              <div className="flex -space-x-2.5">
                {["from-rose-500 to-pink-500", "from-amber-500 to-orange-500", "from-emerald-500 to-teal-500", "from-violet-500 to-fuchsia-500"].map((g, i) => (
                  <div key={i} className={`w-10 h-10 rounded-full bg-gradient-to-br ${g} ring-2 ring-[#fff8ee] flex items-center justify-center text-white text-[11px] font-black shadow-sm`}>
                    {["HS", "KR", "MS", "AD"][i]}
                  </div>
                ))}
                <div className="w-10 h-10 rounded-full bg-slate-900 text-white text-[10px] font-black ring-2 ring-[#fff8ee] flex items-center justify-center">
                  +95
                </div>
              </div>
              <div>
                <div className="flex items-center gap-0.5 text-amber-500">
                  {[0,1,2,3,4].map((i) => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}
                  <span className="ml-1.5 text-[13px] font-black text-slate-900">4.9 / 5</span>
                </div>
                <p className="text-[12px] text-slate-600 font-bold mt-0.5">100+ दुकानें already running across India</p>
              </div>
            </div>
          </div>

          {/* ─── Right: phone-frame device mockup ─── */}
          <div className="relative mx-auto w-full max-w-[420px]">
            {/* Floating GST sticker */}
            <div className="absolute -top-4 -right-2 md:-right-8 z-30 rotate-[8deg]">
              <div className="bg-emerald-500 text-white px-3.5 py-2 rounded-2xl shadow-2xl ring-4 ring-white">
                <p className="text-[11px] font-black tracking-widest">GST READY</p>
                <p className="text-[9px] font-bold opacity-90">CGST + SGST auto</p>
              </div>
            </div>
            {/* Floating UPI sticker */}
            <div className="absolute -bottom-5 -left-2 md:-left-8 z-30 -rotate-[7deg]">
              <div className="bg-violet-600 text-white px-3.5 py-2 rounded-2xl shadow-2xl ring-4 ring-white">
                <p className="text-[11px] font-black tracking-widest">UPI QR</p>
                <p className="text-[9px] font-bold opacity-90">Dynamic on every bill</p>
              </div>
            </div>
            {/* Floating Telegram alert sticker */}
            <div className="hidden md:block absolute top-1/2 -right-12 z-30 rotate-[5deg] animate-pulse">
              <div className="bg-white px-3 py-2 rounded-2xl shadow-xl ring-4 ring-amber-100 border border-amber-200">
                <p className="text-[10px] font-black text-rose-600">🔔 New sale!</p>
                <p className="text-[9px] font-bold text-slate-700">Bill #47 · ₹890</p>
              </div>
            </div>

            {/* Ambient halo behind the phone */}
            <div className="absolute -inset-6 rounded-[44px] bg-gradient-to-br from-amber-300/60 via-rose-300/50 to-fuchsia-300/40 blur-3xl" />

            {/* Phone frame */}
            <div className="relative mx-auto rounded-[44px] bg-slate-900 p-2.5 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.35)]">
              {/* Speaker / camera notch */}
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-24 h-5 rounded-b-2xl bg-slate-900 z-10 flex items-center justify-center">
                <div className="w-12 h-1.5 rounded-full bg-slate-700" />
              </div>
              <div className="rounded-[34px] overflow-hidden bg-[#fff8ee]">
                {/* Status bar */}
                <div className="h-8 bg-[#fff8ee] flex items-center justify-between px-5 text-[10px] font-black text-slate-700">
                  <span>9:30 AM</span>
                  <span className="flex items-center gap-1">📶 5G 100%</span>
                </div>
                {/* App content */}
                <div className="bg-gradient-to-br from-orange-50 via-amber-50 to-white p-5 pb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[20px] font-black tracking-tight">आपकी दुकान</p>
                      <p className="text-[11px] text-slate-500 font-medium">आज का overview · सबसे अच्छा दिन! 🎉</p>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 border-2 border-emerald-300 text-emerald-700 text-[10px] font-black">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      LIVE
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 mb-4">
                    <StatTile label="आज की कमाई" value="₹28,450" tone="emerald" />
                    <StatTile label="Bills बने"   value="47"      tone="rose"    />
                    <StatTile label="Items बिके"  value="134"     tone="amber"   />
                    <StatTile label="Stock"       value="2,140"   tone="violet"  />
                  </div>

                  <div className="rounded-2xl border-2 border-orange-100 p-3.5 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Revenue · 7 days</p>
                      <span className="text-[10px] font-black text-emerald-600">+52% ↗</span>
                    </div>
                    <div className="flex items-end gap-1.5 h-16">
                      {[40, 55, 48, 72, 65, 88, 100].map((h, i) => (
                        <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-rose-500 via-orange-500 to-amber-400" style={{ height: `${h}%` }} />
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-slate-600">
                    <ScanLine className="w-3.5 h-3.5 text-rose-600" />
                    Just sold · Steel Tiffin Set · <span className="text-slate-900">₹890</span>
                  </div>
                </div>
                {/* Home indicator */}
                <div className="h-5 bg-[#fff8ee] flex items-center justify-center">
                  <div className="w-28 h-1 rounded-full bg-slate-300" />
                </div>
              </div>
            </div>

            {/* "Works on mobile + desktop" caption */}
            <p className="mt-6 text-center text-[12px] font-bold text-slate-500 flex items-center justify-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5" />
              Mobile, tablet, desktop — same login, सब जगह
            </p>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="relative pb-6 flex justify-center">
          <a href="#features" aria-label="Scroll to features"
            className="group flex flex-col items-center gap-1 text-[11px] font-black text-slate-500 hover:text-rose-600 transition-colors">
            <span className="tracking-widest uppercase">Scroll</span>
            <ChevronDown className="w-5 h-5 animate-bounce" />
          </a>
        </div>
      </section>

      {/* ── Stats strip (the "lakhon bills" line) ───────────────── */}
      <section className="border-y-4 border-orange-200 bg-gradient-to-r from-rose-50 via-orange-50 to-amber-50 py-8 md:py-10">
        <div className="max-w-6xl mx-auto px-5 md:px-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: "100+",  label: "Happy दुकानें",     color: "text-rose-600"   },
            { value: "2L+",   label: "Bills बने",         color: "text-orange-600" },
            { value: "₹3 Cr+", label: "Sales tracked",    color: "text-emerald-600"},
            { value: "0",     label: "Setup fees",        color: "text-violet-600" },
          ].map((s, i) => (
            <div key={i}>
              <p className={`text-4xl md:text-5xl font-black tracking-tight ${s.color}`}>{s.value}</p>
              <p className="mt-1 text-[12px] md:text-[13px] font-bold text-slate-600 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES grid ───────────────────────────────────────── */}
      <section id="features" className="py-20 md:py-28 relative">
        <div aria-hidden className="absolute top-20 right-10 text-orange-300/40 text-8xl select-none">✦</div>
        <div className="relative max-w-6xl mx-auto px-5 md:px-8">
          <div className="max-w-2xl mb-12 text-center mx-auto">
            <span className="inline-block px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-black uppercase tracking-widest mb-3">
              Features
            </span>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 leading-[1.05]">
              जो चाहिए, सब है.<br />
              <span className="text-rose-600">जो नहीं चाहिए, वो नहीं.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard icon={ScanLine}    tone="rose"
              title="5-second billing"
              hindi="Scan करो, bill तैयार"
              body="USB scanner, camera, या type — सब चलता है. Cart instantly update होता है." />
            <FeatureCard icon={Receipt}     tone="orange"
              title="GST Invoice Print"
              hindi="पूरा GST compliant"
              body="CGST + SGST automatically calculate. आपका GSTIN, आपका rate. 80mm thermal में direct print." />
            <FeatureCard icon={IndianRupee} tone="emerald"
              title="UPI QR तुरंत"
              hindi="हर bill पर dynamic QR"
              body="Customer scan करे, अपने UPI से pay करे. Third-party app की ज़रूरत नहीं." />
            <FeatureCard icon={Package}     tone="violet"
              title="Stock अपने आप गिने"
              hindi="कभी भी कुछ खत्म नहीं होगा"
              body="हर bill पर stock automatic कम. Low stock पर Telegram पर alert आएगा." />
            <FeatureCard icon={BarChart3}   tone="fuchsia"
              title="Reports जो काम के हैं"
              hindi="मालिक को सब दिखेगा"
              body="आज कितना कमाया, क्या ज़्यादा बिका, कब peak hour था — सब एक click पर." />
            <FeatureCard icon={Sparkles}    tone="amber"
              title="Today's Deal"
              hindi="आज का special"
              body="One tap में flash discount. शाम को auto-expire. हर label पर strike-through MRP." />
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────── */}
      <section id="how" className="py-20 md:py-24 bg-gradient-to-b from-orange-50/50 to-[#fff8ee] relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute top-1/2 -translate-y-1/2 left-0 w-32 h-32 rounded-full bg-rose-300/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute top-10 right-0 w-40 h-40 rounded-full bg-amber-300/30 blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-5 md:px-8">
          <div className="text-center mb-14">
            <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-black uppercase tracking-widest mb-3">
              How it works
            </span>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 leading-[1.05]">
              3 step, <span className="text-emerald-600">पूरा दिन sorted</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8 relative">
            <StepCard n="1" hindi="Scan करो" title="Add to cart" icon={ScanLine} tone="rose"
              body="Barcode scanner, USB, या camera. Product जल्दी से cart में." />
            <StepCard n="2" hindi="Payment लो" title="Cash या UPI" icon={IndianRupee} tone="emerald"
              body="QR दिखाओ, customer scan करे, OR cash लो. Receipt instant print." />
            <StepCard n="3" hindi="आराम करो" title="App सब handle करेगा" icon={BarChart3} tone="violet"
              body="Stock update, Telegram alert, daily report — सब अपने आप." />
          </div>
        </div>
      </section>

      {/* ── VS COMPARISON ───────────────────────────────────────── */}
      <section className="py-20 md:py-24">
        <div className="max-w-5xl mx-auto px-5 md:px-8">
          <div className="text-center mb-12">
            <span className="inline-block px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-[11px] font-black uppercase tracking-widest mb-3">
              Comparison
            </span>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 leading-[1.05]">
              Tally accountants के लिए है.<br />
              AddisonX <span className="text-rose-600">दुकानदारों के लिए</span>.
            </h2>
          </div>

          <div className="rounded-3xl border-2 border-orange-200 overflow-hidden bg-white shadow-xl shadow-orange-100/50">
            <div className="grid grid-cols-[1.5fr_1fr_1fr] text-sm">
              <div className="bg-orange-50 px-5 py-4 font-black uppercase text-[11px] tracking-widest text-slate-500">Feature</div>
              <div className="bg-gradient-to-br from-rose-600 to-orange-600 px-5 py-4 font-black text-white text-center">AddisonX</div>
              <div className="bg-slate-100 px-5 py-4 font-black text-slate-500 text-center">Tally / Vyapar</div>

              {([
                ["5-second bill from barcode",                     true,  "maybe"],
                ["Dynamic UPI QR on checkout",                     true,  false],
                ["Mobile + Desktop — same login",                  true,  "limited"],
                ["Offline billing (WiFi गई तो भी चलेगा)",         true,  false],
                ["WhatsApp + Telegram sale alerts",               true,  false],
                ["Today's Deal — flash discount",                  true,  false],
                ["UI जो शाम तक थकाए नहीं",                        true,  false],
                ["Accounting / Balance sheet exports",             false, true],
              ] as const).map(([feature, mine, theirs], i, arr) => (
                <Row key={i} feature={feature} mine={mine} theirs={theirs} last={i === arr.length - 1} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────────── */}
      <section id="pricing" className="py-20 md:py-28 bg-gradient-to-b from-[#fff8ee] via-amber-50/50 to-rose-50/30 relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute top-20 left-10 text-amber-400/40 text-7xl select-none">✦</div>
        <div aria-hidden className="pointer-events-none absolute bottom-20 right-10 text-rose-400/40 text-6xl select-none">✦</div>

        <div className="relative max-w-6xl mx-auto px-5 md:px-8">
          <div className="text-center mb-14">
            <span className="inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-black uppercase tracking-widest mb-3">
              Pricing
            </span>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 leading-[1.05]">
              Honest pricing. <br className="md:hidden" />
              <span className="text-emerald-600">कोई छुपा charge नहीं.</span>
            </h2>
            <p className="mt-4 text-slate-600 max-w-xl mx-auto text-[15px]">
              Pay monthly or yearly. Cancel anytime. Setup + training हमारे taraf से <span className="font-black text-emerald-700">FREE</span>.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto items-stretch">
            <PriceCard
              name="Free Trial"
              tagline="कोई card नहीं चाहिए"
              hindi="पहले इस्तेमाल करो, फिर पैसे दो"
              originalPrice=""
              price="14 दिन"
              period="Free"
              features={[
                "पूरा software · कोई limit नहीं",
                "Unlimited products + bills",
                "GST invoice + UPI QR",
                "Email + WhatsApp support",
                "कभी भी upgrade करें",
              ]}
              cta="अभी शुरू करें"
              highlighted={false}
            />
            <PriceCard
              name="1 Year Plan"
              tagline="साल भर का सबसे अच्छा deal"
              hindi="MOST POPULAR · 2 महीने FREE"
              originalPrice="₹4,788"
              price="₹2,999"
              period="/year"
              features={[
                "Unlimited products + bills",
                "GST invoice + UPI QR तुरंत",
                "Telegram + WhatsApp alerts",
                "Today's Deal + customer database",
                "Priority WhatsApp support",
                "Free onboarding + training",
              ]}
              cta="अभी subscribe करें"
              highlighted={true}
              badge="🔥 BESTSELLER"
            />
          </div>

          <div className="mt-10 flex flex-col md:flex-row items-center justify-center gap-3 md:gap-6 text-[13px] font-bold text-slate-600">
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" /> 14 दिन Free Trial</span>
            <span className="text-orange-300 hidden md:inline">·</span>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" /> Credit card नहीं चाहिए</span>
            <span className="text-orange-300 hidden md:inline">·</span>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" /> कभी भी cancel</span>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIAL ─────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-gradient-to-br from-rose-600 via-orange-600 to-amber-500 relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_50%)]" />
        <div className="relative max-w-3xl mx-auto px-5 md:px-8 text-center text-white">
          <div className="flex justify-center gap-1 mb-5 text-amber-200">
            {[0,1,2,3,4].map((i) => <Star key={i} className="w-6 h-6 fill-current drop-shadow-md" />)}
          </div>
          <p className="text-2xl md:text-4xl font-black tracking-tight leading-snug">
            "हमारा cashier सालों से Tally पर था. <br className="hidden md:inline" />
            2 दिन में AddisonX सीख गया. अब वापस नहीं जाएगा."
          </p>
          <div className="mt-8 inline-flex items-center gap-4 bg-white/15 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/30">
            <div className="w-14 h-14 rounded-full bg-white text-rose-600 flex items-center justify-center font-black text-lg shadow-lg">
              SK
            </div>
            <div className="text-left">
              <p className="font-black text-base">Sharma Kirana Store</p>
              <p className="text-[12px] opacity-90">India · Verified shopkeeper</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 md:py-24">
        <div className="max-w-3xl mx-auto px-5 md:px-8">
          <div className="text-center mb-12">
            <span className="inline-block px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-black uppercase tracking-widest mb-3">
              FAQ
            </span>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 leading-[1.05]">
              शुरू करने से पहले <br className="md:hidden" />
              <span className="text-rose-600">कुछ सवाल?</span>
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <details key={i} open={openFaq === i}
                onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && setOpenFaq(i)}
                className="rounded-2xl border-2 border-orange-200 bg-white overflow-hidden group hover:border-orange-300 transition-colors">
                <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-3 font-black text-slate-900">
                  <span className="text-[15px]">{f.q}</span>
                  <ChevronDown className="w-5 h-5 text-rose-500 transition-transform group-open:rotate-180 shrink-0" />
                </summary>
                <div className="px-5 pb-4 text-[14px] text-slate-600 leading-relaxed">{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────── */}
      <section className="py-20 md:py-24 relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-rose-600 via-orange-600 via-amber-500 to-emerald-600" />
        <div aria-hidden className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-white/20 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full bg-amber-200/30 blur-3xl" />

        <div className="relative max-w-3xl mx-auto px-5 md:px-8 text-center text-white">
          <Trophy className="w-12 h-12 mx-auto mb-5 text-amber-200" />
          <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-[1.05]">
            दुकान चलाओ. <br />
            <span className="text-amber-200">हम सब handle करेंगे.</span>
          </h2>
          <p className="mt-5 text-white/95 text-lg max-w-xl mx-auto">
            14 दिन free. कोई card नहीं चाहिए. WhatsApp पर तुरंत support.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login"
              className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-white text-rose-700 font-black text-[15px] shadow-2xl hover:scale-[1.03] active:scale-[0.98] transition-all">
              अभी Free शुरू करें <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="https://wa.me/?text=Hi%2C%20demo%20chahiye"
              target="_blank" rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-emerald-500 text-white font-black text-[15px] shadow-2xl ring-2 ring-white/40 hover:bg-emerald-600 active:scale-[0.98] transition-all">
              <MessageCircle className="w-5 h-5" /> WhatsApp Demo
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="relative bg-slate-950 text-slate-300 overflow-hidden">
        {/* Top wave divider */}
        <div aria-hidden className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-600 via-orange-500 via-amber-500 to-emerald-500" />
        {/* Ambient backdrop */}
        <div aria-hidden className="pointer-events-none absolute -top-32 -left-32 w-[400px] h-[400px] rounded-full bg-rose-500/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full bg-orange-500/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

        {/* ─── Trust badges row ─── */}
        <div className="relative border-b border-slate-800/80">
          <div className="max-w-6xl mx-auto px-5 md:px-8 py-7 grid grid-cols-2 md:grid-cols-4 gap-5">
            {[
              { icon: ShieldCheck, label: "Bank-grade",  sub: "256-bit encryption", tone: "text-emerald-400" },
              { icon: Award,       label: "GST Certified", sub: "Full compliance",  tone: "text-amber-400" },
              { icon: Headphones,  label: "Live Support",  sub: "WhatsApp · 9-9",   tone: "text-rose-400" },
              { icon: Store,       label: "Made in Bharat", sub: "Built in Ranchi", tone: "text-orange-400" },
            ].map(({ icon: Icon, label, sub, tone }, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center ${tone}`}>
                  <Icon className="w-5 h-5" strokeWidth={2.4} />
                </div>
                <div>
                  <p className="text-[13px] font-black text-white leading-tight">{label}</p>
                  <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Main footer ─── */}
        <div className="relative max-w-6xl mx-auto px-5 md:px-8 py-14 grid lg:grid-cols-[2fr_1fr_1fr_1.3fr] gap-10 text-sm">
          {/* Brand block */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30 ring-2 ring-slate-800">
                <Zap className="w-6 h-6" strokeWidth={2.8} />
              </div>
              <div>
                <p className="text-lg font-black text-white tracking-tight">AddisonX</p>
                <p className="text-[10px] font-bold text-orange-300 tracking-widest uppercase">दुकान का सॉफ्टवेयर</p>
              </div>
            </div>

            <p className="text-slate-400 leading-relaxed text-[13.5px] max-w-sm">
              भारत का सबसे आसान billing &amp; inventory software. Built with love in Ranchi, used in दुकानें across Bharat.
            </p>

            {/* Newsletter */}
            <div className="mt-6 max-w-sm">
              <p className="text-[11px] font-black uppercase tracking-widest text-orange-300 mb-2">
                हर हफ्ते tips पाएं
              </p>
              <form
                onSubmit={(e) => e.preventDefault()}
                className="flex gap-2"
              >
                <input
                  type="email"
                  placeholder="aap@dukaan.com"
                  className="flex-1 px-3.5 h-11 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50"
                />
                <button type="submit"
                  className="px-4 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 text-white font-black text-sm shadow-md shadow-orange-500/30 hover:scale-[1.03] active:scale-95 transition-all flex items-center gap-1">
                  Subscribe <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
              <p className="mt-2 text-[11px] text-slate-500">
                Spam नहीं. Unsubscribe कभी भी.
              </p>
            </div>
          </div>

          {/* Product links */}
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-orange-300 mb-4">Product</p>
            <ul className="space-y-2.5">
              <li><a href="#features"  className="text-slate-400 hover:text-white transition-colors">Features</a></li>
              <li><a href="#how"       className="text-slate-400 hover:text-white transition-colors">कैसे काम करता है</a></li>
              <li><a href="#pricing"   className="text-slate-400 hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#faq"       className="text-slate-400 hover:text-white transition-colors">FAQ</a></li>
              <li><Link href="/login"  className="text-slate-400 hover:text-white transition-colors">Sign In</Link></li>
            </ul>
          </div>

          {/* Company / Resources */}
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-orange-300 mb-4">Company</p>
            <ul className="space-y-2.5">
              <li><a className="text-slate-400 hover:text-white transition-colors cursor-default">About us</a></li>
              <li><a className="text-slate-400 hover:text-white transition-colors cursor-default">Blog</a></li>
              <li><a className="text-slate-400 hover:text-white transition-colors cursor-default">Careers</a></li>
              <li><a className="text-slate-400 hover:text-white transition-colors cursor-default">Privacy Policy</a></li>
              <li><a className="text-slate-400 hover:text-white transition-colors cursor-default">Terms of Service</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-orange-300 mb-4">हमसे बात करें</p>
            <ul className="space-y-3">
              <li>
                <a href="tel:+919999999999" className="group flex items-start gap-2.5 hover:text-white transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 shrink-0 group-hover:border-emerald-500/50">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Call us</p>
                    <p className="text-[13px] font-bold text-white">+91 99999 99999</p>
                  </div>
                </a>
              </li>
              <li>
                <a href="https://wa.me/" target="_blank" rel="noreferrer"
                  className="group flex items-start gap-2.5 hover:text-white transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 shrink-0 group-hover:border-emerald-500/50">
                    <MessageCircle className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">WhatsApp</p>
                    <p className="text-[13px] font-bold text-emerald-300">Chat with us</p>
                  </div>
                </a>
              </li>
              <li>
                <a href="mailto:addisonxmedia@gmail.com"
                  className="group flex items-start gap-2.5 hover:text-white transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 shrink-0 group-hover:border-amber-500/50">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Email</p>
                    <p className="text-[12.5px] font-bold text-white break-all">addisonxmedia@gmail.com</p>
                  </div>
                </a>
              </li>
              <li>
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-rose-400 shrink-0">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Office</p>
                    <p className="text-[12.5px] font-bold text-white">Ranchi, Jharkhand 🇮🇳</p>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* ─── Bottom bar ─── */}
        <div className="relative border-t border-slate-800/80">
          <div className="max-w-6xl mx-auto px-5 md:px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-[12px] text-slate-500">
            <p>© {new Date().getFullYear()} AddisonX Media. All rights reserved.</p>
            <p className="flex items-center gap-1.5">
              हम भारत के लिए बनाते हैं · Made with <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" /> in India 🇮🇳
            </p>
          </div>
        </div>
      </footer>

      {/* ── Floating WhatsApp button (mobile + desktop) ─────────── */}
      <a href="https://wa.me/?text=Hi%20AddisonX%2C%20demo%20chahiye"
        target="_blank" rel="noreferrer"
        aria-label="WhatsApp us"
        className="fixed bottom-5 right-5 z-50 group">
        <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-30" />
        <div className="relative w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-2xl shadow-emerald-500/40 ring-4 ring-white transition-all group-hover:scale-110">
          <MessageCircle className="w-7 h-7" strokeWidth={2.5} />
        </div>
        <span className="absolute right-16 top-1/2 -translate-y-1/2 hidden md:block whitespace-nowrap bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          WhatsApp पर बात करें
        </span>
      </a>
    </div>
  );
}

/* ───────── helpers ──────────────────────────────────────────── */

function StatTile({ label, value, tone }: { label: string; value: string; tone: "emerald" | "rose" | "amber" | "violet" }) {
  const map = {
    emerald: "from-emerald-100 to-white text-emerald-700 border-emerald-200",
    rose:    "from-rose-100    to-white text-rose-700    border-rose-200",
    amber:   "from-amber-100   to-white text-amber-700   border-amber-200",
    violet:  "from-violet-100  to-white text-violet-700  border-violet-200",
  }[tone];
  return (
    <div className={`rounded-2xl border-2 bg-gradient-to-br ${map} p-2.5`}>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-0.5 text-xl font-black tabular-nums">{value}</p>
    </div>
  );
}

function FeatureCard({ icon: Icon, tone, title, hindi, body }: {
  icon: React.ElementType; tone: "rose" | "orange" | "emerald" | "violet" | "fuchsia" | "amber";
  title: string; hindi: string; body: string;
}) {
  const tones: Record<typeof tone, string> = {
    rose:    "from-rose-500    to-pink-500     shadow-rose-500/30",
    orange:  "from-orange-500  to-amber-500    shadow-orange-500/30",
    emerald: "from-emerald-500 to-teal-500     shadow-emerald-500/30",
    violet:  "from-violet-500  to-fuchsia-500  shadow-violet-500/30",
    fuchsia: "from-fuchsia-500 to-pink-500     shadow-fuchsia-500/30",
    amber:   "from-amber-400   to-yellow-500   shadow-amber-500/30",
  };
  return (
    <div className="group rounded-3xl border-2 border-orange-100 bg-white p-6 hover:border-orange-300 hover:shadow-xl hover:shadow-orange-100 hover:-translate-y-1 transition-all">
      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${tones[tone]} flex items-center justify-center text-white shadow-lg`}>
        <Icon className="w-6 h-6" strokeWidth={2.4} />
      </div>
      <p className="mt-4 text-[18px] font-black tracking-tight text-slate-900">{title}</p>
      <p className="text-[12px] font-black text-rose-600 mt-0.5">{hindi}</p>
      <p className="mt-2 text-[14px] text-slate-600 leading-relaxed">{body}</p>
    </div>
  );
}

function StepCard({ n, hindi, title, body, icon: Icon, tone }: {
  n: string; hindi: string; title: string; body: string;
  icon: React.ElementType; tone: "rose" | "emerald" | "violet";
}) {
  const tones: Record<typeof tone, { bg: string; ring: string; text: string }> = {
    rose:    { bg: "from-rose-500 to-pink-500",         ring: "ring-rose-200",    text: "text-rose-600"    },
    emerald: { bg: "from-emerald-500 to-teal-500",      ring: "ring-emerald-200", text: "text-emerald-600" },
    violet:  { bg: "from-violet-500 to-fuchsia-500",    ring: "ring-violet-200",  text: "text-violet-600"  },
  };
  const t = tones[tone];
  return (
    <div className="relative rounded-3xl bg-white border-2 border-orange-100 p-6 md:p-7 shadow-sm hover:shadow-xl hover:shadow-orange-100 transition-all">
      {/* Big number sticker */}
      <div className={`absolute -top-5 -left-3 w-14 h-14 rounded-2xl bg-gradient-to-br ${t.bg} text-white flex items-center justify-center font-black text-2xl shadow-lg ring-4 ring-white rotate-[-6deg]`}>
        {n}
      </div>
      <div className="flex justify-end mb-3">
        <div className={`w-10 h-10 rounded-xl bg-white border-2 border-orange-100 flex items-center justify-center ${t.text}`}>
          <Icon className="w-5 h-5" strokeWidth={2.5} />
        </div>
      </div>
      <p className={`text-[12px] font-black uppercase tracking-widest ${t.text}`}>{hindi}</p>
      <p className="mt-1 text-[20px] font-black tracking-tight text-slate-900">{title}</p>
      <p className="mt-2 text-[14px] text-slate-600 leading-relaxed">{body}</p>
    </div>
  );
}

function Row({ feature, mine, theirs, last }: {
  feature: string; mine: boolean | "maybe" | "limited"; theirs: boolean | "maybe" | "limited"; last: boolean;
}) {
  const cell = (v: typeof mine, accent: boolean) => {
    if (v === true)  return <Check className={`w-5 h-5 ${accent ? "text-emerald-200" : "text-emerald-600"}`} />;
    if (v === false) return <X     className={`w-5 h-5 ${accent ? "text-white/40"   : "text-slate-300"}`} />;
    return <span className={`text-[11px] font-black uppercase ${accent ? "text-white/85" : "text-slate-500"}`}>{v}</span>;
  };
  return (
    <>
      <div className={`px-5 py-4 text-slate-700 font-semibold ${last ? "" : "border-b border-orange-100"}`}>{feature}</div>
      <div className={`px-5 py-4 flex justify-center bg-gradient-to-br from-rose-600 to-orange-600 ${last ? "" : "border-b border-white/20"}`}>
        {cell(mine, true)}
      </div>
      <div className={`px-5 py-4 flex justify-center bg-slate-50 ${last ? "" : "border-b border-orange-100"}`}>
        {cell(theirs, false)}
      </div>
    </>
  );
}

function PriceCard({
  name, tagline, hindi, originalPrice, price, period, features, cta, highlighted, badge, comingSoon,
}: {
  name: string; tagline: string; hindi: string;
  originalPrice?: string; price: string; period: string;
  features: string[]; cta: string;
  highlighted?: boolean; badge?: string; comingSoon?: boolean;
}) {
  return (
    <div className={`relative rounded-3xl p-6 md:p-7 ${
      highlighted
        ? "bg-gradient-to-br from-rose-600 via-orange-600 to-amber-500 text-white shadow-2xl shadow-rose-500/30 ring-2 ring-amber-300 scale-105 md:scale-110 md:my-0 my-4"
        : "bg-white text-slate-900 border-2 border-orange-100"
    }`}>
      {badge && (
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-amber-300 text-amber-950 text-[11px] font-black uppercase tracking-widest shadow-lg ring-2 ring-white whitespace-nowrap">
          {badge}
        </span>
      )}
      <div className="flex items-baseline gap-2">
        <p className={`text-[13px] font-black uppercase tracking-widest ${highlighted ? "text-amber-100" : "text-rose-600"}`}>{name}</p>
      </div>
      <p className={`mt-0.5 text-[13px] font-bold ${highlighted ? "text-white/95" : "text-slate-700"}`}>{tagline}</p>
      <p className={`mt-2 text-[12px] font-bold ${highlighted ? "text-amber-200" : "text-emerald-600"}`}>{hindi}</p>

      <div className="mt-5 flex items-baseline gap-2 flex-wrap">
        {originalPrice && (
          <span className={`text-xl line-through ${highlighted ? "text-white/60" : "text-slate-400"}`}>{originalPrice}</span>
        )}
        <span className="text-4xl md:text-5xl font-black tracking-tight">{price}</span>
        <span className={`${highlighted ? "text-white/90" : "text-slate-500"} font-bold`}>{period}</span>
      </div>

      <ul className="mt-6 space-y-2.5 text-[14px]">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
              highlighted ? "bg-amber-300 text-amber-950" : "bg-emerald-100 text-emerald-700"
            }`}>
              <Check className="w-3 h-3" strokeWidth={3} />
            </div>
            <span className={highlighted ? "text-white/95 font-medium" : "text-slate-700 font-medium"}>{f}</span>
          </li>
        ))}
      </ul>

      {comingSoon ? (
        <a href="https://wa.me/?text=Hi%2C%20Chain%20plan%20chahiye"
          target="_blank" rel="noreferrer"
          className="mt-7 inline-flex items-center justify-center gap-1.5 w-full py-3.5 rounded-2xl border-2 border-slate-300 text-slate-700 font-black hover:bg-slate-50 transition-colors">
          {cta} <ArrowRight className="w-4 h-4" />
        </a>
      ) : (
        <Link href="/login"
          className={`mt-7 inline-flex items-center justify-center gap-1.5 w-full py-3.5 rounded-2xl font-black text-[14px] transition-all active:scale-[0.98] ${
            highlighted
              ? "bg-white text-rose-700 hover:scale-[1.02] shadow-xl"
              : "bg-gradient-to-br from-rose-600 to-orange-600 text-white hover:scale-[1.02] shadow-lg shadow-rose-500/30"
          }`}>
          {cta} <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
}

const FAQS: { q: string; a: string }[] = [
  {
    q: "क्या मुझे कुछ install करना पड़ेगा?",
    a: "नहीं. AddisonX browser में चलता है — Chrome, Edge, Safari, सब. Mobile, tablet, और desktop तीनों पर. Data cloud में सुरक्षित, सब devices पर real time sync.",
  },
  {
    q: "कौन सा hardware चाहिए?",
    a: "बस एक USB barcode scanner (TVS, Honeywell, Symbol — कोई भी) और 80mm thermal printer for receipt. कोई driver या extra software नहीं. Plug-and-play — ज़्यादातर scanner लगाते ही auto-detect होते हैं.",
  },
  {
    q: "Internet नहीं हो तो क्या?",
    a: "Tension मत लो. Internet चला गया तो भी billing चलती रहेगी. Bills locally save होते हैं, internet वापस आते ही automatically sync हो जाते हैं. कोई customer wait नहीं करेगा.",
  },
  {
    q: "मेरा data safe है?",
    a: "बिल्कुल. Encrypted database, HMAC-signed sessions, owner-staff अलग logins, गलत PIN पर lockout, हर admin action का audit log. आपका data सिर्फ आपका — कभी भी export कर सकते हैं.",
  },
  {
    q: "GST का setup कैसे?",
    a: "Settings में अपना GSTIN और tax rate (5/12/18/28%) डालो — बस. हर receipt पर CGST + SGST split, taxable value, net total सब automatic. 80mm thermal printer में direct print.",
  },
  {
    q: "Cancel करना हो तो?",
    a: "कभी भी. कोई lock-in नहीं. Monthly या yearly — आपकी मर्ज़ी (yearly में 20% बचत). Cancel करोगे तो आपका data export करके आपको दे देंगे — कोई सवाल नहीं, कोई fee नहीं.",
  },
];
