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

export default function GoGirlPaintingCaseStudy() {
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
          Go Girl Painting: Professional Website for a Women-Owned Painting Company
        </h1>
        <p className="max-w-3xl text-white mx-auto text-lg md:text-xl">
          A custom-built website that gives a growing women-owned painting business a professional online presence with a project gallery, service overview, and easy contact options to generate leads.
        </p>
        <a
          href="https://go-girlpainting.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-yellow/70 hover:text-yellow transition text-base"
        >
          go-girlpainting.com →
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
            The Challenge: A Growing Business Without a Web Presence
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6">
            Go Girl Painting was a growing painting business relying entirely on word-of-mouth and social media to attract new clients. Without a professional website, potential customers had no way to see their portfolio, learn about their services, or easily request a quote — limiting growth and credibility.
          </p>
          <p className="text-white text-lg leading-relaxed mb-6">
            The business needed a website that could:
          </p>
          <ul className="space-y-3 text-white text-lg">
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Showcase completed projects with a professional gallery</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Clearly communicate services and service areas</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Tell the story of the business and build trust with visitors</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Make it easy for potential customers to request a quote</span>
            </li>
          </ul>
          <p className="text-white text-lg leading-relaxed mt-6">
            They needed more than a basic site — they needed a professional online presence that reflected the quality of their work and made it easy for new customers to take the next step.
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
            The Solution: A Custom Website Built to Convert
          </h2>
          <p className="text-white text-lg leading-relaxed mb-8">
            I designed and built a custom website featuring a project gallery that showcases completed work, clear service descriptions, and easy contact options for quote requests. The site tells the Go Girl Painting story through a dedicated about page, building trust and connection with potential clients before they ever pick up the phone.
          </p>
          <p className="text-white text-lg leading-relaxed">
            Every page is mobile-responsive and optimized for fast loading and search engine visibility, ensuring the business can be found by customers searching for painting services in their area.
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
              <h3 className="text-xl font-semibold text-yellow mb-2">Project Gallery Showcasing Completed Work</h3>
              <p className="text-white leading-relaxed">A visual gallery highlighting before-and-after transformations and finished projects, letting the quality of the work speak for itself and building confidence with prospective clients.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Service Area and Offerings Overview</h3>
              <p className="text-white leading-relaxed">Clear breakdown of painting services offered — interior, exterior, residential, and commercial — along with the geographic areas served, so visitors know immediately if Go Girl Painting is the right fit.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">About Page Telling the Business Story</h3>
              <p className="text-white leading-relaxed">A dedicated page sharing the story behind the business — the mission, values, and the team — building a personal connection with visitors and differentiating from competitors.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Contact Integration for Quote Requests</h3>
              <p className="text-white leading-relaxed">Easy-to-find contact options and quote request forms throughout the site, reducing friction and making it simple for interested visitors to take the next step.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Mobile-Responsive Design</h3>
              <p className="text-white leading-relaxed">Fully responsive layout that looks great and functions perfectly on phones, tablets, and desktops — because most customers are searching on their mobile devices.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Fast Loading and SEO-Optimized</h3>
              <p className="text-white leading-relaxed">Built for speed and search engine visibility, ensuring the site loads quickly and ranks well for local painting service searches.</p>
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
            The Go Girl Painting website is built with a modern frontend stack optimized for performance and visual polish:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Next.js + React</span>
                <span className="text-gray-300">for fast, SEO-friendly pages</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">TypeScript</span>
                <span className="text-gray-300">for reliable code</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Tailwind CSS</span>
                <span className="text-gray-300">for responsive design</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Framer Motion</span>
                <span className="text-gray-300">for smooth animations</span>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            This lightweight but powerful stack delivers fast page loads, smooth interactions, and a polished visual experience that reflects the quality of the business.
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
            The new website transformed Go Girl Painting's ability to attract and convert customers:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Professional online presence</span>
                  <p className="text-gray-300">credibility that matches the quality of their painting work</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Easier lead generation</span>
                  <p className="text-gray-300">visitors can request quotes directly from the site</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Showcased quality of work</span>
                  <p className="text-gray-300">project gallery lets the results speak for themselves</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Search engine visibility</span>
                  <p className="text-gray-300">optimized for local searches to reach new customers</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            Go Girl Painting now has a professional digital home that works around the clock to attract new customers and showcase the quality work that sets them apart.
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
            I help small businesses establish a professional online presence that attracts customers and builds credibility.
          </p>
          <p className="text-white text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
            If your business is relying on word-of-mouth alone, a custom website can open up a whole new channel for growth. Let's talk about building yours — just like I did for Go Girl Painting.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="bg-yellow text-blue font-semibold px-8 py-4 rounded-lg shadow-lg hover:bg-yellow/80 transition-all text-lg"
            >
              Start Your Project →
            </Link>
            <a
              href="https://go-girlpainting.com"
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
