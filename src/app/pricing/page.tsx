import PricingStructuredData from '@/components/PricingStructuredData';
import PricingClient from './PricingClient';

export const metadata = {
  title: "Transparent Web & Software Pricing | NunezDev",
  description:
    "Explore clear pricing for custom websites, CRM dashboards, client portals, and web applications. Find the right package for your business—from $300 starter sites to $20k+ enterprise builds.",
  keywords: [
    "web development pricing",
    "custom website cost",
    "CRM pricing for small business",
    "client portal development",
    "web app pricing",
    "freelance developer rates",
    "Oklahoma web developer pricing",
    "NunezDev pricing plans"
  ],
  alternates: {
    canonical: "https://www.nunezdev.com/pricing",
  },
  openGraph: {
    title: "Transparent Web & Software Pricing | NunezDev",
    description:
      "From small business websites to custom enterprise platforms—see our full pricing tiers and what each plan includes.",
    url: "https://www.nunezdev.com/pricing",
    siteName: "NunezDev",
    type: "website",
    images: [
      {
        url: "https://www.nunezdev.com/logo.png",
        width: 1200,
        height: 630,
        alt: "NunezDev pricing banner",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Website & Software Pricing | NunezDev",
    description:
      "Starter sites from $300. CRMs, portals, and custom platforms up to $20k+. View our transparent pricing breakdown.",
    images: ["https://www.nunezdev.com/logo.png"],
  },
};


export default function PricingPage() {
  return (
    <>
      <PricingStructuredData />
      <PricingClient />
    </>
  );
}
