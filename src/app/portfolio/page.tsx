"use client";

import { useState } from "react";
import { motion, Variants, AnimatePresence } from "framer-motion";
import Link from "next/link";
import ThreeBackground from "@/components/ThreeBackground";
import { projects } from "@/data/projects";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" as const },
  },
};

const categories = [
  "All",
  ...Array.from(new Set(projects.map((p) => p.category))),
];

export default function Portfolio() {
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered =
    activeCategory === "All"
      ? projects
      : projects.filter((p) => p.category === activeCategory);

  return (
    <main className="flex min-h-screen flex-col items-center px-4 pt-32 pb-24 text-offwhite overflow-hidden">
      <ThreeBackground />

      {/* Hero */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.12 } },
        }}
        className="max-w-4xl text-center mb-16 z-10"
      >
        <motion.p
          variants={fadeInUp}
          className="text-yellow/70 text-sm uppercase tracking-widest font-medium mb-3"
        >
          Portfolio
        </motion.p>
        <motion.h1
          variants={fadeInUp}
          className="text-yellow text-4xl md:text-6xl font-bold tracking-tight mb-6"
        >
          Work That Speaks for Itself
        </motion.h1>
        <motion.p
          variants={fadeInUp}
          className="text-white/60 text-lg md:text-xl max-w-2xl mx-auto mb-2"
        >
          Real projects built for real businesses. Every solution is
          custom-coded, purpose-built, and engineered to deliver results.
        </motion.p>
        <motion.p
          variants={fadeInUp}
          className="text-yellow/80 text-lg font-semibold mt-4"
        >
          {projects.length} Projects Delivered
        </motion.p>
      </motion.div>

      {/* Category Filters */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.04, delayChildren: 0.3 } },
        }}
        className="flex flex-wrap justify-center gap-2 mb-12 z-10 max-w-4xl"
      >
        {categories.map((cat) => (
          <motion.button
            key={cat}
            variants={fadeInUp}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 border ${
              activeCategory === cat
                ? "bg-yellow text-gray-900 border-yellow shadow-[0_0_15px_rgba(255,195,18,0.3)]"
                : "bg-white/5 text-white/70 border-white/10 hover:border-yellow/40 hover:text-white"
            }`}
          >
            {cat}
          </motion.button>
        ))}
      </motion.div>

      {/* Featured Project */}
      {activeCategory === "All" && (
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.12 } },
          }}
          className="relative w-full max-w-5xl z-10 mb-16"
        >
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12 hover:border-yellow/30 transition-all duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="text-left">
                <motion.span
                  variants={fadeInUp}
                  className="inline-block text-yellow/70 text-sm font-semibold uppercase tracking-wider mb-2"
                >
                  Featured Project
                </motion.span>
                <motion.h2
                  variants={fadeInUp}
                  className="text-2xl md:text-3xl font-bold text-yellow mb-4"
                >
                  Meridian Luxury Travel Platform
                </motion.h2>
                <motion.p
                  variants={fadeInUp}
                  className="text-white/70 text-lg leading-relaxed mb-6"
                >
                  A complete custom web application that automated bookings,
                  integrated payments, and streamlined operations for a luxury
                  travel business.
                </motion.p>
                <motion.div variants={fadeInUp} className="space-y-3 mb-6">
                  {[
                    "Automated quote-to-booking system",
                    "Secure Stripe payment integration",
                    "Custom CMS and admin dashboard",
                    "Next.js + Supabase tech stack",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <span className="w-2 h-2 bg-yellow rounded-full shrink-0" />
                      <span className="text-white/80">{item}</span>
                    </div>
                  ))}
                </motion.div>
                <motion.div
                  variants={fadeInUp}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  className="inline-block"
                >
                  <Link
                    href="/portfolio/meridian-luxury-travel"
                    className="inline-block bg-yellow text-gray-900 font-semibold px-6 py-3 rounded-lg shadow hover:shadow-[0_0_20px_rgba(255,195,18,0.3)] transition-shadow duration-300"
                  >
                    View Full Project &rarr;
                  </Link>
                </motion.div>
              </div>
              <motion.div
                variants={fadeInUp}
                className="relative h-64 md:h-80 rounded-xl overflow-hidden border border-white/10"
              >
                <img
                  src="/images/meridian.png"
                  alt="Meridian Luxury Travel Platform"
                  className="w-full h-full object-cover"
                />
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Projects Grid */}
      <div className="w-full max-w-6xl z-10 mb-16">
        <motion.h2
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeInUp}
          className="text-2xl md:text-3xl font-bold text-yellow mb-8 px-2"
        >
          {activeCategory === "All" ? "All Projects" : activeCategory}
        </motion.h2>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filtered
              .filter((p) => activeCategory !== "All" || !p.featured)
              .map((project, i) => (
                <motion.div
                  key={project.slug}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    transition: { delay: i * 0.06, duration: 0.5 },
                  }}
                  whileHover={{ scale: 1.03 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <Link
                    href={`/portfolio/${project.slug}`}
                    className="block h-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden text-left hover:border-yellow/50 hover:shadow-[0_0_25px_rgba(255,195,18,0.15)] transition-all duration-300 group"
                  >
                    <div className="h-1.5 bg-gradient-to-r from-yellow to-yellow/30" />
                    <div className="p-6">
                      <span className="text-yellow/60 text-xs font-semibold uppercase tracking-wider">
                        {project.category}
                      </span>
                      <h3 className="text-white font-semibold text-lg mt-2 mb-3 group-hover:text-yellow transition-colors">
                        {project.title}
                      </h3>
                      <p className="text-white/60 text-sm leading-relaxed mb-4">
                        {project.description}
                      </p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {project.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs bg-yellow/10 text-yellow/80 px-2 py-1 rounded-full border border-yellow/20"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <span className="text-yellow text-sm font-medium">
                        View Project &rarr;
                      </span>
                    </div>
                  </Link>
                </motion.div>
              ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Custom vs Templates */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.1 } },
        }}
        className="w-full max-w-5xl z-10 mb-12"
      >
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12">
          <motion.h3
            variants={fadeInUp}
            className="text-2xl md:text-3xl font-bold text-yellow mb-8 text-center"
          >
            Why Custom Beats Templates
          </motion.h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div variants={fadeInUp} className="space-y-4">
              <h4 className="text-lg font-semibold text-white/40 uppercase tracking-wider">
                Templates & DIY
              </h4>
              <ul className="space-y-3">
                {[
                  "Limited customization options",
                  "Slower performance due to bloat",
                  "Monthly subscription fees",
                  "Generic design like everyone else",
                  "Difficult to scale",
                  "SEO limitations",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-white/50">
                    <span className="w-1.5 h-1.5 bg-white/30 rounded-full shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div variants={fadeInUp} className="space-y-4">
              <h4 className="text-lg font-semibold text-yellow uppercase tracking-wider">
                Custom Development
              </h4>
              <ul className="space-y-3">
                {[
                  "Unlimited customization and features",
                  "Optimized performance and speed",
                  "One-time investment, you own the code",
                  "Unique design that reflects your brand",
                  "Scales with your business needs",
                  "Built for SEO from the ground up",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-white/80">
                    <span className="w-1.5 h-1.5 bg-yellow rounded-full shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* CTA */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        variants={fadeInUp}
        className="text-center z-10 py-8"
      >
        <h3 className="text-2xl md:text-3xl font-bold text-yellow mb-4">
          Ready to Build Something Custom?
        </h3>
        <p className="text-white/60 text-lg mb-8 max-w-2xl mx-auto">
          Every project above started with a conversation. Let&apos;s discuss
          how custom development can solve your business challenges.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          >
            <Link
              href="/contact"
              className="inline-block bg-yellow text-gray-900 font-semibold px-8 py-3.5 rounded-lg shadow hover:shadow-[0_0_20px_rgba(255,195,18,0.3)] transition-shadow duration-300 text-lg"
            >
              Start Your Project &rarr;
            </Link>
          </motion.div>
          <Link
            href="/services"
            className="inline-block text-lg text-white border border-white/40 px-8 py-3.5 rounded-lg font-semibold hover:bg-white hover:text-gray-800 transition"
          >
            View Services
          </Link>
        </div>
      </motion.div>
    </main>
  );
}
