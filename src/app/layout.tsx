import type { Metadata } from "next";
import { Geist, Geist_Mono, Montserrat, Roboto } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import StructuredData from "@/components/StructuredData";
import Script from "next/script";
import Footer from "@/components/Footer";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const roboto = Roboto ({
  variable: "--font-roboto",
  subsets: ["latin"],
});

const montserrat = Montserrat ({
  variable: "--font-montserrat",
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
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
    other: [
      {
        rel: "manifest",
        url: "/site.webmanifest",
      },
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
  verification: {
    google: "YOUR-GOOGLE-SITE-VERIFICATION-CODE",
    other: {
      bing: "YOUR-BING-VERIFICATION-CODE",
    },
  },
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
        className={`${roboto.variable} ${montserrat.variable} ${geistSans.variable} ${geistMono.variable} antialiased bg-white text-gray-900`}
      >
        <Navbar />
        <Providers>{children}</Providers>
        <Footer />
      </body>
    </html>
  );
}
