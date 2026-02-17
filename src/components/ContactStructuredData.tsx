"use client";
import Script from "next/script";

export default function ContactStructuredData() {
    return (
        <Script
            id="contact-structured-data"
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                    "@context": "https://schema.org",
                    "@type": "ContactPage",
                    "name": "Contact NunezDev",
                    "url": "https://www.nunezdev.com/contact",
                    "mainEntity": {
                        "@type": "Organization",
                        "name": "NunezDev",
                        "url": "https://www.nunezdev.com",
                        "contactPoint": {
                            "@type": "ContactPoint",
                            "contactType": "Customer Service",
                            "email": "contact@nunezdev.com",
                            "telephone": "+1-580-555-1234",
                            "areaServed": "US",
                            "availableLanguage": ["English"]
                        }
                    },
                    "description": "Get in touch with NunezDev to schedule a discovery call for your next web or software project."
                })
            }}
        />
    );
}