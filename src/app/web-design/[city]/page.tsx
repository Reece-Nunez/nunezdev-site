import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";
import LeadForm from "@/components/LeadForm";
import { testimonials } from "@/data/testimonials";
import { ADDRESS, EMAIL, PHONE_DISPLAY, PHONE_TEL, REVIEW_SUMMARY } from "@/lib/contact";
import { REGION, getServiceCity, serviceCities } from "@/data/serviceCities";

const BASE_URL = "https://www.nunezdev.com";

// Pre-render every city page at build time.
export function generateStaticParams() {
  return serviceCities.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city: slug } = await params;
  const entry = getServiceCity(slug);
  if (!entry) return {};
  const { city } = entry;
  const url = `${BASE_URL}/web-design/${slug}`;
  const description = `Custom web design and development for ${city}, OK small businesses. Hand-coded sites that load fast, rank locally, and turn visitors into leads. Local Oklahoma web developer.`;
  return {
    title: `Web Design in ${city}, OK | NunezDev`,
    description,
    keywords: [
      `web design ${city}`,
      `web design ${city} OK`,
      `${city} web developer`,
      `${city} website design`,
      `small business website ${city}`,
      "Oklahoma web designer",
    ],
    alternates: { canonical: url },
    openGraph: {
      title: `Web Design in ${city}, OK | NunezDev`,
      description,
      url,
      siteName: "NunezDev",
      type: "website",
    },
  };
}

export default async function WebDesignCityPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: slug } = await params;
  const entry = getServiceCity(slug);
  if (!entry) notFound();

  const { city, nearby } = entry;
  const localTestimonial = testimonials[0];
  const leadSource = `web_design_${slug.replace(/-/g, "_")}`;

  return (
    <main className="flex min-h-screen flex-col items-center text-offwhite overflow-hidden pt-24">
      <Script
        id={`localbusiness-${slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ProfessionalService",
            name: `NunezDev — Web Design in ${city}`,
            url: `${BASE_URL}/web-design/${slug}`,
            telephone: PHONE_TEL,
            email: EMAIL,
            priceRange: "$$",
            areaServed: [
              { "@type": "City", name: city },
              ...nearby.map((n) => ({ "@type": "City", name: n })),
              { "@type": "State", name: REGION },
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
          Web design for {city}, {REGION}
        </p>
        <h1 className="text-yellow text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
          A {city} web designer
          <br />
          who actually answers the phone.
        </h1>
        <p className="text-white/70 text-base md:text-lg max-w-2xl mx-auto mt-6">
          Custom-built websites for {city} small businesses. No templates, no
          agencies, no offshore. You talk to the developer who writes the code,
          and your site is live and ranking in weeks, not months.
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
              body: `Based in Oklahoma and working with ${city} businesses directly. You get one person who owns your project start to finish, not a ticket queue.`,
            },
            {
              title: "Built for local search",
              body: `Every site comes with Google Business optimization, schema markup, and city-specific pages so ${city} customers can actually find you.`,
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
          Serving {city} and surrounding {REGION}
        </h2>
        <p className="text-white/60 text-center max-w-2xl mx-auto mb-6">
          Working with businesses in {city} and the nearby communities, plus
          clients across the rest of the country.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {[city, ...nearby].map((name) => (
            <span
              key={name}
              className="bg-white/5 border border-white/15 text-white/70 text-sm px-4 py-1.5 rounded-full"
            >
              {name}, OK
            </span>
          ))}
        </div>
      </section>

      {/* Quote form */}
      <section id="quote" className="w-full max-w-3xl px-4 sm:px-6 py-16 sm:py-24 scroll-mt-24">
        <h2 className="text-2xl md:text-3xl font-bold text-yellow text-center mb-3">
          Get a free quote for your {city} business
        </h2>
        <p className="text-white/60 text-center max-w-xl mx-auto mb-8">
          Share the basics and I&apos;ll reply within 24 hours with honest
          thoughts, a rough scope, and a ballpark price. No sales pressure.
        </p>
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 sm:p-8">
          <LeadForm source={leadSource} />
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
