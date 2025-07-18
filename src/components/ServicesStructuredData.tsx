"use client";
import Script from "next/script";

export default function ServicesStructuredData() {
    return (
        <Script
            id="services-structured-data"
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                    "@context": "https://schema.org",
                    "@type": "Service",
                    "name": "Web & Software Development Services",
                    "serviceType": "Full-Stack Web Development",
                    "provider": {
                        "@type": "Organization",
                        "name": "NunezDev",
                        "url": "https://www.nunezdev.com",
                        "logo": "https://www.nunezdev.com/logo.png"
                    },
                    "areaServed": {
                        "@type": "Country",
                        "name": "United States"
                    },
                    "availableChannel": {
                        "@type": "ServiceChannel",
                        "serviceUrl": "https://www.nunezdev.com/contact",
                        "availableLanguage": ["English"]
                    },
                    "description": "Custom websites, CRM systems, and client portals for small businesses. Built with modern technologies like Next.js, Tailwind CSS, and Prisma.",
                    "url": "https://www.nunezdev.com/services"
                })
            }}
        />
    );
}