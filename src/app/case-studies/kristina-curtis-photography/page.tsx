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

export default function KristinaCurtisPhotographyCaseStudy() {
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
          Kristina Curtis Photography: Portfolio and Client Experience Platform
        </h1>
        <p className="max-w-3xl text-white mx-auto text-lg md:text-xl">
          A custom photography portfolio featuring curated galleries, investment transparency, vendor connections, and a serverless contact backend — designed to showcase stunning work and guide clients seamlessly from discovery to booking.
        </p>
        <a
          href="https://kristinacurtisphotography.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-yellow/70 hover:text-yellow transition text-base"
        >
          kristinacurtisphotography.com →
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
            The Challenge: A Portfolio That Converts Visitors into Clients
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6">
            Kristina Curtis Photography needed more than a gallery — she needed a portfolio that showcased her work beautifully while guiding potential clients through the booking process. The existing online presence wasn't reflecting the quality of the photography or making it easy for interested clients to take the next step.
          </p>
          <p className="text-white text-lg leading-relaxed mb-6">
            The platform needed to:
          </p>
          <ul className="space-y-3 text-white text-lg">
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Display photography in curated, filterable galleries</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Provide transparent pricing and investment information</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Connect clients with preferred vendors for a complete event experience</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Make it effortless to inquire and start the booking conversation</span>
            </li>
          </ul>
          <p className="text-white text-lg leading-relaxed mt-6">
            The goal was a site that felt as polished as the photography itself — one that told a story, built trust, and made booking feel natural.
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
            The Solution: A Portfolio Built for the Full Client Journey
          </h2>
          <p className="text-white text-lg leading-relaxed mb-8">
            I designed and built a custom photography portfolio with curated galleries featuring tag-based filtering, an investment page for pricing transparency, a preferred vendor directory, and a contact form powered by AWS Lambda for reliable email delivery. The site also includes a brand storytelling about page and mobile-optimized image viewing throughout.
          </p>
          <p className="text-white text-lg leading-relaxed">
            Every page is designed to move visitors closer to booking — from the first gallery they browse to the moment they submit an inquiry. The result is a cohesive brand experience that reflects the artistry of the photography and makes the business side effortless.
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
              <h3 className="text-xl font-semibold text-yellow mb-2">Curated Portfolio Galleries with Tag-Based Filtering</h3>
              <p className="text-white leading-relaxed">Beautiful, responsive galleries organized by category with tag-based filtering — allowing visitors to browse weddings, portraits, events, and more with a single click.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Investment/Pricing Page for Transparency</h3>
              <p className="text-white leading-relaxed">A dedicated investment page that clearly communicates packages and pricing, setting expectations upfront and attracting clients who are the right fit.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Preferred Vendor Directory</h3>
              <p className="text-white leading-relaxed">A curated list of trusted vendors — florists, venues, planners, and more — adding value for clients planning events and strengthening professional partnerships.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Contact Form with AWS Lambda Email Backend</h3>
              <p className="text-white leading-relaxed">A polished contact form backed by a serverless AWS Lambda function for reliable email delivery — ensuring every inquiry reaches the photographer without depending on third-party form services.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">About Page with Brand Storytelling</h3>
              <p className="text-white leading-relaxed">A compelling about page that shares Kristina's story, philosophy, and approach — creating a personal connection with visitors before they ever meet in person.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Mobile-Optimized Image Viewing</h3>
              <p className="text-white leading-relaxed">Images are optimized for fast loading and beautiful display on every screen size, ensuring the photography looks stunning whether viewed on a phone, tablet, or desktop.</p>
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
            The Kristina Curtis Photography platform combines a modern frontend with serverless backend capabilities for a fast, reliable experience:
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
                <span className="text-white font-semibold">AWS Lambda</span>
                <span className="text-gray-300">for serverless email backend</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Tailwind CSS</span>
                <span className="text-gray-300">for responsive design</span>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            This stack delivers the visual polish a photography portfolio demands, with the performance and reliability needed to make a strong first impression every time.
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
            The new portfolio platform elevated the entire client experience:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Professional brand presence</span>
                  <p className="text-gray-300">a portfolio that matches the quality of the photography</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Streamlined client inquiries</span>
                  <p className="text-gray-300">contact form with reliable serverless email delivery</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Showcased work effectively</span>
                  <p className="text-gray-300">filterable galleries that let the photography shine</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Added value for clients</span>
                  <p className="text-gray-300">vendor directory and investment transparency build trust</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            Kristina Curtis Photography now has a digital home that does justice to the artistry of the work and turns visitors into booked clients.
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
            I help creative professionals build portfolio websites that showcase their work beautifully and guide visitors from browsing to booking.
          </p>
          <p className="text-white text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
            Whether you're a photographer, designer, or creative entrepreneur, let's build a platform that reflects your artistry and grows your business — just like I did for Kristina Curtis Photography.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="bg-yellow text-blue font-semibold px-8 py-4 rounded-lg shadow-lg hover:bg-yellow/80 transition-all text-lg"
            >
              Start Your Project →
            </Link>
            <a
              href="https://kristinacurtisphotography.com"
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
