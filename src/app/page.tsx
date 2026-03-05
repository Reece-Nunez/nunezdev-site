import { Metadata } from "next";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  title: "NunezDev | Custom Web & Software Development in Oklahoma",
  description:
    "NunezDev builds custom websites, web apps, dashboards, and automation tools for small businesses. Based in Ponca City, OK — serving clients nationwide.",
  alternates: {
    canonical: "https://www.nunezdev.com",
  },
  openGraph: {
    title: "NunezDev | Custom Web & Software Development",
    description:
      "Custom websites, client portals, and automation tools built from scratch for businesses in Oklahoma and beyond.",
    url: "https://www.nunezdev.com",
    siteName: "NunezDev",
    type: "website",
    images: [
      {
        url: "https://www.nunezdev.com/logo.png",
        width: 1200,
        height: 630,
        alt: "NunezDev - Full Stack Web Development",
      },
    ],
  },
};

export default function HomePage() {
  return <HomeClient />;
}
