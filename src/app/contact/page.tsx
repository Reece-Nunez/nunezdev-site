
"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import ContactStructuredData from "@/components/ContactStructuredData";

export const metadata = {
  title: "Contact NunezDev | Book a Free Consultation",
  description:
    "Have a website or software idea? Schedule a free discovery call with NunezDev to bring your project to life. Get expert advice, clear timelines, and honest pricing.",
  keywords: [
    "contact NunezDev",
    "book a developer call",
    "free consultation website",
    "custom software consultation",
    "Ponca City web developer contact",
    "talk to a developer Oklahoma",
    "schedule web project call",
    "website consultation form"
  ],
  alternates: {
    canonical: "https://www.nunezdev.com/contact",
  },
  openGraph: {
    title: "Contact NunezDev | Book a Free Consultation",
    description:
      "Ready to build your website or app? Reach out for a no-pressure discovery call and let’s talk through your goals.",
    url: "https://www.nunezdev.com/contact",
    siteName: "NunezDev",
    type: "website",
    images: [
      {
        url: "https://www.nunezdev.com/logo.png",
        width: 1200,
        height: 630,
        alt: "Contact NunezDev – Let's Build Something Together",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact NunezDev | Free Discovery Call",
    description:
      "Let’s build something custom. Book a free call to discuss your project and how NunezDev can help.",
    images: ["https://www.nunezdev.com/logo.png"],
  },
};



const CalendlyEmbed = dynamic(() => import("../../components/CalendlyEmbed"), {
  ssr: false,
});

export default function ContactPage() {
  return (
    <>
      <ContactStructuredData />
    <main className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-offwhite px-6 py-24 flex items-center justify-center">
      <motion.div
        className="w-full max-w-7xl bg-gray-900 p-10 rounded-2xl shadow-xl border border-offwhite/10 my-12"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
      >
        <h1 className="text-center text-3xl md:text-5xl font-bold mb-8 text-[#ffc312]">
          Schedule a Discovery Call
        </h1>
        <CalendlyEmbed onScheduled={() => { /* handle scheduled event here */ }} />
      </motion.div>
    </main>
    </>
  );
}
