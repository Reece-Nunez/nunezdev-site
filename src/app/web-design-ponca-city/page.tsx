import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import LeadForm from "@/components/LeadForm";
import { testimonials } from "@/data/testimonials";
import {
  ADDRESS,
  EMAIL,
  PHONE_DISPLAY,
  PHONE_TEL,
  REVIEW_SUMMARY,
} from "@/lib/contact";

const CITY = "Ponca City";
const REGION = "Oklahoma";
const NEARBY = ["Stillwater", "Enid", "Bartlesville", "Tulsa", "Oklahoma City"];

export const metadata: Metadata = {
  title: `Web Design in Ponca City, OK | NunezDev`,
  description:
    "Custom web design and development for Ponca City, OK small businesses. Hand-coded sites that load fast, rank locally, and convert visitors into leads. Based in Ponca City.",
  keywords: [
    "web design Ponca City",
    "web design Ponca City OK",
    "Ponca City web developer",
    "Ponca City website design",
    "small business website Ponca City",
    "Oklahoma web designer",
  ],
  alternates: {
    canonical: "https://www.nunezdev.com/web-design-ponca-city",
  },
  openGraph: {
    title: "Web Design in Ponca City, OK | NunezDev",
    description:
      "Local Ponca City web designer. Custom-built websites that load fast, rank in local search, and turn visitors into customers.",
    url: "https://www.nunezdev.com/web-design-ponca-city",
    siteName: "NunezDev",
    type: "website",
  },
};

export default function WebDesignPoncaCityPage() {
  const localTestimonial = testimonials[0];

  return (
    <main className="flex min-h-screen flex-col items-center text-offwhite overflow-hidden pt-24">
      {/* Page-specific LocalBusiness JSON-LD reinforces the city signal. */}
      <Script
        id="ponca-city-localbusiness"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ProfessionalService",
            name: "NunezDev — Web Design in Ponca City",
            url: "https://www.nunezdev.com/web-design-ponca-city",
            telephone: PHONE_TEL,
            email: EMAIL,
            priceRange: "$$",
            areaServed: [
              { "@type": "City", name: "Ponca City" },
              { "@type": "City", name: "Stillwater" },
              { "@type": "City", name: "Enid" },
              { "@type": "City", name: "Bartlesville" },
              { "@type": "City", name: "Tulsa" },
              { "@type": "City", name: "Oklahoma City" },
              { "@type": "State", name: "Oklahoma" },
            ],
            address: {
              "@type": "PostalAddress",
              addressLocality: ADDRESS.city,
              addressRegion: ADDRESS.region,
              postalCode: ADDRESS.postalCode,
              addressCountry: ADDRESS.country,
            },
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: REVIEW_SUMMARY.rating.toFixed(1),
              bestRating: "5",
              reviewCount: REVIEW_SUMMARY.count,
            },
          }),
        }}
      />

      {/* Hero */}
      <section className="w-full max-w-5xl px-4 sm:px-6 py-16 sm:py-24 text-center">
        <p className="text-yellow/70 text-sm uppercase tracking-[0.2em] font-medium mb-4">
          Web design for {CITY}, {REGION}
        </p>
        <h1 className="text-yellow text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
          A {CITY} web designer
          <br />
          who actually answers the phone.
        </h1>
        <p className="text-white/70 text-base md:text-lg max-w-2xl mx-auto mt-6">
          Custom-built websites for {CITY} small businesses — no templates,
          no agencies, no offshore. You talk to the developer who writes the
          code, and your site is live and ranking in weeks, not months.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 mt-8">
          <a
            href="#quote"
            className="bg-yellow text-gray-900 font-semibold px-8 py-3.5 rounded-lg hover:bg-yellow/80 transition-colors text-base sm:text-lg text-center"
          >
            Get a Free Quote &rarr;
          </a>
          <a
            href={`tel:${PHONE_TEL}`}
            className="text-base sm:text-lg text-white border border-white/40 px-8 py-3.5 rounded-lg font-semibold hover:bg-white hover:text-gray-800 transition-colors text-center"
          >
            Call {PHONE_DISPLAY}
          </a>
        </div>
      </section>

      {/* Local trust block */}
      <section className="w-full max-w-5xl px-4 sm:px-6 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: "Local & accountable",
              body: `I live and work in ${CITY}. If you want to meet for coffee at Head Country to scope your project, we can.`,
            },
            {
              title: "Built for local search",
              body: `Every site I build comes with Google Business optimization, schema markup, and city-specific landing pages so ${CITY} customers can find you.`,
            },
            {
              title: "Flat-rate, no surprises",
              body: "Quotes start at $300 for a simple brochure site. You see the price up front and pay nothing until we agree on scope.",
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

      {/* Local testimonial */}
      {localTestimonial && (
        <section className="w-full max-w-3xl px-4 sm:px-6 py-12">
          <figure className="bg-white/5 backdrop-blur-sm border border-yellow/20 rounded-2xl p-8 text-center">
            <div className="text-yellow text-5xl leading-none font-serif" aria-hidden="true">
              &ldquo;
            </div>
            <blockquote className="text-white/85 text-lg italic leading-relaxed mt-2">
              {localTestimonial.quote}
            </blockquote>
            <figcaption className="text-white/50 text-sm mt-4">
              — {localTestimonial.name}
              {localTestimonial.company ? `, ${localTestimonial.company}` : ""}
            </figcaption>
          </figure>
        </section>
      )}

      {/* Areas served */}
      <section className="w-full max-w-5xl px-4 sm:px-6 py-12">
        <h2 className="text-2xl md:text-3xl font-bold text-yellow text-center mb-3">
          Serving {CITY} and surrounding Oklahoma
        </h2>
        <p className="text-white/60 text-center max-w-2xl mx-auto mb-6">
          Headquartered in {CITY}, working with businesses across north-central
          Oklahoma and the rest of the country.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {[CITY, ...NEARBY].map((city) => (
            <span
              key={city}
              className="bg-white/5 border border-white/15 text-white/70 text-sm px-4 py-1.5 rounded-full"
            >
              {city}, OK
            </span>
          ))}
        </div>
      </section>

      {/* Quote form */}
      <section
        id="quote"
        className="w-full max-w-3xl px-4 sm:px-6 py-16 sm:py-24 scroll-mt-24"
      >
        <h2 className="text-2xl md:text-3xl font-bold text-yellow text-center mb-3">
          Get a free quote for your {CITY} business
        </h2>
        <p className="text-white/60 text-center max-w-xl mx-auto mb-8">
          Share the basics and I'll reply within 24 hours with honest thoughts,
          a rough scope, and a ballpark price. No sales pressure.
        </p>
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 sm:p-8">
          <LeadForm source="web_design_ponca_city" />
        </div>
      </section>

      {/* Bottom NAP */}
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
        <p className="text-white/30 text-xs mt-4">
          Prefer to browse first?{" "}
          <Link href="/portfolio" className="text-yellow/60 hover:text-yellow underline-offset-4 hover:underline">
            See past work
          </Link>{" "}
          ·{" "}
          <Link href="/pricing" className="text-yellow/60 hover:text-yellow underline-offset-4 hover:underline">
            See pricing
          </Link>
        </p>
      </section>
    </main>
  );
}
