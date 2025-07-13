import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "NunezDev | Custom Web & Software Development in Oklahoma",
    template: "%s | NunezDev",
  },
  description:
    "NunezDev builds clean, scalable websites and custom software tools for small businesses and creators. Based in Ponca City, serving nationwide.",
  keywords: [
    "web developer Ponca City",
    "custom website developer Oklahoma",
    "freelance software engineer",
    "small business web design",
    "NunezDev",
    "Next.js developer",
    "full-stack developer Oklahoma",
  ],
  metadataBase: new URL("https://www.nunezdev.com"),
  openGraph: {
    title: "NunezDev | Custom Web & Software Development",
    description:
      "Need a custom website, client portal, or automation tool? NunezDev brings your vision to life with full-stack development built from scratch.",
    url: "https://www.nunezdev.com",
    siteName: "NunezDev",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "NunezDev – Web Development Banner",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  alternates: {
    canonical: "https://www.nunezdev.com",
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Navbar />
        {children}
      </body>
    </html>
  );
}
