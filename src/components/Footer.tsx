'use client';

import Link from "next/link";
import Image from "next/image";
import { FaFacebookF, FaInstagram, FaGithub, FaLinkedin } from "react-icons/fa";

export default function Footer() {

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="w-full px-6 pt-12 pb-4 bg-black/40 text-offwhite">
      {/* Divider */}
      <div className="w-24 h-1 mx-auto bg-gradient-to-r from-yellow via-white to-yellow rounded-full mb-8 animate-pulse" />

      {/* Main Footer Content */}
      <div className="w-full grid md:grid-cols-3 gap-12 text-center md:text-left">
        {/* Logo */}
        <div className="space-y-4">
          <button
            onClick={scrollToTop}
          >
            <Image
              src="/n-logo.svg"
              alt="NunezDev Logo"
              width={80}
              height={80}
              className="w-20 h-20 mb-2"
              priority
            />
          </button>
          <p className="text-sm text-gray-400 max-w-xs">
            Purpose-built websites, apps, and tools that help businesses run better — built from scratch by Reece Nunez.
          </p>
        </div>

        {/* Quick Links */}
        <div className="space-y-2 text-center">
          <h4 className="text-yellow text-lg font-semibold mb-4">Explore</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/about" className="hover:text-yellow transition">
                About Me
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="hover:text-yellow transition">
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/portfolio" className="hover:text-yellow transition">
                Projects
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-yellow transition">
                Contact
              </Link>
            </li>
          </ul>
        </div>

        {/* Contact & Social */}
        {/* Contact & Social */}
        <div className="space-y-4 text-center md:text-right">
          <h4 className="text-yellow text-lg font-semibold mb-4">Get In Touch</h4>
          <p className="text-sm text-gray-400">Ponca City, Oklahoma</p>
          <p className="text-sm text-gray-400">reece@nunezdev.com</p>
          <div className="flex justify-center md:justify-end space-x-4 pt-2">
            <a
              href="https://facebook.com/NunezDevLLC"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-yellow transition"
            >
              <FaFacebookF className="w-5 h-5" />
            </a>
            <a
              href="https://instagram.com/nunez_dev"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-yellow transition"
            >
              <FaInstagram className="w-5 h-5" />
            </a>
            <a
              href="https://github.com/reece-nunez"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-yellow transition"
            >
              <FaGithub className="w-5 h-5" />
            </a>
            <a
              href="https://linkedin.com/in/reecenunez"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-yellow transition"
            >
              <FaLinkedin className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="mt-2 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} NunezDev. All rights reserved.
      </div>
    </footer>
  );
}
