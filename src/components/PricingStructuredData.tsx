"use client";
import Script from "next/script";

export default function PricingStructuredData() {
    return (
        <Script
            id="pricing-structured-data"
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                    "@context": "https://schema.org",
                    "@type": "WebPage",
                    "name": "Pricing | NunezDev",
                    "url": "https://www.nunezdev.com/pricing",
                    "description": "Explore pricing for websites, CRMs, and full-stack web applications. Clear packages from $300 to $20,000+ tailored to small businesses.",
                    "breadcrumb": {
                        "@type": "BreadcrumbList",
                        "itemListElement": [
                            {
                                "@type": "ListItem",
                                "position": 1,
                                "name": "Home",
                                "item": "https://www.nunezdev.com"
                            },
                            {
                                "@type": "ListItem",
                                "position": 2,
                                "name": "Pricing",
                                "item": "https://www.nunezdev.com/pricing"
                            }
                        ]
                    }
                })
            }}
        />
    );
}