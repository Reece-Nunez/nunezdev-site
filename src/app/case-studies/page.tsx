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

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const caseStudies = [
  {
    title: "Meridian Luxury Travel",
    description: "Full-stack travel platform with automated bookings, Stripe payments, and a custom CMS for a luxury travel business.",
    tags: ["Next.js", "Supabase", "Stripe"],
    href: "/case-studies/meridian-luxury-travel",
    featured: true,
    category: "Travel & Hospitality",
  },
  {
    title: "Refinery Scheduler",
    description: "Safety-compliant workforce scheduling system for oil refinery operations with RP-755 fatigue policy enforcement.",
    tags: ["Next.js", "Prisma", "React Big Calendar"],
    href: "/case-studies/refinery-scheduler",
    category: "Industrial",
  },
  {
    title: "Sterling Financial",
    description: "Cross-platform personal finance app with native iOS and Android apps sharing a unified Supabase backend.",
    tags: ["Turborepo", "Swift", "Kotlin", "Supabase"],
    href: "/case-studies/sterling-financial",
    category: "FinTech",
  },
  {
    title: "Goldman Financial",
    description: "Digital financial services platform with online applications, e-signatures, PDF generation, and branch locator.",
    tags: ["Next.js", "Google Maps", "PDF Generation"],
    href: "/case-studies/goldman-financial",
    category: "Financial Services",
  },
  {
    title: "Goldman Merchant Services",
    description: "Professional payment processing website with animated service showcases and lead capture forms.",
    tags: ["Next.js", "Framer Motion", "Resend"],
    href: "/case-studies/goldman-merchant-services",
    category: "Financial Services",
  },
  {
    title: "Maigem Massage",
    description: "Full-stack booking platform with real-time scheduling, Square payment integration, and automated confirmations.",
    tags: ["Next.js", "Supabase", "Square"],
    href: "/case-studies/maigem-massage",
    category: "Health & Wellness",
  },
  {
    title: "PC United FC",
    description: "Youth soccer club management platform with player registration, stats tracking, and video highlight management.",
    tags: ["Next.js", "Supabase", "AWS S3"],
    href: "/case-studies/pc-united",
    category: "Sports",
  },
  {
    title: "Farm Expense Tracker",
    description: "Smart agricultural expense tracking with OCR receipt scanning, barcode reading, and tax report generation.",
    tags: ["React", "AWS Amplify", "Tesseract.js"],
    href: "/case-studies/farm-expense-tracker",
    category: "Agriculture",
  },
  {
    title: "Aidoo Academic Press",
    description: "Multi-journal academic publishing platform with editorial workflows and peer review management.",
    tags: ["OJS", "PHP", "MariaDB"],
    href: "/case-studies/aidoo-academic",
    category: "Education",
  },
  {
    title: "Truvino",
    description: "Geographic wine discovery platform with interactive maps and a Python-powered data enrichment pipeline.",
    tags: ["Next.js", "React Simple Maps", "Python"],
    href: "/case-studies/truvino",
    category: "Food & Beverage",
  },
  {
    title: "Jones Legacy Creations",
    description: "Multi-service business website with advanced validated forms for construction, real estate, and interior design.",
    tags: ["Next.js", "React Hook Form", "Zod"],
    href: "/case-studies/jones-legacy-creations",
    category: "Construction",
  },
  {
    title: "Hideaway Hair Studio",
    description: "Stylish salon website with service menus, stylist profiles, and integrated booking links.",
    tags: ["Next.js", "Lucide", "Resend"],
    href: "/case-studies/hideaway-hair-studio",
    category: "Beauty & Wellness",
  },
  {
    title: "Kristina Curtis Photography",
    description: "Photography portfolio with tag-based galleries, investment info, vendor directory, and AWS Lambda contact forms.",
    tags: ["Next.js", "AWS Lambda", "Tailwind CSS"],
    href: "/case-studies/kristina-curtis-photography",
    category: "Creative Services",
  },
  {
    title: "Go Girl Painting",
    description: "Professional website for a women-owned painting company with project gallery and quote request forms.",
    tags: ["Next.js", "Tailwind CSS", "Framer Motion"],
    href: "/case-studies/go-girl-painting",
    category: "Home Services",
  },
  {
    title: "Vacation Rental Site",
    description: "Direct-booking vacation rental website with property galleries, amenity highlights, and inquiry forms.",
    tags: ["React", "Vite", "Tailwind CSS"],
    href: "/case-studies/nunez-vacation-site",
    category: "Travel & Hospitality",
  },
];

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
        <p className="text-yellow/80 text-lg font-semibold">
          {caseStudies.length} Projects Delivered
        </p>
      </motion.div>

      {/* Featured Case Study */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        variants={fadeInUp}
        className="relative w-full max-w-5xl px-6 z-10 mb-16"
      >
        <div className="bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-8 md:p-12 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="text-left">
              <span className="text-yellow/70 text-sm font-semibold uppercase tracking-wider">Featured Project</span>
              <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-4 mt-2">
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

      {/* All Case Studies Grid */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        variants={staggerContainer}
        className="relative w-full max-w-5xl px-6 z-10"
      >
        <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-8">
          All Projects
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {caseStudies.filter(cs => !cs.featured).map((study) => (
            <motion.div key={study.href} variants={fadeInUp}>
              <Link
                href={study.href}
                className="block bg-white/5 backdrop-blur-lg border border-yellow/20 rounded-xl p-6 shadow-lg hover:border-yellow/50 hover:bg-white/10 transition-all h-full text-left group"
              >
                <span className="text-yellow/60 text-xs font-semibold uppercase tracking-wider">
                  {study.category}
                </span>
                <h3 className="text-lg font-bold text-yellow mt-2 mb-3 group-hover:text-yellow/80 transition-colors">
                  {study.title}
                </h3>
                <p className="text-white/80 text-sm leading-relaxed mb-4">
                  {study.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {study.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-yellow/10 text-yellow/80 px-2 py-1 rounded-full border border-yellow/20"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Why Custom Development Section */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={fadeInUp}
        className="relative mt-16 w-full max-w-5xl px-6 z-10"
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

      {/* CTA Section */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={fadeInUp}
        className="relative mt-12 mb-16 w-full max-w-5xl px-6 z-10"
      >
        <div className="bg-gradient-to-r from-yellow/10 to-yellow/5 backdrop-blur-lg border border-yellow/50 rounded-2xl p-8 md:p-12 shadow-xl text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            Ready to Build Something Custom?
          </h2>
          <p className="text-white text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
            Every project above started with a conversation. Let&apos;s discuss how custom development can solve your business challenges.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="bg-yellow text-blue font-semibold px-8 py-4 rounded-lg shadow-lg hover:bg-yellow/80 transition-all text-lg"
            >
              Start Your Project →
            </Link>
            <Link
              href="/services"
              className="border border-offwhite text-white font-semibold px-8 py-4 rounded-lg hover:bg-white hover:text-gray-800 transition text-lg"
            >
              View Services
            </Link>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
