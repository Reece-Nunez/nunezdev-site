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

export default function JonesLegacyCreationsCaseStudy() {
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
          Jones Legacy Creations: Custom Business Website with Smart Forms
        </h1>
        <p className="max-w-3xl text-white mx-auto text-lg md:text-xl">
          A professional website with bulletproof form validation, real-time error feedback, and automated email notifications — turning every visitor interaction into a reliable lead.
        </p>
        <a
          href="https://joneslegacycreations.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-yellow/70 hover:text-yellow transition text-base"
        >
          joneslegacycreations.com →
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
            The Challenge: Unreliable Forms and Lost Leads
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6">
            Jones Legacy Creations needed more than just a website — they needed a reliable system for capturing leads and processing custom orders. Their previous setup suffered from form submissions with incomplete information, spam entries cluttering their inbox, and no way to validate data before it was sent.
          </p>
          <p className="text-white text-lg leading-relaxed mb-6">
            The business needed a solution that could:
          </p>
          <ul className="space-y-3 text-white text-lg">
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Validate every form field in real time before submission</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Prevent incomplete or invalid submissions from reaching the team</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Automatically notify the team when a valid inquiry comes in</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Present a professional, trustworthy brand image online</span>
            </li>
          </ul>
          <p className="text-white text-lg leading-relaxed mt-6">
            Every bad form submission meant wasted time chasing incomplete information — and every lost lead meant lost revenue.
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
            The Solution: Smart Forms That Work for the Business
          </h2>
          <p className="text-white text-lg leading-relaxed mb-8">
            I built a custom website with an advanced form system powered by React Hook Form and Zod validation. Every field is validated in real time as the user types, with clear error messages that guide them to a successful submission. No more incomplete data, no more spam, and no more chasing down missing information.
          </p>
          <p className="text-white text-lg leading-relaxed">
            When a form is submitted successfully, the team receives an instant email notification via Resend, and the user sees a confirmation toast — creating a seamless experience on both sides. The result is a website that doesn't just look professional; it actively works to capture and qualify every lead.
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
              <h3 className="text-xl font-semibold text-yellow mb-2">Multi-Step Forms with Real-Time Validation</h3>
              <p className="text-white leading-relaxed">Complex forms broken into intuitive steps with React Hook Form, validating each field as the user interacts — catching errors before they submit, not after.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Zod Schema Validation for Data Integrity</h3>
              <p className="text-white leading-relaxed">Every form submission is validated against strict Zod schemas on both client and server, ensuring that only clean, complete data reaches the business — eliminating junk submissions entirely.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Email Notifications via Resend</h3>
              <p className="text-white leading-relaxed">Valid form submissions trigger instant, professionally formatted email notifications to the team, so they can respond to leads while the interest is still fresh.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Toast Notifications for User Feedback</h3>
              <p className="text-white leading-relaxed">react-hot-toast provides clear, non-intrusive confirmation messages that let users know their submission was received — building confidence and reducing duplicate submissions.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Responsive Design</h3>
              <p className="text-white leading-relaxed">A fully responsive layout that ensures forms are just as easy to fill out on a phone as they are on a desktop, with touch-friendly inputs and clear visual hierarchy.</p>
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
            A focused stack built for reliability, validation, and a smooth user experience:
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
                <span className="text-white font-semibold">React Hook Form</span>
                <span className="text-gray-300">for performant form handling</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Zod</span>
                <span className="text-gray-300">for schema validation</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Resend</span>
                <span className="text-gray-300">for email notifications</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">react-hot-toast</span>
                <span className="text-gray-300">for user feedback</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Tailwind CSS 4 + Lucide + Framer Motion</span>
                <span className="text-gray-300">for modern UI</span>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            This stack ensures that every interaction is validated, every submission is reliable, and the user experience stays smooth from start to finish.
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
            The new website transformed how Jones Legacy Creations captures and manages leads:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Reduced form errors</span>
                  <p className="text-gray-300">real-time validation catches mistakes before submission</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Better lead capture</span>
                  <p className="text-gray-300">every submission is complete and actionable</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Professional online presence</span>
                  <p className="text-gray-300">a website that builds trust and credibility</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Faster response times</span>
                  <p className="text-gray-300">instant email alerts mean leads are followed up quickly</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            Jones Legacy Creations now has a website that works as hard as they do — capturing clean leads, delivering them instantly, and presenting the business in the best possible light.
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
            I help businesses build websites with smart forms that capture better leads, reduce errors, and automate follow-ups.
          </p>
          <p className="text-white text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
            If your contact forms are letting bad data through or your leads are slipping away, let's fix that. I'll build a solution tailored to your workflow — just like I did for Jones Legacy Creations.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="bg-yellow text-blue font-semibold px-8 py-4 rounded-lg shadow-lg hover:bg-yellow/80 transition-all text-lg"
            >
              Start Your Project →
            </Link>
            <a
              href="https://joneslegacycreations.com"
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
