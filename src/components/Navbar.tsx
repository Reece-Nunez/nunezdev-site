"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Pricing", href: "/pricing" },
  { label: "Services", href: "/services" },
  { label: "Contact", href: "/contact" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-blue/30 backdrop-blur-sm px-4 py-4 flex justify-between items-center border-b border-offwhite/10">
      {/* Left: Logo */}
      <Link href="/" className="flex items-center gap-2">
        <Image
          src="/logo.svg"
          alt="NunezDev Logo"
          width={0}
          height={0}
          sizes="(max-width: 768px) 120px, 200px"
          style={{ width: "auto", height: "70px" }}
          priority
        />
      </Link>

      {/* Desktop Nav */}
      <div className="hidden md:flex gap-6 text-offwhite text-2xl">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`hover:text-brand-yellow transition ${
              pathname === item.href
                ? "text-yellow underline underline-offset-4"
                : "text-gray-400"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* CTA Button */}
      <div className="hidden md:block">
        <Link
          href="/contact"
          className="text-lg text-offwhite border border-offwhite px-6 py-3 rounded-md font-semibold hover:bg-offwhite hover:text-blue transition"
        >
          Let&#39;s get building
        </Link>
      </div>

      {/* Hamburger Button */}
      <button
        className="md:hidden flex flex-col justify-center items-center w-10 h-10 z-[60]"
        onClick={toggleMenu}
        aria-label="Toggle Menu"
      >
        <motion.span
          animate={{
            rotate: isOpen ? 45 : 0,
            y: isOpen ? 5 : 0,
          }}
          className="w-6 h-0.5 bg-yellow mb-1"
          transition={{ duration: 0.3 }}
        />
        <motion.span
          animate={{
            opacity: isOpen ? 0 : 1,
          }}
          className="w-6 h-0.5 bg-yellow mb-1"
          transition={{ duration: 0.3 }}
        />
        <motion.span
          animate={{
            rotate: isOpen ? -45 : 0,
            y: isOpen ? -8 : 0,
          }}
          className="w-6 h-0.5 bg-yellow"
          transition={{ duration: 0.3 }}
        />
      </button>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="absolute top-full left-0 w-full bg-blue backdrop-blur-md border-t border-offwhite/10 flex flex-col items-center gap-6 py-6 md:hidden text-yellow font-semibold text-xl z-40"
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`hover:text-white transition ${
                  pathname === item.href ? "underline underline-offset-4" : ""
                }`}
              >
                {item.label}
              </Link>
            ))}

            <Link
              href="/contact"
              onClick={() => setIsOpen(false)}
              className="text-lg border border-yellow px-6 py-3 rounded-md hover:bg-yellow hover:text-blue transition"
            >
              Let’s get building
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
