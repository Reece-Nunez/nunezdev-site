"use client";
import Script from "next/script";

export default function AboutStructuredData() {
    return (
        <Script
            id="about-structured-data"
            type="application/ld+json"
            dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                    "@context": "https://schema.org",
                    "@type": "Person",
                    "name": "Reece Nunez",
                    "alternateName": "NunezDev",
                    "url": "https://www.nunezdev.com/about",
                    "image": "https://www.nunezdev.com/reece-avatar.png",
                    "jobTitle": "Full-Stack Software Developer",
                    "worksFor": {
                        "@type": "Organization",
                        "name": "NunezDev",
                        "url": "https://www.nunezdev.com"
                    },
                    "sameAs": [
                        "https://www.facebook.com/NunezDev",
                        "https://www.instagram.com/NunezDev"
                    ],
                    "description": "Founder of NunezDev, Reece is a full-stack software engineer, family man, and homesteader building custom business tools from scratch."
                })
            }}
        />
    );
}