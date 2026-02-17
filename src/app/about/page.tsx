
import AboutStructuredData from "@/components/AboutStructuredData";
import AboutClient from "./AboutClient";

export const metadata = {
  title: "About Reece Nunez | Founder of NunezDev",
  description:
    "Get to know Reece Nunez — a full-stack developer, husband, father of four, and founder of NunezDev. Learn how his journey, values, and passion for building software help small businesses thrive.",
  keywords: [
    "about Reece Nunez",
    "NunezDev founder",
    "Ponca City developer",
    "Christian developer Oklahoma",
    "small business software developer",
    "custom website builder Oklahoma",
    "homesteader web developer",
    "freelance full-stack developer"
  ],
  alternates: {
    canonical: "https://www.nunezdev.com/about",
  },
  openGraph: {
    title: "About Reece Nunez | Full-Stack Developer & Founder of NunezDev",
    description:
      "Meet Reece — full-stack problem solver, family man, and founder of NunezDev. Discover the story and values behind the custom software helping businesses succeed.",
    url: "https://www.nunezdev.com/about",
    siteName: "NunezDev",
    type: "profile",
    images: [
      {
        url: "https://www.nunezdev.com/reece-avatar.png",
        width: 1200,
        height: 630,
        alt: "Reece Nunez — Founder of NunezDev",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "About Reece Nunez | Founder of NunezDev",
    description:
      "Learn more about Reece — a developer, homesteader, and family-first founder helping businesses grow through custom software.",
    images: ["https://www.nunezdev.com/reece-avatar.png"],
  },
};


export default function AboutPage() {
  return (
    <>
    <AboutStructuredData />
    <AboutClient />
    </>
  );
}
