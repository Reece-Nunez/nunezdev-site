import ContactStructuredData from "@/components/ContactStructuredData";
import ContactClient from "./ContactClient";

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

export default function ContactPage() {
  return (
    <>
      <ContactStructuredData />
      <ContactClient />
    </>
  );
}
