"use client";
import Script from "next/script";

export default function StructuredData() {
  return (
    <Script
      id="structured-data"
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://www.nunezdev.com/#organization",
              name: "NunezDev",
              legalName: "NunezDev LLC",
              url: "https://www.nunezdev.com",
              logo: {
                "@type": "ImageObject",
                url: "https://www.nunezdev.com/logo.png",
                width: 400,
                height: 400
              },
              foundingDate: "2024",
              founder: {
                "@type": "Person",
                name: "Reece Nunez"
              },
              contactPoint: [
                {
                  "@type": "ContactPoint",
                  contactType: "Customer Service",
                  telephone: "+1-435-660-6100",
                  email: "reece@nunezdev.com",
                  areaServed: "US",
                  availableLanguage: ["English"]
                }
              ],
              sameAs: [
                "https://www.facebook.com/NunezDevLLC",
                "https://www.instagram.com/nunez-dev",
                "https://github.com/reecenunez",
              ]
            },
            {
              "@type": "WebSite",
              "@id": "https://www.nunezdev.com/#website",
              url: "https://www.nunezdev.com",
              name: "NunezDev",
              description: "Clean, scalable websites and full-stack software for small businesses across Oklahoma and the US.",
              publisher: {
                "@id": "https://www.nunezdev.com/#organization"
              },
              inLanguage: "en-US",
              potentialAction: {
                "@type": "SearchAction",
                target: "https://www.nunezdev.com/search?q={search_term_string}",
                "query-input": "required name=search_term_string"
              }
            },
            {
              "@type": "LocalBusiness",
              "@id": "https://www.nunezdev.com/#local",
              name: "NunezDev",
              image: "https://www.nunezdev.com/logo.png",
              url: "https://www.nunezdev.com",
              telephone: "+1-435-660-6100",
              email: "contact@nunezdev.com",
              priceRange: "$$",
              description: "Custom web design, client portals, CRM tools, and full-stack software development based in Ponca City, OK.",
              address: {
                "@type": "PostalAddress",
                streetAddress: "Ponca City, OK",
                addressLocality: "Ponca City",
                addressRegion: "OK",
                postalCode: "74601",
                addressCountry: "US"
              },
              geo: {
                "@type": "GeoCoordinates",
                latitude: 36.7062,
                longitude: -97.0856
              },
              areaServed: {
                "@type": "Country",
                name: "United States"
              },
              openingHoursSpecification: [
                {
                  "@type": "OpeningHoursSpecification",
                  dayOfWeek: [
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday"
                  ],
                  opens: "09:00",
                  closes: "17:00"
                }
              ],
              makesOffer: [
                {
                  "@type": "Offer",
                  itemOffered: {
                    "@type": "Service",
                    name: "Custom Website Development",
                    description: "Clean, responsive websites built from scratch using Next.js, Tailwind CSS, and modern web stacks."
                  }
                },
                {
                  "@type": "Offer",
                  itemOffered: {
                    "@type": "Service",
                    name: "Client Portal & CRM Systems",
                    description: "Fully custom client dashboards, lead tracking, and CRM tools built on React and Node.js."
                  }
                },
                {
                  "@type": "Offer",
                  itemOffered: {
                    "@type": "Service",
                    name: "Software Automation & APIs",
                    description: "Automate your business workflows with custom tools, database integrations, and cloud APIs."
                  }
                }
              ]
            }
          ]
        })
      }}
    />
  );
}
