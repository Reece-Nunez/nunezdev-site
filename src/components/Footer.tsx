"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, Variants } from "framer-motion";
import { FaFacebookF, FaInstagram, FaGithub, FaLinkedin } from "react-icons/fa";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" as const },
  },
};

const navLinks = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact", href: "/contact" },
];

const serviceLinks = [
  { label: "Custom Websites", href: "/services/custom-websites" },
  { label: "Web Applications", href: "/services/web-applications" },
  { label: "Dashboards & Portals", href: "/services/dashboards-portals" },
  { label: "Automation", href: "/services/automation-integration" },
  { label: "API Development", href: "/services/api-development" },
  { label: "SEO Optimization", href: "/services/seo-optimization" },
];

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

  return (
    <footer className="relative w-full bg-gray-950 text-white overflow-hidden">
      {/* Top accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-yellow/40 to-transparent" />

      {/* Main footer content */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.1 } },
        }}
        className="max-w-7xl mx-auto px-6 pt-16 pb-12"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          {/* Brand column */}
          <motion.div variants={fadeInUp} className="lg:col-span-1">
            <button
              onClick={scrollToTop}
              className="flex items-center gap-2 mb-4 group"
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
            <p className="text-white/50 text-sm leading-relaxed mb-6 max-w-xs">
              Purpose-built websites, apps, and tools that help businesses run
              better — custom-coded from scratch.
            </p>
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-yellow hover:border-yellow/40 hover:bg-yellow/10 transition-all duration-300"
                >
                  <social.icon className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          </motion.div>

          {/* Navigation column */}
          <motion.div variants={fadeInUp}>
            <h4 className="text-yellow text-sm font-semibold uppercase tracking-wider mb-5">
              Navigation
            </h4>
            <ul className="space-y-3">
              {navLinks.map((link) => (
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
          </motion.div>

          {/* Services column */}
          <motion.div variants={fadeInUp}>
            <h4 className="text-yellow text-sm font-semibold uppercase tracking-wider mb-5">
              Services
            </h4>
            <ul className="space-y-3">
              {serviceLinks.map((link) => (
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
          </motion.div>

          {/* Contact column */}
          <motion.div variants={fadeInUp}>
            <h4 className="text-yellow text-sm font-semibold uppercase tracking-wider mb-5">
              Get In Touch
            </h4>
            <div className="space-y-4">
              <div>
                <p className="text-white/30 text-xs uppercase tracking-wider mb-1">
                  Location
                </p>
                <p className="text-white/60 text-sm">Ponca City, Oklahoma</p>
              </div>
              <div>
                <p className="text-white/30 text-xs uppercase tracking-wider mb-1">
                  Email
                </p>
                <a
                  href="mailto:reece@nunezdev.com"
                  className="text-white/60 text-sm hover:text-yellow transition-colors duration-200"
                >
                  reece@nunezdev.com
                </a>
              </div>
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="pt-2"
              >
                <Link
                  href="/contact"
                  className="inline-block bg-yellow text-gray-900 font-semibold text-sm px-5 py-2.5 rounded-lg hover:shadow-[0_0_20px_rgba(255,195,18,0.3)] transition-shadow duration-300"
                >
                  Start a Project
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Bottom bar */}
      <div className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-xs">
            &copy; {new Date().getFullYear()} NunezDev LLC. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link
              href="/privacy-policy"
              className="text-white/30 text-xs hover:text-white/60 transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms-of-service"
              className="text-white/30 text-xs hover:text-white/60 transition-colors"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
