import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ScanLine, Receipt, IndianRupee, BarChart3, Package, Sparkles,
  ShieldCheck, Zap, Smartphone, Cloud, Lock, MessageCircle,
  ChevronDown, Check, ArrowRight, X, Star, Menu,
} from "lucide-react";

/**
 * Public marketing landing page served at "/". Lives outside the
 * AppLayout (no SideNav / BottomNav). New visitors land here, scroll,
 * and either Sign In (/login) or book a WhatsApp demo. Logged-in users
 * are auto-redirected by App.tsx's Router so they never see this page.
 */
export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq,  setOpenFaq]  = useState<number | null>(0);

  /* Keep the body scrollable; close mobile menu on resize-to-desktop. */
  useEffect(() => {
    const close = () => setMenuOpen(false);
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* ── Sticky top nav ───────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-white shadow-md shadow-violet-500/30">
              <Zap className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[15px] font-black tracking-tight">AddisonX</span>
              <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">Billing & Inventory</span>
            </div>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#features"   className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#how"        className="hover:text-slate-900 transition-colors">How it works</a>
            <a href="#pricing"    className="hover:text-slate-900 transition-colors">Pricing</a>
            <a href="#faq"        className="hover:text-slate-900 transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/login"
              className="hidden md:inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 active:scale-95 transition-all">
              Sign In <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button onClick={() => setMenuOpen(true)}
              className="md:hidden w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-700">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] bg-white p-5 md:hidden">
          <div className="flex items-center justify-between mb-8">
            <span className="text-lg font-black">Menu</span>
            <button onClick={() => setMenuOpen(false)} className="w-10 h-10 rounded-xl border flex items-center justify-center">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex flex-col gap-1 text-[17px] font-semibold">
            <a href="#features"  onClick={() => setMenuOpen(false)} className="py-3 border-b">Features</a>
            <a href="#how"       onClick={() => setMenuOpen(false)} className="py-3 border-b">How it works</a>
            <a href="#pricing"   onClick={() => setMenuOpen(false)} className="py-3 border-b">Pricing</a>
            <a href="#faq"       onClick={() => setMenuOpen(false)} className="py-3 border-b">FAQ</a>
            <Link href="/login"
              className="mt-6 inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-slate-900 text-white text-base font-bold">
              Sign In <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section id="top" className="relative overflow-hidden">
        {/* Ambient backdrops */}
        <div aria-hidden className="pointer-events-none absolute -top-32 -right-32 w-[560px] h-[560px] rounded-full bg-orange-300/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-32 w-[520px] h-[520px] rounded-full bg-violet-300/30 blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-5 md:px-8 pt-16 pb-20 md:pt-24 md:pb-28 grid md:grid-cols-2 gap-12 items-center">
          {/* Left: copy */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-[12px] font-semibold mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              Made in India · GST + UPI Ready
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05] text-slate-900">
              बिल बनाएं, <span className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 bg-clip-text text-transparent">5 सेकंड</span> में
            </h1>
            <p className="mt-3 text-2xl md:text-3xl font-bold text-slate-700 tracking-tight">
              Stock counts itself. आप दुकान संभालिए.
            </p>

            <p className="mt-5 text-[15px] md:text-base text-slate-600 leading-relaxed max-w-lg">
              Modern POS + inventory for Indian shopkeepers who want the speed of UPI and the simplicity of WhatsApp — without the clutter of Tally or Vyapar.
            </p>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <Link href="/login"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white font-bold text-[15px] shadow-lg shadow-violet-500/30 ring-1 ring-violet-700/20 hover:shadow-xl hover:shadow-violet-500/40 active:scale-[0.98] transition-all">
                Sign In to your shop <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="https://wa.me/?text=Hi%20AddisonX%2C%20I%27d%20like%20a%20demo%20of%20your%20billing%20software"
                target="_blank" rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-50 text-emerald-700 font-bold text-[15px] border border-emerald-200 hover:bg-emerald-100 active:scale-[0.98] transition-all">
                <MessageCircle className="w-4 h-4" /> WhatsApp Demo
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-slate-500">
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> GST Invoice Ready</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> UPI Dynamic QR</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> Works Offline</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500" /> Telegram Alerts</span>
            </div>
          </div>

          {/* Right: hero mockup */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-[36px] bg-gradient-to-br from-violet-500/30 via-fuchsia-500/30 to-orange-400/30 blur-2xl" />
            <div className="relative rounded-[28px] border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 overflow-hidden">
              {/* Faux dashboard mockup */}
              <div className="bg-gradient-to-br from-slate-50 to-white p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xl font-black tracking-tight">Hira & Sons Gift Shop</p>
                    <p className="text-xs text-slate-500">Overview · today</p>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <StatTile label="Today's Revenue" value="₹14,380" tone="emerald" />
                  <StatTile label="Bills Raised"    value="23"      tone="violet"  />
                  <StatTile label="Items Sold"      value="61"      tone="orange"  />
                  <StatTile label="Items Stocked"   value="1,284"   tone="slate"   />
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Revenue · last 7 days</p>
                  <div className="flex items-end gap-2 h-20">
                    {[55, 32, 78, 45, 90, 65, 100].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-violet-500 to-fuchsia-400" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-slate-500">
                  <ScanLine className="w-3.5 h-3.5 text-violet-600" /> Bill #11 · Aqua Star Steel · <span className="text-slate-900">₹439</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust strip ──────────────────────────────────────────── */}
      <section className="py-8 border-y border-slate-100 bg-slate-50/50">
        <div className="max-w-6xl mx-auto px-5 md:px-8">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-4">
            Built for the Indian shopkeeper
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[13px] font-semibold text-slate-600">
            <span className="flex items-center gap-1.5"><IndianRupee className="w-4 h-4 text-emerald-600" /> Cash + UPI + QR</span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1.5"><Receipt className="w-4 h-4 text-violet-600" /> 80mm Thermal Receipts</span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1.5"><Smartphone className="w-4 h-4 text-orange-600" /> Mobile + Desktop</span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1.5"><Cloud className="w-4 h-4 text-sky-600" /> Auto Backup</span>
          </div>
        </div>
      </section>

      {/* ── Features grid ────────────────────────────────────────── */}
      <section id="features" className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-5 md:px-8">
          <div className="max-w-2xl mb-12">
            <p className="text-[12px] font-black uppercase tracking-[0.2em] text-violet-600 mb-3">Features</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 leading-tight">
              Everything you need to run the counter — nothing you don't.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard icon={ScanLine}    color="violet"
              title="5-second billing"
              body="USB scanner, camera, or just type. Cart updates instantly. Skip search for hot products with quick-tap tiles." />
            <FeatureCard icon={Receipt}     color="orange"
              title="GST-ready invoices"
              body="CGST + SGST split automatically. Set your rate once in Settings. 80mm thermal-printer compatible." />
            <FeatureCard icon={IndianRupee} color="emerald"
              title="UPI + Cash on one screen"
              body="Dynamic UPI QR generated from your VPA on every checkout. Customer scans and pays — no third-party app needed." />
            <FeatureCard icon={Package}     color="sky"
              title="Stock that counts itself"
              body="Every bill auto-decrements stock. Low-stock alerts hit your Telegram before you run out." />
            <FeatureCard icon={BarChart3}   color="fuchsia"
              title="Reports that owners read"
              body="Daily revenue, top sellers, hourly trends. Take a screenshot, share on WhatsApp." />
            <FeatureCard icon={Sparkles}    color="rose"
              title="Today's Deals"
              body="Set a flash discount with one tap. Auto-expires at end of day. Customers see the strikethrough MRP on every label." />
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section id="how" className="py-20 md:py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-5 md:px-8">
          <div className="text-center mb-14">
            <p className="text-[12px] font-black uppercase tracking-[0.2em] text-violet-600 mb-3">How it works</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">
              Three steps. आपका सारा दिन.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <StepCard n={1} title="Scan or tap"
              body="Barcode scanner, USB scanner, or camera. The product jumps into the cart." />
            <StepCard n={2} title="Take payment"
              body="Cash, UPI, or dynamic QR. Print the GST receipt or share on WhatsApp." />
            <StepCard n={3} title="Owner sees the data"
              body="Stock falls. Telegram pings. Dashboard updates. You go home knowing exactly what sold." />
          </div>
        </div>
      </section>

      {/* ── Comparison ───────────────────────────────────────────── */}
      <section className="py-20 md:py-24">
        <div className="max-w-5xl mx-auto px-5 md:px-8">
          <div className="text-center mb-12">
            <p className="text-[12px] font-black uppercase tracking-[0.2em] text-violet-600 mb-3">Why switch?</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">
              Tally is for accountants. <br className="hidden md:block" />AddisonX is for shopkeepers.
            </h2>
          </div>

          <div className="rounded-3xl border border-slate-200 overflow-hidden bg-white">
            <div className="grid grid-cols-[1.5fr_1fr_1fr] text-sm">
              <div className="bg-slate-50 px-5 py-4 font-black uppercase text-[11px] tracking-widest text-slate-500">Feature</div>
              <div className="bg-gradient-to-br from-violet-600 to-fuchsia-600 px-5 py-4 font-black text-white text-center">AddisonX</div>
              <div className="bg-slate-50 px-5 py-4 font-black text-slate-500 text-center">Tally / Vyapar</div>

              {([
                ["5-second bill from barcode",                     true,  "maybe"],
                ["UPI dynamic QR on checkout",                     true,  false],
                ["Mobile + desktop same login",                    true,  "limited"],
                ["Works offline, syncs later",                     true,  false],
                ["Telegram sale alerts to owner",                  true,  false],
                ["Today's Deals with auto-expiry",                 true,  false],
                ["Modern UI (no menus inside menus)",              true,  false],
                ["Accounting / balance-sheet exports",             false, true],
              ] as const).map(([feature, mine, theirs], i) => (
                <Row key={i} feature={feature} mine={mine} theirs={theirs} last={i === 7} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────── */}
      <section id="pricing" className="py-20 md:py-28 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-6xl mx-auto px-5 md:px-8">
          <div className="text-center mb-14">
            <p className="text-[12px] font-black uppercase tracking-[0.2em] text-violet-600 mb-3">Pricing</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">
              Honest pricing. <span className="text-emerald-600">No hidden fees.</span>
            </h2>
            <p className="mt-3 text-slate-600 max-w-xl mx-auto">
              Pay monthly or yearly. Cancel anytime. Onboarding & training included on every plan.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <PriceCard
              name="Starter"
              tagline="Single counter, 1 cashier"
              price="₹399"
              period="/month"
              features={[
                "Up to 500 products",
                "Cash + UPI billing",
                "GST invoice printing",
                "Daily sales report",
                "Email + chat support",
              ]}
              cta="Sign In"
              highlighted={false}
            />
            <PriceCard
              name="Pro"
              tagline="Up to 3 staff PINs · Most shops"
              price="₹799"
              period="/month"
              features={[
                "Unlimited products",
                "Telegram alerts on every sale",
                "Today's Deals + bulk pricing",
                "Customer name & phone capture",
                "Priority WhatsApp support",
              ]}
              cta="Sign In"
              highlighted={true}
              badge="MOST POPULAR"
            />
            <PriceCard
              name="Chain"
              tagline="Multi-store · Coming soon"
              price="—"
              period=""
              features={[
                "Multiple outlets, one dashboard",
                "Inter-store stock transfer",
                "Consolidated reports",
                "Per-store cashier accounts",
                "Dedicated account manager",
              ]}
              cta="Talk to us"
              highlighted={false}
              comingSoon
            />
          </div>

          <p className="mt-8 text-center text-[12px] text-slate-500">
            Prices in INR · GST extra · 14-day free trial · No credit card upfront
          </p>
        </div>
      </section>

      {/* ── Testimonial ──────────────────────────────────────────── */}
      <section className="py-20 md:py-24">
        <div className="max-w-3xl mx-auto px-5 md:px-8 text-center">
          <div className="flex justify-center gap-1 mb-5 text-amber-400">
            {[0,1,2,3,4].map((i) => <Star key={i} className="w-5 h-5 fill-current" />)}
          </div>
          <p className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 leading-snug">
            "Our cashier was on Tally for years. Two days on AddisonX and he won't go back. The QR-on-screen alone saves us 5 minutes per customer."
          </p>
          <div className="mt-6 inline-flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-black">HS</div>
            <div className="text-left">
              <p className="font-bold text-slate-900">Owner, Hira &amp; Sons</p>
              <p className="text-[12px] text-slate-500">Ranchi, Jharkhand · Gift Shop</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 md:py-24 bg-slate-50">
        <div className="max-w-3xl mx-auto px-5 md:px-8">
          <div className="text-center mb-12">
            <p className="text-[12px] font-black uppercase tracking-[0.2em] text-violet-600 mb-3">FAQ</p>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">
              Questions शुरू करने से पहले
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <details key={i} open={openFaq === i} onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && setOpenFaq(i)}
                className="rounded-2xl border border-slate-200 bg-white overflow-hidden group">
                <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-3 font-bold text-slate-900">
                  {f.q}
                  <ChevronDown className="w-5 h-5 text-slate-500 transition-transform group-open:rotate-180 shrink-0" />
                </summary>
                <div className="px-5 pb-4 text-[14px] text-slate-600 leading-relaxed">{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-orange-500" />
        <div aria-hidden className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-white/15 blur-3xl" />
        <div className="relative max-w-3xl mx-auto px-5 md:px-8 text-center text-white">
          <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
            Run your shop, not your software.
          </h2>
          <p className="mt-4 text-white/90 text-lg max-w-xl mx-auto">
            Sign in to your existing shop, or message us on WhatsApp for a free 15-minute demo.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login"
              className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-white text-violet-700 font-black text-[15px] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all">
              Sign In <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="https://wa.me/?text=Hi%20AddisonX%2C%20I%27d%20like%20a%20demo"
              target="_blank" rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-emerald-500 text-white font-black text-[15px] shadow-xl ring-2 ring-white/40 hover:bg-emerald-600 active:scale-[0.98] transition-all">
              <MessageCircle className="w-4 h-4" /> WhatsApp Demo
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-slate-300 py-12">
        <div className="max-w-6xl mx-auto px-5 md:px-8 grid md:grid-cols-4 gap-8 text-sm">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white">
                <Zap className="w-5 h-5" strokeWidth={2.5} />
              </div>
              <span className="text-base font-black text-white">AddisonX Software</span>
            </div>
            <p className="text-slate-400 leading-relaxed max-w-sm">
              Modern POS + inventory for Indian retail. Built in Ranchi · used in shops across India.
            </p>
            <div className="mt-5 flex items-center gap-2 text-[12px]">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Bank-grade encryption · Audit-logged platform admin · 256-bit HMAC sessions</span>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">Product</p>
            <ul className="space-y-2">
              <li><a href="#features"  className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#pricing"   className="hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#faq"       className="hover:text-white transition-colors">FAQ</a></li>
              <li><Link href="/login"  className="hover:text-white transition-colors">Sign In</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">Contact</p>
            <ul className="space-y-2">
              <li>
                <a href="mailto:addisonxmedia@gmail.com" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> addisonxmedia@gmail.com
                </a>
              </li>
              <li>
                <a href="https://wa.me/" target="_blank" rel="noreferrer" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp us
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-5 md:px-8 mt-10 pt-6 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-2 text-[12px] text-slate-500">
          <p>© {new Date().getFullYear()} AddisonX Media. All rights reserved.</p>
          <p>Made with <span className="text-rose-400">♥</span> in India</p>
        </div>
      </footer>
    </div>
  );
}

/* ───────── small bits ─────────────────────────────────────────── */

function StatTile({ label, value, tone }: { label: string; value: string; tone: "emerald" | "violet" | "orange" | "slate" }) {
  const toneClass = {
    emerald: "from-emerald-50 to-white text-emerald-700",
    violet:  "from-violet-50 to-white text-violet-700",
    orange:  "from-orange-50 to-white text-orange-700",
    slate:   "from-slate-100 to-white text-slate-700",
  }[tone];
  return (
    <div className={`rounded-2xl border border-slate-200 bg-gradient-to-br ${toneClass} p-3`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black tabular-nums">{value}</p>
    </div>
  );
}

function FeatureCard({ icon: Icon, color, title, body }: {
  icon: React.ElementType; color: "violet" | "orange" | "emerald" | "sky" | "fuchsia" | "rose";
  title: string; body: string;
}) {
  const tones: Record<typeof color, string> = {
    violet:  "from-violet-500 to-fuchsia-500   text-white shadow-violet-500/30",
    orange:  "from-orange-500 to-amber-500     text-white shadow-orange-500/30",
    emerald: "from-emerald-500 to-teal-500     text-white shadow-emerald-500/30",
    sky:     "from-sky-500 to-blue-500         text-white shadow-sky-500/30",
    fuchsia: "from-fuchsia-500 to-pink-500     text-white shadow-fuchsia-500/30",
    rose:    "from-rose-500 to-red-500         text-white shadow-rose-500/30",
  };
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 hover:shadow-lg hover:shadow-slate-900/5 hover:-translate-y-0.5 transition-all">
      <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${tones[color]} flex items-center justify-center shadow-md`}>
        <Icon className="w-5 h-5" strokeWidth={2.4} />
      </div>
      <p className="mt-4 text-[17px] font-black tracking-tight text-slate-900">{title}</p>
      <p className="mt-1.5 text-[14px] text-slate-600 leading-relaxed">{body}</p>
    </div>
  );
}

function StepCard({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="text-center md:text-left">
      <div className="inline-flex w-12 h-12 rounded-2xl bg-white border-2 border-violet-500 items-center justify-center text-violet-700 font-black text-lg shadow-sm">
        {n}
      </div>
      <p className="mt-4 text-[18px] font-black tracking-tight text-slate-900">{title}</p>
      <p className="mt-1.5 text-[14px] text-slate-600 leading-relaxed">{body}</p>
    </div>
  );
}

function Row({ feature, mine, theirs, last }: {
  feature: string; mine: boolean | "maybe" | "limited"; theirs: boolean | "maybe" | "limited"; last: boolean;
}) {
  const cell = (v: typeof mine, accent: boolean) => {
    if (v === true)
      return <Check className={`w-5 h-5 ${accent ? "text-emerald-300" : "text-emerald-600"}`} />;
    if (v === false)
      return <X className={`w-5 h-5 ${accent ? "text-white/50" : "text-slate-400"}`} />;
    return <span className={`text-[12px] font-bold ${accent ? "text-white/80" : "text-slate-500"}`}>{v}</span>;
  };
  return (
    <>
      <div className={`px-5 py-4 text-slate-700 ${last ? "" : "border-b border-slate-100"}`}>{feature}</div>
      <div className={`px-5 py-4 flex justify-center bg-gradient-to-br from-violet-600 to-fuchsia-600 ${last ? "" : "border-b border-white/15"}`}>
        {cell(mine, true)}
      </div>
      <div className={`px-5 py-4 flex justify-center text-slate-500 ${last ? "" : "border-b border-slate-100"}`}>
        {cell(theirs, false)}
      </div>
    </>
  );
}

function PriceCard({
  name, tagline, price, period, features, cta, highlighted, badge, comingSoon,
}: {
  name: string; tagline: string; price: string; period: string;
  features: string[]; cta: string; highlighted?: boolean; badge?: string; comingSoon?: boolean;
}) {
  return (
    <div className={`relative rounded-3xl p-6 md:p-7 ${
      highlighted
        ? "bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-2xl shadow-violet-500/30 ring-1 ring-violet-700/30"
        : "bg-white text-slate-900 border border-slate-200"
    }`}>
      {badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-400 text-amber-950 text-[10px] font-black uppercase tracking-widest shadow">
          {badge}
        </span>
      )}
      <p className={`text-[12px] font-black uppercase tracking-widest ${highlighted ? "text-white/80" : "text-slate-500"}`}>{name}</p>
      <p className={`mt-1 text-[13px] ${highlighted ? "text-white/85" : "text-slate-500"}`}>{tagline}</p>

      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-4xl font-black tracking-tight">{price}</span>
        <span className={highlighted ? "text-white/80" : "text-slate-500"}>{period}</span>
      </div>

      <ul className="mt-6 space-y-2.5 text-[14px]">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <Check className={`w-4 h-4 mt-0.5 shrink-0 ${highlighted ? "text-emerald-300" : "text-emerald-600"}`} />
            <span className={highlighted ? "text-white/95" : "text-slate-700"}>{f}</span>
          </li>
        ))}
      </ul>

      {comingSoon ? (
        <a href="https://wa.me/?text=Hi%2C%20interested%20in%20the%20Chain%20plan"
          target="_blank" rel="noreferrer"
          className="mt-7 inline-flex items-center justify-center gap-1.5 w-full py-3 rounded-2xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-colors">
          {cta} <ArrowRight className="w-4 h-4" />
        </a>
      ) : (
        <Link href="/login"
          className={`mt-7 inline-flex items-center justify-center gap-1.5 w-full py-3 rounded-2xl font-black text-[14px] transition-all active:scale-[0.98] ${
            highlighted
              ? "bg-white text-violet-700 hover:scale-[1.02] shadow-lg"
              : "bg-slate-900 text-white hover:bg-slate-800"
          }`}>
          {cta} <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
}

const FAQS: { q: string; a: string }[] = [
  {
    q: "Do I need to install anything on my computer?",
    a: "No. AddisonX runs in any modern browser — Chrome, Edge, Safari. Works on mobile, tablet, and desktop. Your data lives securely in the cloud and syncs across all your devices in real time.",
  },
  {
    q: "What hardware do I need?",
    a: "Just a barcode scanner (any USB scanner works — TVS, Honeywell, Symbol, etc.) and an 80mm thermal printer for receipts. No special drivers or software needed. The scanner plugs in and starts working — most are auto-detected.",
  },
  {
    q: "Does it work without internet?",
    a: "Yes. If your internet drops mid-day, billing continues offline. Bills queue locally and sync automatically when connection returns. No customer turned away because of a WiFi outage.",
  },
  {
    q: "Is my data safe?",
    a: "Yes. Encrypted database, HMAC-signed sessions, separate logins for owner vs staff, PIN lockout after wrong attempts, audit log of every admin action. Your data is yours — export anytime in standard formats.",
  },
  {
    q: "What about GST compliance?",
    a: "Receipts print as full GST invoices with CGST + SGST split, your GSTIN, and your tax rate. Set the rate once in Settings — every receipt calculates correctly. Multi-rate per product is coming soon.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. No long-term lock-in. Pay month-to-month or save 20% with annual billing. If you cancel, we export your data and hand it back — no questions, no fees.",
  },
];
