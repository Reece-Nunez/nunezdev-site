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

export default function FarmExpenseTrackerCaseStudy() {
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
          AgTrackr: Smart Farm Expense Tracking with Receipt Scanning
        </h1>
        <p className="max-w-3xl text-white mx-auto text-lg md:text-xl">
          A digital expense tracking application for farmers that replaces paper receipts and manual spreadsheets with OCR receipt scanning, automatic categorization, and tax-ready report generation.
        </p>
        <a
          href="https://harvestrackr.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-yellow/70 hover:text-yellow transition text-base"
        >
          harvestrackr.com →
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
            The Challenge: Paper Receipts and Tax Season Nightmares
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6">
            Farmers across the country share the same problem: envelopes stuffed with paper receipts, manual spreadsheets that fall behind, and a frantic scramble every tax season to piece together a year's worth of expenses.
          </p>
          <p className="text-white text-lg leading-relaxed mb-6">
            The traditional approach was failing in every way:
          </p>
          <ul className="space-y-3 text-white text-lg">
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Paper receipts fading, getting lost, or becoming unreadable</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Manual data entry into spreadsheets consuming valuable time</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>No clear visibility into spending patterns across categories like feed, fuel, and repairs</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Tax preparation taking days instead of hours due to disorganized records</span>
            </li>
          </ul>
          <p className="text-white text-lg leading-relaxed mt-6">
            Farmers needed a tool that fit their workflow — something they could use in the truck, at the feed store, or in the barn — not another desktop-only accounting application.
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
            The Solution: Digital Expense Tracking with OCR Receipt Scanning
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6">
            I built AgTrackr as a smart expense tracking application that lets farmers snap a photo of any receipt and have it automatically digitized using OCR technology. The app extracts vendor names, amounts, and dates, then categorizes expenses into farm-specific categories like Feed, Seed, Fuel, and Repairs.
          </p>
          <p className="text-white text-lg leading-relaxed mb-6">
            When tax season arrives, farmers can generate detailed reports and export them as CSV or PDF files ready for their accountant — turning days of preparation into minutes.
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
              <h3 className="text-xl font-semibold text-yellow mb-2">Receipt Photo Scanning with OCR</h3>
              <p className="text-white leading-relaxed">Snap a photo of any receipt and Tesseract.js extracts the text automatically — vendor name, total amount, date, and line items are parsed and ready to categorize.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Barcode Scanning</h3>
              <p className="text-white leading-relaxed">Quick product entry via barcode scanning with Quagga, letting farmers log inventory purchases by simply scanning the product barcode.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Category-Based Expense Tracking</h3>
              <p className="text-white leading-relaxed">Farm-specific expense categories — Feed, Seed, Fuel, Repairs, Equipment, Veterinary, and more — organized the way farmers actually think about their spending.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Interactive Dashboards and Analytics</h3>
              <p className="text-white leading-relaxed">Visual spending breakdowns with Recharts and Victory charts showing monthly trends, category comparisons, and year-over-year expense analysis.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">CSV and PDF Export</h3>
              <p className="text-white leading-relaxed">Generate tax-ready reports and export them as CSV for spreadsheet tools or professionally formatted PDF documents via jsPDF — ready to hand to an accountant.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Cloud Authentication and Storage</h3>
              <p className="text-white leading-relaxed">AWS Amplify provides secure user authentication and cloud storage for receipt images, ensuring data is backed up and accessible from any device.</p>
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
            AgTrackr is built on a modern stack optimized for fast, reliable performance — even with limited connectivity in rural areas:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">React 18 + TypeScript</span>
                <span className="text-gray-300">for a responsive, type-safe UI</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">AWS Amplify</span>
                <span className="text-gray-300">auth, GraphQL API, and cloud storage</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Tesseract.js</span>
                <span className="text-gray-300">for client-side OCR receipt scanning</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Quagga</span>
                <span className="text-gray-300">for barcode scanning and product entry</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Recharts + Victory</span>
                <span className="text-gray-300">for interactive expense dashboards</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">jsPDF</span>
                <span className="text-gray-300">for tax-ready PDF report generation</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Vite</span>
                <span className="text-gray-300">for fast development and optimized builds</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Tailwind CSS 3</span>
                <span className="text-gray-300">for clean, responsive styling</span>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            By running OCR processing client-side with Tesseract.js, receipt scanning works even in areas with spotty internet — a critical requirement for farmers in rural locations.
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
            AgTrackr transformed how farmers manage their finances:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Eliminated paper receipt systems</span>
                  <p className="text-gray-300">no more faded receipts in envelopes or shoeboxes</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Automated expense categorization</span>
                  <p className="text-gray-300">OCR scanning and smart categorization replace manual data entry</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Simplified tax preparation</span>
                  <p className="text-gray-300">export-ready reports turn days of tax prep into minutes</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Real-time spending visibility</span>
                  <p className="text-gray-300">interactive dashboards show exactly where money goes across the operation</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            What was once a dreaded chore — sorting through piles of receipts at the end of the year — is now an automated, organized process that gives farmers clear visibility into their operation's finances year-round.
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
            Ready to Digitize Your Workflow?
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6 max-w-2xl mx-auto">
            I build custom applications for agriculture, trade businesses, and industries where paper-based processes are holding operations back.
          </p>
          <p className="text-white text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
            If your business is still drowning in paper receipts and manual tracking, let's talk. I'll build a digital solution tailored to your industry — just like I did with AgTrackr.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="bg-yellow text-blue font-semibold px-8 py-4 rounded-lg shadow-lg hover:bg-yellow/80 transition-all text-lg"
            >
              Start Your Project →
            </Link>
            <a
              href="https://harvestrackr.com"
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
