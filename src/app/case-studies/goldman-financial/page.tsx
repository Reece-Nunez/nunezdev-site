"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import ThreeBackground from "@/components/ThreeBackground";

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8 },
  },
};

export default function GoldmanFinancialCaseStudy() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start px-4 pt-32 text-left text-offwhite overflow-hidden">
      <ThreeBackground />

      {/* Hero Section */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        variants={fadeInUp}
        className="space-y-6 mb-16 max-w-4xl text-center"
      >
        <h1 className="text-yellow text-3xl md:text-5xl font-bold leading-tight">
          Goldman Financial: A Modern Financial Services Platform
        </h1>
        <p className="max-w-3xl text-white mx-auto text-lg md:text-xl">
          A digital-first platform that replaced paper applications with online forms, e-signatures, automated PDF generation, and an interactive branch locator — modernizing every step of the customer journey.
        </p>
        <a
          href="https://thegoldmanfund.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-yellow/70 hover:text-yellow transition text-base"
        >
          thegoldmanfund.com →
        </a>
      </motion.div>

      {/* Main Content */}
      <div className="relative w-full max-w-4xl px-6 z-10 space-y-12">

        {/* The Challenge */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-8 md:p-12 shadow-xl"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            The Challenge: A Paper-Heavy Process in a Digital World
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6">
            Goldman Financial was running on an outdated application process that relied heavily on paper forms, in-person visits, and manual document handling. Customers had to print, fill out, sign, and physically deliver applications — a slow and frustrating experience that didn't match the speed modern consumers expect.
          </p>
          <p className="text-white text-lg leading-relaxed mb-6">
            The business needed a complete digital transformation that could:
          </p>
          <ul className="space-y-3 text-white text-lg">
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Replace paper applications with secure online forms</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Enable legally binding digital signatures without in-person visits</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Automatically generate professional PDF documents from form submissions</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Help customers find the nearest branch location quickly and easily</span>
            </li>
          </ul>
          <p className="text-white text-lg leading-relaxed mt-6">
            They weren't just looking for a website — they needed a platform that could digitize their entire application workflow from start to finish.
          </p>
        </motion.section>

        {/* Solution Overview */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-8 md:p-12 shadow-xl"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            The Solution: A Full Digital Platform
          </h2>
          <p className="text-white text-lg leading-relaxed mb-8">
            I designed and built a comprehensive digital platform that replaced Goldman Financial's entire paper-based workflow. The new system allows customers to complete applications online, sign documents digitally, and receive professionally generated PDFs — all without stepping foot in a branch. An integrated Google Maps branch locator ensures that when in-person visits are needed, customers can find the nearest location instantly.
          </p>
          <p className="text-white text-lg leading-relaxed">
            The platform also includes robust error monitoring through Sentry, ensuring that any issues are caught and resolved before they impact the customer experience. Spam protection via reCAPTCHA v3 keeps the application forms secure without adding friction for legitimate users.
          </p>
        </motion.section>

        {/* Key Features */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-8 md:p-12 shadow-xl"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            Key Features Delivered
          </h2>

          <div className="space-y-6">
            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Digital Application Forms</h3>
              <p className="text-white leading-relaxed">Comprehensive online forms that guide customers through the application process step by step, with validation and clear error messaging to ensure accurate submissions every time.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">E-Signature Capture</h3>
              <p className="text-white leading-relaxed">Built-in digital signature functionality using react-signature-canvas, allowing customers to sign applications directly on their device — no printing, scanning, or mailing required.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Automated PDF Document Generation</h3>
              <p className="text-white leading-relaxed">Completed applications are automatically compiled into professional PDF documents using jsPDF and pdf-lib, ready for processing, archiving, or sending to the customer.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Google Maps Branch Locator</h3>
              <p className="text-white leading-relaxed">An interactive map integration powered by Google Maps API that helps customers find the nearest branch, complete with directions and contact information.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Error Monitoring with Sentry</h3>
              <p className="text-white leading-relaxed">Real-time error tracking and performance monitoring ensures issues are detected and resolved proactively, maintaining a reliable experience for every user.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Spam Protection with reCAPTCHA v3</h3>
              <p className="text-white leading-relaxed">Invisible reCAPTCHA integration protects application forms from bots and spam submissions without adding any friction to the legitimate user experience.</p>
            </div>
          </div>
        </motion.section>

        {/* Technology Stack */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-8 md:p-12 shadow-xl"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            Technology Behind the Scenes
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6">
            The Goldman Financial platform is built on a modern, production-grade stack designed for reliability and performance in the financial services space:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Next.js 16 + React 19</span>
                <span className="text-gray-300">for speed and SEO</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Google Maps API</span>
                <span className="text-gray-300">for branch location finder</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">jsPDF + pdf-lib</span>
                <span className="text-gray-300">for PDF generation</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">react-signature-canvas</span>
                <span className="text-gray-300">for e-signatures</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">reCAPTCHA v3</span>
                <span className="text-gray-300">for spam protection</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Sentry</span>
                <span className="text-gray-300">for error monitoring</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Resend</span>
                <span className="text-gray-300">for email notifications</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Tailwind CSS 4 + Framer Motion</span>
                <span className="text-gray-300">for modern UI</span>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            This stack delivers the reliability and security that financial services demand, while keeping the user experience fast and modern.
          </p>
        </motion.section>

        {/* Business Impact */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-8 md:p-12 shadow-xl"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            Business Impact: Results That Matter
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6">
            The digital platform completely transformed Goldman Financial's operations:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Paper applications eliminated</span>
                  <p className="text-gray-300">100% digital application process from start to finish</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Faster application processing</span>
                  <p className="text-gray-300">what took days now happens in minutes</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Better customer experience</span>
                  <p className="text-gray-300">apply from anywhere, on any device</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Proactive error tracking</span>
                  <p className="text-gray-300">issues caught and fixed before customers notice</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            Goldman Financial now operates with the speed and efficiency their customers expect, backed by a platform built specifically for their business.
          </p>
        </motion.section>

        {/* CTA Section */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-gradient-to-r from-yellow/10 to-yellow/5 backdrop-blur-lg border border-yellow/50 rounded-2xl p-8 md:p-12 shadow-xl text-center"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            Ready to Transform Your Business?
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6 max-w-2xl mx-auto">
            I help businesses replace outdated processes with custom digital platforms that save time, reduce errors, and deliver better experiences for their customers.
          </p>
          <p className="text-white text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
            If paper forms, manual workflows, or clunky systems are slowing you down, let's talk. I'll design a solution tailored to your business — just like I did for Goldman Financial.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="bg-yellow text-blue font-semibold px-8 py-4 rounded-lg shadow-lg hover:bg-yellow/80 transition-all text-lg"
            >
              Start Your Project →
            </Link>
            <a
              href="https://thegoldmanfund.com"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-yellow text-yellow font-semibold px-8 py-4 rounded-lg hover:bg-yellow hover:text-blue transition text-lg"
            >
              Visit Website →
            </a>
            <Link
              href="/case-studies"
              className="border border-offwhite text-white font-semibold px-8 py-4 rounded-lg hover:bg-white hover:text-gray-800 transition text-lg"
            >
              View More Case Studies
            </Link>
          </div>
        </motion.section>

        {/* Back to Case Studies */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeInUp}
          className="text-center py-8"
        >
          <Link
            href="/case-studies"
            className="text-yellow hover:text-yellow/80 transition font-semibold text-lg"
          >
            ← Back to Case Studies
          </Link>
        </motion.div>
      </div>
    </main>
  );
}
