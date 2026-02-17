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

export default function CaseStudies() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start px-4 pt-32 text-center text-offwhite overflow-hidden">
      <ThreeBackground />

      {/* Hero Section */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        variants={fadeInUp}
        className="space-y-6 mb-16 max-w-4xl"
      >
        <h1 className="text-yellow text-4xl md:text-6xl font-bold">
          Case Studies
        </h1>
        <p className="max-w-2xl text-white mx-auto text-lg md:text-xl">
          Real projects, real results. See how custom development beats DIY platforms
          and discover why businesses choose purpose-built solutions.
        </p>
      </motion.div>

      {/* Featured Case Study */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        variants={fadeInUp}
        className="relative w-full max-w-4xl px-6 z-10"
      >
        <div className="bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-8 md:p-12 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-4">
                Meridian Luxury Travel Platform
              </h2>
              <p className="text-white text-lg leading-relaxed mb-6">
                A complete custom web application that automated bookings, integrated payments, and streamlined operations for a luxury travel business.
              </p>
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 bg-yellow rounded-full"></span>
                  <span className="text-white">Automated quote-to-booking system</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 bg-yellow rounded-full"></span>
                  <span className="text-white">Secure Stripe payment integration</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 bg-yellow rounded-full"></span>
                  <span className="text-white">Custom CMS and admin dashboard</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 bg-yellow rounded-full"></span>
                  <span className="text-white">Next.js + Supabase tech stack</span>
                </div>
              </div>
              <Link
                href="/case-studies/meridian-luxury-travel"
                className="bg-yellow text-blue font-semibold px-6 py-3 rounded-lg shadow hover:bg-yellow/80 transition-all inline-block"
              >
                Read Full Case Study →
              </Link>
            </div>
            <div className="relative h-64 md:h-80 rounded-xl overflow-hidden shadow-lg">
              <img
                src="/images/meridian.png"
                alt="Meridian Luxury Travel Platform"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* More Coming Soon */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        variants={fadeInUp}
        className="relative w-full max-w-4xl px-6 z-10"
      >
        <div className="bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-8 md:p-12 shadow-xl text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            More Case Studies Coming Soon
          </h2>
          <p className="text-white text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
            I'm documenting more exciting projects that showcase how custom development transforms businesses. These will include before/after metrics, technical insights, and ROI analysis.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="bg-yellow text-blue font-semibold px-6 py-3 rounded-lg shadow hover:bg-yellow/80 transition-all"
            >
              Discuss Your Project
            </Link>
            <Link
              href="/services"
              className="border border-offwhite text-white font-semibold px-6 py-3 rounded-lg hover:bg-white hover:text-gray-800 transition"
            >
              View Services
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Why Custom Development Section */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={fadeInUp}
        className="relative mt-16 w-full max-w-4xl px-6 z-10"
      >
        <div className="bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-8 md:p-12 shadow-xl">
          <h3 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            Why I Build Custom Instead of Using Templates
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            <div className="space-y-4">
              <h4 className="text-xl font-semibold text-yellow">Templates & DIY Platforms</h4>
              <ul className="space-y-2 text-white">
                <li>• Limited customization options</li>
                <li>• Slower performance due to bloat</li>
                <li>• Monthly subscription fees</li>
                <li>• Generic design that looks like everyone else</li>
                <li>• Difficult to scale or add complex features</li>
                <li>• SEO limitations</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-xl font-semibold text-yellow">Custom Development</h4>
              <ul className="space-y-2 text-white">
                <li>• Unlimited customization and features</li>
                <li>• Optimized performance and speed</li>
                <li>• One-time investment, you own the code</li>
                <li>• Unique design that reflects your brand</li>
                <li>• Scales with your business needs</li>
                <li>• Built for SEO from the ground up</li>
              </ul>
            </div>
          </div>
        </div>
      </motion.div>
    </main>
  );
}