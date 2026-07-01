import { Link } from "wouter";
import { ArrowLeft, Mail, MessageCircle } from "lucide-react";
import { useSeo, SITE } from "@/lib/seo";

/* ═══════════════════════════════════════════════════════════════
   Addison Bill — public legal pages (Terms / Privacy / Refund).
   Required for payment-provider (UPI / Razorpay / card) onboarding.
   Plain, readable boilerplate — review with counsel before launch.
═══════════════════════════════════════════════════════════════ */

const COMPANY   = "Addison Bill Media";
const SUPPORT   = "hello@addisonxmedia.com";
const WHATSAPP  = "919999999999";
const LAST_UPDATED = "28 June 2026";

type Section = { h: string; body: string[] };
type Doc = { title: string; intro: string; sections: Section[] };

const DOCS: Record<"terms" | "privacy" | "refund", Doc> = {
  terms: {
    title: "Terms of Service",
    intro: `These Terms govern your access to and use of the ${COMPANY} billing software and related services ("Service"). By creating an account or using the Service, you agree to these Terms.`,
    sections: [
      { h: "1. Who can use the Service", body: [
        "You must be at least 18 years old and legally able to enter into a contract under Indian law.",
        "You are responsible for the accuracy of the business and tax details you provide, and for all activity under your account.",
      ]},
      { h: "2. Your account", body: [
        "Keep your login credentials confidential. You are responsible for any billing, inventory, or staff actions taken from your account.",
        "Notify us immediately at " + SUPPORT + " if you suspect unauthorised access.",
      ]},
      { h: "3. Acceptable use", body: [
        "Do not use the Service for any unlawful purpose, to issue fraudulent invoices, or to evade applicable taxes.",
        "Do not attempt to disrupt, reverse-engineer, or gain unauthorised access to the Service or its data.",
      ]},
      { h: "4. Plans, billing & taxes", body: [
        "Paid plans are billed in advance for the chosen period. Prices are in INR and exclusive of applicable taxes unless stated otherwise.",
        "We may revise pricing with prior notice; changes apply from your next renewal.",
      ]},
      { h: "5. Your data", body: [
        "You own the business data you enter. We process it to provide the Service, as described in our Privacy Policy.",
        "You can export your bills, products, and reports at any time while your subscription is active.",
      ]},
      { h: "6. Availability & support", body: [
        "We aim for high availability but do not guarantee uninterrupted service. Planned maintenance will be communicated where practical.",
        "Support is available over WhatsApp and email during business hours.",
      ]},
      { h: "7. Limitation of liability", body: [
        "The Service is provided \"as is\". To the maximum extent permitted by law, our total liability is limited to the fees you paid in the three months preceding the claim.",
      ]},
      { h: "8. Termination", body: [
        "You may cancel at any time from Settings. We may suspend or terminate accounts that breach these Terms.",
        "On termination you may export your data for 30 days, after which it may be deleted.",
      ]},
      { h: "9. Governing law", body: [
        "These Terms are governed by the laws of India, with exclusive jurisdiction in the courts of Mumbai, Maharashtra.",
      ]},
    ],
  },
  privacy: {
    title: "Privacy Policy",
    intro: `This Policy explains what information ${COMPANY} collects, how we use it, and the choices you have. We collect only what we need to run your billing and keep your account secure.`,
    sections: [
      { h: "1. Information we collect", body: [
        "Account details: your name, business name, phone number, and email.",
        "Business data you enter: products, prices, bills, customers, suppliers, and staff.",
        "Usage and device data: log-in times, IP address, and browser type, used for security and reliability.",
      ]},
      { h: "2. How we use it", body: [
        "To provide and operate the Service, process your transactions, and generate reports.",
        "To secure accounts, prevent fraud, and comply with legal obligations.",
        "To send service-related notices. We do not sell your data.",
      ]},
      { h: "3. Sharing", body: [
        "We share data only with processors that help us run the Service (e.g. hosting, payment gateways such as Razorpay), under confidentiality obligations, and where required by law.",
      ]},
      { h: "4. Data retention", body: [
        "We retain your business data for as long as your account is active and for a reasonable period afterwards to meet legal and tax requirements.",
      ]},
      { h: "5. Security", body: [
        "Data is encrypted in transit. Access is restricted on a need-to-know basis. No method of storage is 100% secure, but we work hard to protect your information.",
      ]},
      { h: "6. Your rights", body: [
        "You can access, correct, export, or request deletion of your data by writing to " + SUPPORT + ".",
      ]},
      { h: "7. Contact", body: [
        "For any privacy question, reach us at " + SUPPORT + ".",
      ]},
    ],
  },
  refund: {
    title: "Refund & Cancellation Policy",
    intro: `We want you to be confident using ${COMPANY}. This Policy explains cancellations and refunds for paid subscriptions.`,
    sections: [
      { h: "1. Free trial", body: [
        "You can evaluate the Service during the free trial before paying. No charge applies until you choose a paid plan.",
      ]},
      { h: "2. Cancellation", body: [
        "You may cancel your subscription at any time from Settings. Your plan stays active until the end of the current billing period; it will not auto-renew after cancellation.",
      ]},
      { h: "3. Refunds", body: [
        "If you are not satisfied, contact us within 7 days of a payment and we will review a refund of that payment.",
        "Refunds, where approved, are issued to the original payment method within 5–7 business days.",
        "Partial periods after the first 7 days are generally non-refundable.",
      ]},
      { h: "4. Failed or duplicate payments", body: [
        "Duplicate charges or payments for a service not delivered are refunded in full. Write to " + SUPPORT + " with the transaction reference.",
      ]},
      { h: "5. How to request", body: [
        "Email " + SUPPORT + " or message us on WhatsApp with your registered phone number and the payment details.",
      ]},
    ],
  },
};

export default function Legal({ doc }: { doc: "terms" | "privacy" | "refund" }) {
  const d = DOCS[doc];
  useSeo({
    title: `${d.title} — ${SITE.name}`,
    description: d.intro,
    path: `/${doc}`,
  });
  return (
    <div className="min-h-screen bg-[#FFFBF5] text-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#FFFBF5]/90 backdrop-blur-xl border-b border-[#FFC8A0]/50">
        <div className="max-w-3xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center group">
            <img src="/logo2.png" alt="Addison Bill — Dukaan ka Software" className="h-9 w-auto transition-transform group-hover:scale-[1.03]" />
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#B83A0A] hover:gap-2.5 transition-all">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-3xl mx-auto px-4 md:px-6 py-12 md:py-16">
        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#B83A0A] mb-2">Legal</p>
        <h1 className="text-3xl md:text-4xl font-black text-slate-900">{d.title}</h1>
        <p className="text-sm text-slate-500 mt-2">Last updated: {LAST_UPDATED}</p>

        <p className="mt-6 text-[15px] leading-relaxed text-slate-700">{d.intro}</p>

        <div className="mt-10 space-y-8">
          {d.sections.map((s) => (
            <section key={s.h}>
              <h2 className="text-lg font-black text-slate-900 mb-2">{s.h}</h2>
              <div className="space-y-2">
                {s.body.map((p, i) => (
                  <p key={i} className="text-[15px] leading-relaxed text-slate-700">{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Contact card */}
        <div className="mt-12 rounded-2xl bg-white ring-1 ring-[#FFC8A0]/60 shadow-sm p-5 md:p-6">
          <p className="font-black text-slate-900 mb-3">Questions about this document?</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a href={`mailto:${SUPPORT}`}
               className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold text-[#B83A0A] bg-[#FFE4D1]/60 hover:bg-[#FFE4D1] transition-all">
              <Mail className="w-4 h-4" /> {SUPPORT}
            </a>
            <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener"
               className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-black text-white bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:-translate-y-0.5 transition-all">
              <MessageCircle className="w-4 h-4" /> WhatsApp us
            </a>
          </div>
        </div>

        <p className="mt-10 text-xs text-slate-400">
          © {new Date().getFullYear()} {COMPANY}. This is a general template and not legal advice — please have it reviewed by a qualified professional before relying on it.
        </p>
      </main>
    </div>
  );
}
