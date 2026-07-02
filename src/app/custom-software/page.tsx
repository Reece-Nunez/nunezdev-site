/* Hallmark · macrostructure: Workbench · tone: technical/utilitarian · anchor hue: amber (#ffc312)
 * Genre: modern-minimal (B2B software), constrained to the site's dark+yellow brand.
 * Conversion landing page for the national custom-software / CRM Google Ads campaign.
 * Honest copy only — proof is the real JLC platform + Refinery Scheduler; pricing is
 * the real $10k build / $500/mo partner plan. No invented metrics.
 */
import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import LeadForm from "@/components/LeadForm";
import {
  ADDRESS,
  EMAIL,
  PHONE_DISPLAY,
  PHONE_TEL,
} from "@/lib/contact";

export const metadata: Metadata = {
  title: "Custom Software & CRM Development | NunezDev",
  description:
    "Custom CRMs, project-management systems, and workflow automation built around your business — no templates, no offshore. One U.S. developer, start to finish. From $10k or a $500/mo partner plan. Based in Oklahoma, serving nationwide.",
  keywords: [
    "custom software development",
    "custom CRM development",
    "custom business software",
    "custom project management software",
    "workflow automation development",
    "custom web application development",
  ],
  alternates: {
    canonical: "https://www.nunezdev.com/custom-software",
  },
  openGraph: {
    title: "Custom Software & CRM Development | NunezDev",
    description:
      "Software built around how your business actually runs. Custom CRMs, workflow tools, and integrations by one U.S. developer. From $10k or a $500/mo partner plan.",
    url: "https://www.nunezdev.com/custom-software",
    siteName: "NunezDev",
    type: "website",
  },
};

// Real capabilities — each maps to work that exists in the portfolio.
const CAPABILITIES = [
  {
    title: "Custom CRMs",
    body: "A system that tracks your leads, clients, and deals the way your business actually works — not a generic pipeline you have to bend around.",
  },
  {
    title: "Project & workflow systems",
    body: "Phases, tasks, approvals, and hand-offs in one place, so work stops living in spreadsheets, texts, and someone's head.",
  },
  {
    title: "Automations & integrations",
    body: "Connect the tools you already pay for — QuickBooks, Stripe, email, calendars — and let the busywork run itself.",
  },
  {
    title: "Portals & dashboards",
    body: "Give your team and your clients a clean, secure place to see status, upload documents, pay invoices, and get answers.",
  },
];

// Honest pain framing — no invented stats, just the situations these buyers live in.
const PAINS = [
  {
    title: "Everything lives in spreadsheets",
    body: "The whole operation runs on a fragile web of tabs only one person fully understands.",
  },
  {
    title: "The SaaS almost fits",
    body: "You pay monthly for software that does 70% of what you need and fights you on the other 30%.",
  },
  {
    title: "Too much manual busywork",
    body: "Copying data between apps, chasing paperwork, rebuilding the same report every week.",
  },
];

// Real case studies. Descriptions are grounded in shipped work, not marketing fiction.
const CASES = [
  {
    name: "Jones Legacy Creations",
    category: "Construction / Real Estate",
    body: "A full construction-management platform: subcontractor payments, draw requests, live project budgets, a detailed quoting engine, QuickBooks sync, and AI extraction of lender PDFs — plus their public marketing site.",
    stack: ["Next.js", "Supabase", "QuickBooks API"],
    href: "/portfolio/jones-legacy-creations",
  },
  {
    name: "Refinery Scheduler",
    category: "Industrial",
    body: "A safety-compliant workforce scheduling system for oil-refinery operations, with RP-755 fatigue-policy enforcement built into the scheduling logic.",
    stack: ["Next.js", "Prisma", "React Big Calendar"],
    href: "/portfolio/refinery-scheduler",
  },
];

export default function CustomSoftwarePage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center text-offwhite overflow-hidden pt-24">
      {/* Dark backdrop. The site body is bg-white; the homepage darkens itself
          with the heavy <ThreeBackground/> particle canvas. This is an Ads
          landing page where load speed drives Quality Score, so we use a
          pure-CSS fixed dark layer (brand black + a subtle yellow glow) instead
          of shipping Three.js. */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-[#0a0a0a]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(255,195,18,0.10),transparent_60%)]" />
      </div>

      <Script
        id="custom-software-service"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            serviceType: "Custom software & CRM development",
            provider: {
              "@type": "ProfessionalService",
              name: "NunezDev",
              url: "https://www.nunezdev.com",
              telephone: PHONE_TEL,
              email: EMAIL,
              address: {
                "@type": "PostalAddress",
                addressLocality: ADDRESS.city,
                addressRegion: ADDRESS.region,
                postalCode: ADDRESS.postalCode,
                addressCountry: ADDRESS.country,
              },
            },
            areaServed: { "@type": "Country", name: "United States" },
            description:
              "Custom CRMs, project-management systems, and workflow automation built by one U.S. developer. From $10k or a $500/mo partner plan.",
          }),
        }}
      />

      {/* Hero — message-matched to the ad keywords (custom software / CRM). */}
      <section className="w-full max-w-5xl px-4 sm:px-6 py-16 sm:py-24">
        <p className="text-yellow/70 text-sm uppercase tracking-[0.2em] font-medium mb-4">
          Custom CRM · Project Management · Workflow Automation
        </p>
        <h1 className="text-yellow text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] max-w-3xl">
          Custom software, built around your business.
        </h1>
        <p className="text-white/70 text-base md:text-lg max-w-2xl mt-6">
          Stop bending your business to fit off-the-shelf software. I build
          custom CRMs, project-management systems, and workflow tools around how
          you actually work — no templates, no offshore hand-offs. You work
          directly with the U.S. developer who writes the code, start to finish.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mt-8">
          <a
            href="#start"
            className="bg-yellow text-gray-900 font-semibold px-8 py-3.5 rounded-lg hover:bg-yellow/80 transition-colors text-base sm:text-lg text-center"
          >
            Get a free scoping call &rarr;
          </a>
          <a
            href="#proof"
            className="text-base sm:text-lg text-white border border-white/40 px-8 py-3.5 rounded-lg font-semibold hover:bg-white hover:text-gray-800 transition-colors text-center"
          >
            See real builds
          </a>
        </div>

        <p className="text-white/40 text-sm mt-6">
          Based in Oklahoma · building for businesses nationwide
        </p>
      </section>

      {/* Pain frame — the situations these buyers actually recognize. */}
      <section className="w-full max-w-5xl px-4 sm:px-6 py-8">
        <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-8">
          Sound familiar?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PAINS.map((item) => (
            <div
              key={item.title}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6"
            >
              <h3 className="text-white font-semibold text-lg mb-2">{item.title}</h3>
              <p className="text-white/60 text-sm leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Capability grid — what "custom software" concretely means here. */}
      <section className="w-full max-w-5xl px-4 sm:px-6 py-12">
        <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-3">
          What I build
        </h2>
        <p className="text-white/60 max-w-2xl mb-8">
          One developer who can take a business problem from first conversation
          to a working system in production.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {CAPABILITIES.map((item) => (
            <div
              key={item.title}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6"
            >
              <h3 className="text-yellow font-semibold text-lg mb-2">{item.title}</h3>
              <p className="text-white/60 text-sm leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Proof — real case studies, the campaign's strongest asset. */}
      <section id="proof" className="w-full max-w-5xl px-4 sm:px-6 py-12 scroll-mt-24">
        <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-3">
          Real systems, shipped
        </h2>
        <p className="text-white/60 max-w-2xl mb-8">
          Not mockups — production software businesses use every day.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {CASES.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="group bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-7 hover:border-yellow/40 transition-colors"
            >
              <p className="text-yellow/70 text-xs uppercase tracking-[0.15em] font-medium mb-2">
                {item.category}
              </p>
              <h3 className="text-white font-bold text-xl mb-3 group-hover:text-yellow transition-colors">
                {item.name}
              </h3>
              <p className="text-white/60 text-sm leading-relaxed mb-5">{item.body}</p>
              <div className="flex flex-wrap gap-2">
                {item.stack.map((tag) => (
                  <span
                    key={tag}
                    className="bg-white/5 border border-white/15 text-white/60 text-xs px-3 py-1 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
        <p className="text-white/40 text-sm mt-6">
          More work in the{" "}
          <Link
            href="/portfolio"
            className="text-yellow/70 hover:text-yellow underline-offset-4 hover:underline"
          >
            full portfolio
          </Link>
          .
        </p>
      </section>

      {/* Pricing framing — the two real ways to work together. */}
      <section className="w-full max-w-5xl px-4 sm:px-6 py-12">
        <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-3">
          Two ways to work together
        </h2>
        <p className="text-white/60 max-w-2xl mb-8">
          Every project is scoped and quoted up front — you see the price before
          any work starts.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-7">
            <h3 className="text-yellow font-semibold text-lg mb-1">Build it once</h3>
            <p className="text-white text-3xl font-bold mb-3">
              From $10k
            </p>
            <p className="text-white/60 text-sm leading-relaxed">
              A custom system scoped, built, and handed off — the code is yours.
              Ideal when you know the problem and want it solved cleanly.
            </p>
          </div>
          <div className="bg-yellow/5 backdrop-blur-sm border border-yellow/30 rounded-2xl p-7">
            <p className="text-yellow/80 text-xs uppercase tracking-[0.15em] font-medium mb-2">
              Most popular
            </p>
            <h3 className="text-yellow font-semibold text-lg mb-1">Partner plan</h3>
            <p className="text-white text-3xl font-bold mb-3">
              $500<span className="text-lg font-medium text-white/60">/mo</span>
            </p>
            <p className="text-white/60 text-sm leading-relaxed">
              A lower up-front build plus an ongoing partnership: hosting,
              maintenance, and continued development as your business grows. I
              stay in it with you.
            </p>
          </div>
        </div>
      </section>

      {/* Why me — the differentiators that matter for a custom-software buyer. */}
      <section className="w-full max-w-5xl px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: "One developer, start to finish",
              body: "You talk to the person who writes the code — not a sales rep, not a project manager relaying to an offshore team.",
            },
            {
              title: "Built custom, no templates",
              body: "The system fits your workflow, not a generic template you have to work around. You own the code and the data.",
            },
            {
              title: "It connects to what you use",
              body: "QuickBooks, Stripe, email, calendars, and more — integrated so your tools finally talk to each other.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6"
            >
              <h3 className="text-yellow font-semibold text-lg mb-2">{item.title}</h3>
              <p className="text-white/60 text-sm leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Lead form CTA. */}
      <section
        id="start"
        className="w-full max-w-3xl px-4 sm:px-6 py-16 sm:py-24 scroll-mt-24"
      >
        <h2 className="text-2xl md:text-3xl font-bold text-yellow text-center mb-3">
          Tell me what you&apos;re trying to fix
        </h2>
        <p className="text-white/60 text-center max-w-xl mx-auto mb-8">
          Share the basics and I&apos;ll reply within 24 hours with honest
          thoughts, a rough scope, and a ballpark price. No sales pressure.
        </p>
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 sm:p-8">
          <LeadForm source="custom_software" />
        </div>
      </section>

      {/* Bottom NAP. */}
      <section className="w-full max-w-4xl px-4 sm:px-6 pb-20 text-center">
        <p className="text-white/40 text-sm">
          NunezDev LLC · {ADDRESS.city}, {ADDRESS.region} {ADDRESS.postalCode} ·{" "}
          <a href={`tel:${PHONE_TEL}`} className="text-yellow/70 hover:text-yellow">
            {PHONE_DISPLAY}
          </a>{" "}
          ·{" "}
          <a href={`mailto:${EMAIL}`} className="text-yellow/70 hover:text-yellow">
            {EMAIL}
          </a>
        </p>
      </section>
    </main>
  );
}
