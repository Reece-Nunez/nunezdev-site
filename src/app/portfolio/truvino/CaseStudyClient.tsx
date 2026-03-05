"use client";

import { motion, Variants } from "framer-motion";
import Link from "next/link";
import ThreeBackground from "@/components/ThreeBackground";


const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" as const },
  },
};

export default function CaseStudyClient() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start px-4 pt-32 text-left text-offwhite overflow-hidden">
      <ThreeBackground />

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        variants={fadeInUp}
        className="space-y-6 mb-16 max-w-4xl text-center"
      >
        <h1 className="text-yellow text-2xl sm:text-3xl md:text-5xl font-bold leading-tight">
          Truvino: Geographic Wine Discovery and Data Platform
        </h1>
        <p className="max-w-3xl text-white mx-auto text-lg md:text-xl">
          A map-based wine exploration platform backed by a Python data enrichment pipeline processing 100K+ products, making it easy to discover wines by region with rich, standardized product data.
        </p>
        <a
          href="https://truvino.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-yellow/70 hover:text-yellow transition text-base"
        >
          truvino.com →
        </a>
      </motion.div>

      <div className="relative w-full max-w-4xl px-6 z-10 space-y-12">

        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 sm:p-8 md:p-12 shadow-xl hover:border-yellow/30 transition-all duration-300"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            The Challenge: Scattered Data and No Way to Explore by Region
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6">
            Wine industry data is scattered across inconsistent sources — different retailers, importers, and databases all describe the same products with different formats, missing fields, and conflicting information. There was no unified way for consumers or professionals to explore wines geographically, and product data lacked the standardization needed for meaningful comparison.
          </p>
          <p className="text-white text-lg leading-relaxed mb-6">
            The platform needed to solve several fundamental problems:
          </p>
          <ul className="space-y-3 text-white text-lg">
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Unify wine data from multiple inconsistent sources into a single clean dataset</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Standardize product information including bottle sizes, regions, and categories</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Create an intuitive geographic interface for exploring wines by region</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Handle 100K+ products efficiently through automated data processing</span>
            </li>
          </ul>
          <p className="text-white text-lg leading-relaxed mt-6">
            Without clean, unified data and a compelling way to browse it, the wealth of the wine world remained fragmented and hard to navigate.
          </p>
        </motion.section>

        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 sm:p-8 md:p-12 shadow-xl hover:border-yellow/30 transition-all duration-300"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            The Solution: Map-Based Discovery with a Data Pipeline
          </h2>
          <p className="text-white text-lg leading-relaxed mb-8">
            I built Truvino as a two-part system: a Python-powered data enrichment pipeline that processes and standardizes 100K+ wine products, and a modern web platform with an interactive geographic map that lets users explore wines by clicking on regions around the world. The data pipeline handles the messy work of normalizing bottle sizes, enriching product details, and categorizing wines by region, while the frontend makes that clean data explorable and beautiful.
          </p>
          <p className="text-white text-lg leading-relaxed">
            The interactive map built with React Simple Maps provides an intuitive entry point — users click on a wine region and instantly see what's available. Combined with smooth Framer Motion animations and a responsive design, the platform makes geographic wine discovery feel natural and engaging regardless of whether you're a casual enthusiast or an industry professional.
          </p>
        </motion.section>

        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 sm:p-8 md:p-12 shadow-xl hover:border-yellow/30 transition-all duration-300"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            Key Features Delivered
          </h2>

          <div className="space-y-6">
            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Interactive Geographic Map</h3>
              <p className="text-white leading-relaxed">A world map built with React Simple Maps that lets users explore wine regions by clicking directly on geographic areas, making discovery intuitive and visually engaging.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">100K+ Product Database with Enriched Data</h3>
              <p className="text-white leading-relaxed">A massive product catalog with standardized, enriched data that provides consistent information across all wines regardless of their original source.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Python Data Pipeline</h3>
              <p className="text-white leading-relaxed">Automated Python scripts that process raw product data, normalize bottle sizes, enrich product details, and categorize wines by region — turning messy source data into a clean, queryable dataset.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Regional Browsing and Discovery</h3>
              <p className="text-white leading-relaxed">Users can browse wines by geographic region, exploring what's available from specific countries, appellations, and sub-regions for a curated discovery experience.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Smooth Animations and Modern UI</h3>
              <p className="text-white leading-relaxed">Framer Motion powers fluid transitions and interactions throughout the platform, creating a polished experience that makes exploring wine data feel effortless and enjoyable.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Responsive Design for All Devices</h3>
              <p className="text-white leading-relaxed">The entire platform including the interactive map adapts seamlessly to phones, tablets, and desktops, ensuring a great experience regardless of screen size.</p>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 sm:p-8 md:p-12 shadow-xl hover:border-yellow/30 transition-all duration-300"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            Technology Behind the Scenes
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6">
            Truvino combines a cutting-edge web frontend with a Python data processing backend to deliver both a beautiful user experience and reliable data:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Next.js 16 + React 19</span>
                <span className="text-white/60">for the web platform</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">TypeScript</span>
                <span className="text-white/60">for type-safe development</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">React Simple Maps</span>
                <span className="text-white/60">for interactive geographic maps</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Framer Motion</span>
                <span className="text-white/60">for smooth animations</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Python</span>
                <span className="text-white/60">for data enrichment scripts</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Tailwind CSS 4</span>
                <span className="text-white/60">for modern responsive styling</span>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            This dual-technology approach — Python for heavy data processing and Next.js for the user-facing platform — ensures that both the data quality and the user experience are best-in-class.
          </p>
        </motion.section>

        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 sm:p-8 md:p-12 shadow-xl hover:border-yellow/30 transition-all duration-300"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            Business Impact: Results That Matter
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6">
            Truvino transformed how wine data is organized and explored:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Unified wine data</span>
                  <p className="text-white/60">100K+ products from multiple sources standardized into one clean dataset</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Intuitive geographic discovery</span>
                  <p className="text-white/60">map-based exploration makes finding wines by region natural and engaging</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Standardized product information</span>
                  <p className="text-white/60">consistent bottle sizes, categories, and details across the entire catalog</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Automated data processing</span>
                  <p className="text-white/60">Python pipeline handles enrichment at scale without manual intervention</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            Truvino demonstrates that with the right data pipeline and a thoughtful user interface, even the most fragmented industry data can be transformed into a compelling, explorable experience.
          </p>
        </motion.section>

        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-gradient-to-r from-yellow/10 to-yellow/5 backdrop-blur-sm border border-yellow/50 rounded-2xl p-5 sm:p-8 md:p-12 shadow-xl text-center"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            Ready to Transform Your Business?
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6 max-w-2xl mx-auto">
            I build data-driven platforms that turn messy, scattered information into clean, explorable experiences.
          </p>
          <p className="text-white text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
            If your industry has valuable data trapped in inconsistent formats, let's talk. I'll build a platform that unifies your data and makes it accessible — just like I did for Truvino.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="bg-yellow text-gray-900 font-semibold px-8 py-3.5 rounded-lg shadow-lg hover:shadow-[0_0_20px_rgba(255,195,18,0.3)] transition-shadow duration-300 transition-all text-lg"
            >
              Start Your Project →
            </Link>
            <a
              href="https://truvino.com"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-yellow/40 text-yellow font-semibold px-8 py-3.5 rounded-lg hover:bg-yellow hover:text-blue transition text-lg"
            >
              Visit Website →
            </a>
            <Link
              href="/portfolio"
              className="border border-white/40 text-white font-semibold px-8 py-3.5 rounded-lg hover:bg-white hover:text-gray-800 transition text-lg"
            >
              View More Projects
            </Link>
          </div>
        </motion.section>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeInUp}
          className="text-center py-8"
        >
          <Link
            href="/portfolio"
            className="text-yellow hover:text-yellow/80 transition font-semibold text-lg"
          >
            ← Back to Projects
          </Link>
        </motion.div>
      </div>
    </main>
  );
}
