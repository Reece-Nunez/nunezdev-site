import type { Metadata, Viewport } from "next";

// Site-verification meta tags. Only render a tag when the env var is set —
// otherwise we'd ship a literal placeholder string to Google/Bing.
// Set these in .env.local (or your host) — see .env.example for details.
const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
const bingVerification = process.env.NEXT_PUBLIC_BING_VERIFICATION;

const verification: Metadata["verification"] = {};
if (googleSiteVerification) verification.google = googleSiteVerification;
if (bingVerification) verification.other = { bing: bingVerification };
const hasVerification = Boolean(googleSiteVerification || bingVerification);
import { Geist, Geist_Mono, Space_Grotesk, Lora } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import StructuredData from "@/components/StructuredData";
import Script from "next/script";
import Footer from "@/components/Footer";
import Providers from "./providers";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "NunezDev | Custom Web & Software Development in Oklahoma",
    template: "%s | NunezDev",
  },
  description:
    "NunezDev builds clean, scalable websites and full-stack software for small businesses and creators. Based in Ponca City, serving clients nationwide.",
  metadataBase: new URL("https://www.nunezdev.com"),
  keywords: [
    "web developer Ponca City",
    "custom website developer Oklahoma",
    "Next.js software engineer",
    "freelance full-stack developer",
    "NunezDev",
    "business automation tools",
    "custom CRM software",
  ],
  alternates: {
    canonical: "https://www.nunezdev.com",
    languages: {
      "en-US": "https://www.nunezdev.com",
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.nunezdev.com",
    siteName: "NunezDev",
    title: "NunezDev | Custom Web & Software Development",
    description:
      "Custom websites, client portals, and automation tools built from scratch for businesses in Oklahoma and beyond.",
    images: [
      {
        url: "https://www.nunezdev.com/logo.png",
        width: 1200,
        height: 630,
        alt: "NunezDev – Full Stack Web Development Banner",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@NunezDev",
    title: "NunezDev | Custom Web & Software Development",
    description:
      "From websites to CRMs, NunezDev builds powerful tools for business growth. Based in Ponca City, serving clients nationwide.",
    images: ["https://www.nunezdev.com/logo.png"],
  },
  manifest: "/site.webmanifest",
  applicationName: "NunezDev",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NunezDev",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  ...(hasVerification ? { verification } : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b2a4a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-US" dir="ltr">
      <head>
        <StructuredData />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-M090T4S8LM"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-M090T4S8LM');
    `}
        </Script>
      </head>
      <body
        className={`${spaceGrotesk.variable} ${lora.variable} ${geistSans.variable} ${geistMono.variable} antialiased bg-white text-gray-900`}
      >
        <Navbar />
        <Providers>{children}</Providers>
        <Footer />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
