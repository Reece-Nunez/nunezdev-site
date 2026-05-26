"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { FaFacebookF, FaInstagram, FaGithub, FaLinkedin } from "react-icons/fa";

const socialLinks = [
  {
    icon: FaGithub,
    href: "https://github.com/reece-nunez",
    label: "GitHub",
  },
  {
    icon: FaLinkedin,
    href: "https://linkedin.com/in/reecenunez",
    label: "LinkedIn",
  },
  {
    icon: FaFacebookF,
    href: "https://facebook.com/NunezDevLLC",
    label: "Facebook",
  },
  {
    icon: FaInstagram,
    href: "https://instagram.com/nunez_dev",
    label: "Instagram",
  },
];

export default function Footer() {
  const pathname = usePathname();

  if (
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/invoice/") ||
    pathname?.startsWith("/invoices/")
  ) {
    return null;
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Compact "essentials only" list — single column of the things visitors
  // actually use, no padded duplicates of the main nav.
  const essentialLinks = [
    { label: "Services", href: "/services" },
    { label: "Portfolio", href: "/portfolio" },
    { label: "Pricing", href: "/pricing" },
    { label: "Contact", href: "/contact" },
    { label: "Privacy", href: "/privacy-policy" },
    { label: "Terms", href: "/terms-of-service" },
  ];

  return (
    <footer className="relative w-full bg-gray-950 text-white overflow-hidden">
      {/* Top accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-yellow/40 to-transparent" />

      <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-14 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-10 md:gap-16 items-start">
          {/* Left — Letter close: brand, single line of intent, primary contact */}
          <div>
            <button
              onClick={scrollToTop}
              className="flex items-center gap-2 mb-5 group"
            >
              <Image
                src="/n-logo.svg"
                alt="NunezDev Logo"
                width={40}
                height={40}
                className="group-hover:scale-110 transition-transform duration-300"
              />
              <div className="flex flex-col leading-none">
                <span className="text-yellow font-bold text-base tracking-tight">
                  NUNEZDEV
                </span>
                <span className="text-yellow/50 text-[8px] uppercase tracking-[0.2em]">
                  Software Solutions
                </span>
              </div>
            </button>

            <p className="text-white/60 text-base leading-relaxed mb-5 max-w-md">
              Purpose-built websites, apps, and tools that help small
              businesses run better. Built one-on-one from Ponca City,
              Oklahoma.
            </p>

            <a
              href="mailto:reece@nunezdev.com"
              className="inline-block text-yellow text-base font-medium hover:text-yellow/80 transition-colors"
            >
              reece@nunezdev.com &rarr;
            </a>

            <div className="flex gap-3 mt-6">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-yellow hover:border-yellow/40 hover:bg-yellow/10 transition-colors"
                >
                  <social.icon className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Right — Essentials only, single flat list */}
          <ul className="grid grid-cols-2 gap-x-6 gap-y-3 md:justify-self-end">
            {essentialLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-white/50 text-sm hover:text-yellow transition-colors duration-200"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom line — copyright only, no link row repeating the list above */}
        <div className="border-t border-white/5 mt-12 pt-6">
          <p className="text-white/30 text-xs">
            &copy; {new Date().getFullYear()} NunezDev LLC. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
