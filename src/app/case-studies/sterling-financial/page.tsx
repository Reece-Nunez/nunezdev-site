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

export default function SterlingFinancialCaseStudy() {
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
          Sterling: Cross-Platform Personal Finance Application
        </h1>
        <p className="max-w-3xl text-white mx-auto text-lg md:text-xl">
          A unified personal finance app spanning web, iOS, and Android — built as a Turborepo monorepo with native mobile apps and a shared Supabase backend for seamless cross-device financial management.
        </p>
        <a
          href="https://joinsterling.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-yellow/70 hover:text-yellow transition text-base"
        >
          joinsterling.com →
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
            The Challenge: Fragmented Finance Tools Across Platforms
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6">
            Existing personal finance tools forced users into a compromise: either a solid web experience with no mobile app, or a mobile-only app with no desktop counterpart. Users who wanted to manage their finances across all their devices were stuck juggling multiple tools with no data synchronization.
          </p>
          <p className="text-white text-lg leading-relaxed mb-6">
            The project required a solution that could:
          </p>
          <ul className="space-y-3 text-white text-lg">
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Deliver a consistent experience across web, iOS, and Android</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Provide native performance on mobile rather than a wrapped web view</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Share a single backend so data stays synchronized in real time</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Keep the codebase maintainable as a single developer or small team</span>
            </li>
          </ul>
          <p className="text-white text-lg leading-relaxed mt-6">
            Building three separate apps with three separate backends would be unsustainable. The architecture needed to be smart from the start.
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
            The Solution: A Monorepo with Native Apps and a Shared Backend
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6">
            I architected Sterling as a Turborepo monorepo containing a Next.js web application, a native Android app built with Kotlin and Jetpack Compose, and a native iOS app built with Swift and SwiftUI — all sharing a single Supabase backend.
          </p>
          <p className="text-white text-lg leading-relaxed mb-6">
            This approach means users get the best experience on every platform: a fast, SEO-friendly web app for desktop users, and truly native mobile apps that feel right at home on iOS and Android. All financial data stays perfectly synchronized through the shared Supabase backend.
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
              <h3 className="text-xl font-semibold text-yellow mb-2">Financial Dashboard</h3>
              <p className="text-white leading-relaxed">A comprehensive overview of accounts, balances, recent transactions, and spending trends — designed to give users a clear picture of their finances at a glance.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Transaction Tracking and History</h3>
              <p className="text-white leading-relaxed">Log, search, and review all transactions with detailed history. Filter by date, category, or amount to find exactly what you need.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Spending Analysis and Categorization</h3>
              <p className="text-white leading-relaxed">Automatic categorization of spending with visual breakdowns showing where money goes each month, helping users identify patterns and opportunities to save.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Budget Management</h3>
              <p className="text-white leading-relaxed">Set monthly budgets by category, track progress in real time, and receive alerts when spending approaches or exceeds limits.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Native iOS and Android Apps</h3>
              <p className="text-white leading-relaxed">Truly native mobile experiences — SwiftUI on iOS and Jetpack Compose on Android — delivering platform-appropriate design, smooth animations, and native performance.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Shared Supabase Backend</h3>
              <p className="text-white leading-relaxed">A single backend powering all three platforms, ensuring data consistency and real-time synchronization no matter which device a user picks up.</p>
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
            Sterling's architecture leverages the best tools for each platform while keeping everything manageable in a single repository:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Turborepo</span>
                <span className="text-gray-300">monorepo for unified development</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Next.js</span>
                <span className="text-gray-300">for the web application</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Kotlin + Jetpack Compose</span>
                <span className="text-gray-300">native Android with Material 3</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Swift + SwiftUI</span>
                <span className="text-gray-300">native iOS experience</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Supabase</span>
                <span className="text-gray-300">shared backend for all platforms</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Material 3</span>
                <span className="text-gray-300">modern Android design system</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Hilt DI</span>
                <span className="text-gray-300">dependency injection for Android</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Retrofit</span>
                <span className="text-gray-300">type-safe HTTP for Android</span>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            The Turborepo architecture allows all three platforms to share configuration, types, and build tooling while each app uses the best native tools for its platform.
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
            Sterling demonstrates the power of thoughtful cross-platform architecture:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Unified finance management</span>
                  <p className="text-gray-300">one app, every device, always in sync</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Native mobile performance</span>
                  <p className="text-gray-300">no web-view compromises on iOS or Android</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Shared business logic</span>
                  <p className="text-gray-300">single backend reduces maintenance and ensures consistency</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Maintainable architecture</span>
                  <p className="text-gray-300">monorepo structure keeps three platforms manageable</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            By choosing native development for each platform with a shared backend, Sterling delivers the quality users expect without the engineering overhead of maintaining completely separate codebases.
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
            Ready to Build Cross-Platform?
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6 max-w-2xl mx-auto">
            I build web applications, native mobile apps, and cross-platform solutions that share a unified backend — giving your users the best experience on every device.
          </p>
          <p className="text-white text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
            If you need an app that works beautifully on web, iOS, and Android, let's talk. I'll architect a solution that scales — just like I did with Sterling.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="bg-yellow text-blue font-semibold px-8 py-4 rounded-lg shadow-lg hover:bg-yellow/80 transition-all text-lg"
            >
              Start Your Project →
            </Link>
            <a
              href="https://joinsterling.com"
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
