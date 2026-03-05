import { Metadata } from "next";
import PortfolioClient from "./PortfolioClient";

export const metadata: Metadata = {
  title: "Portfolio | Custom Web Development Projects",
  description:
    "Browse 15+ custom web development projects by NunezDev — from travel platforms to financial apps, scheduling systems, and more.",
  keywords: [
    "web development portfolio",
    "custom website examples",
    "Next.js projects",
    "NunezDev portfolio",
    "freelance developer projects",
  ],
  alternates: {
    canonical: "https://www.nunezdev.com/portfolio",
  },
  openGraph: {
    title: "Portfolio | NunezDev Custom Web Development Projects",
    description:
      "See the custom websites, web apps, and software solutions built by NunezDev for businesses across the country.",
    url: "https://www.nunezdev.com/portfolio",
    siteName: "NunezDev",
    type: "website",
    images: [
      {
        url: "https://www.nunezdev.com/logo.png",
        width: 1200,
        height: 630,
        alt: "NunezDev Portfolio",
      },
    ],
  },
};

export default function PortfolioPage() {
  return <PortfolioClient />;
}
