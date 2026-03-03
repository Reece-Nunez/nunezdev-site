import ServicesStructuredData from '@/components/ServicesStructuredData';
import ServicesClient from './ServicesClient';

export const metadata = {
    title: "Custom Web & Software Development Services | NunezDev",
    description:
        "Custom full-stack web development services — websites, web apps, dashboards, APIs, automation, and ongoing support. Hand-coded, no templates.",
    keywords: [
        "full-stack web development services",
        "custom website development",
        "web application developer",
        "API development services",
        "dashboard development",
        "client portal software",
        "Next.js developer services",
        "NunezDev services"
    ],
    alternates: {
        canonical: "https://www.nunezdev.com/services",
    },
    openGraph: {
        title: "Custom Web & Software Development Services | NunezDev",
        description:
            "Explore our full-stack development services—from mobile-ready websites to client dashboards, automation tools, and custom CRM platforms.",
        url: "https://www.nunezdev.com/services",
        siteName: "NunezDev",
        type: "website",
        images: [
            {
                url: "https://www.nunezdev.com/logo.png",
                width: 1200,
                height: 630,
                alt: "NunezDev Services Banner",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Web & Software Development Services | NunezDev",
        description:
            "Need a website, client portal, or business automation? NunezDev offers custom-built tools tailored for your business.",
        images: ["https://www.nunezdev.com/logo.png"],
    },
};




export default function ServicesPage() {
    return (
        <>
            <ServicesStructuredData />
            <ServicesClient />
        </>
    );
}
