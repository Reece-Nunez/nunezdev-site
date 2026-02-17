"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import ThreeBackground from "@/components/ThreeBackground";

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8 },
  },
};

export default function MeridianCaseStudy() {
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
          Building a Full-Stack Travel Platform: How Custom Web Development Transformed Meridian Luxury Travel
        </h1>
        <p className="max-w-3xl text-white mx-auto text-lg md:text-xl">
          A complete custom web application that automated bookings, integrated payments, and streamlined operations for a luxury travel business.
        </p>
      </motion.div>

      {/* Main Content */}
      <div className="relative w-full max-w-4xl px-6 z-10 space-y-12">

        {/* Hero Image */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeInUp}
          className="relative w-full h-64 md:h-96 rounded-2xl overflow-hidden shadow-xl"
        >
          <Image
            src="/images/meridian.png"
            alt="Meridian Luxury Travel Platform"
            fill
            className="object-cover"
            priority
          />
        </motion.div>

        {/* The Challenge */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-8 md:p-12 shadow-xl"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            The Challenge: Outgrowing Cookie-Cutter Solutions
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6">
            Meridian Luxury Travel came to me with a familiar problem: their existing tools couldn't keep up with their business. They relied on static websites and third-party platforms that were expensive, rigid, and frustrating to manage.
          </p>
          <p className="text-white text-lg leading-relaxed mb-6">
            They needed more than a website — they needed a custom platform that could:
          </p>
          <ul className="space-y-3 text-white text-lg">
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Automate personalized quote requests</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Handle secure payment processing</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Manage content and pricing dynamically</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Give their team a powerful dashboard for daily operations</span>
            </li>
          </ul>
          <p className="text-white text-lg leading-relaxed mt-6">
            In short, they needed software that worked the way their business worked, instead of forcing them into someone else's system.
          </p>
        </motion.section>

        {/* Solution Overview with Image */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-8 md:p-12 shadow-xl"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            The Solution: A Custom Web Application
          </h2>
          <p className="text-white text-lg leading-relaxed mb-8">
            I designed and built a full-stack web application tailored to Meridian's exact workflows. The platform combines sleek design with powerful functionality, allowing them to deliver the luxury experience their clients expect while streamlining internal processes.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="relative h-64 rounded-xl overflow-hidden shadow-lg">
              <Image
                src="/images/meridian1.png"
                alt="Meridian Travel Platform Dashboard"
                fill
                className="object-cover"
              />
            </div>
            <div className="relative h-64 rounded-xl overflow-hidden shadow-lg">
              <Image
                src="/images/meridian2.png"
                alt="Meridian Travel Quote System"
                fill
                className="object-cover"
              />
            </div>
          </div>
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
              <h3 className="text-xl font-semibold text-yellow mb-2">Automated Quotes to Bookings</h3>
              <p className="text-white leading-relaxed">Clients request personalized trips, and the system generates quotes, processes payments, and confirms bookings automatically.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Secure Payment Integration</h3>
              <p className="text-white leading-relaxed">Built with Stripe, ensuring reliable transactions and real-time booking updates.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Custom Content Management</h3>
              <p className="text-white leading-relaxed">A simple, non-technical CMS so their team can update destinations, itineraries, and pricing with ease.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Admin Dashboard</h3>
              <p className="text-white leading-relaxed">A single place to track payments, manage quotes, build itineraries, and access analytics — essentially a travel ERP system designed for them.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Responsive, High-Performance Design</h3>
              <p className="text-white leading-relaxed">Optimized for SEO, fast load times, and a smooth mobile experience.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
            <div className="relative h-64 rounded-xl overflow-hidden shadow-lg">
              <Image
                src="/images/meridian3.png"
                alt="Meridian Travel Content Management"
                fill
                className="object-cover"
              />
            </div>
            <div className="relative h-64 rounded-xl overflow-hidden shadow-lg">
              <Image
                src="/images/meridian4.png"
                alt="Meridian Travel Mobile Experience"
                fill
                className="object-cover"
              />
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
            While the client doesn't need to know every technical detail, it's important to highlight the modern stack that powers this platform:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Next.js + React</span>
                <span className="text-gray-300">for speed, SEO, and scalability</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Supabase (PostgreSQL + auth)</span>
                <span className="text-gray-300">for reliable database management</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Stripe API</span>
                <span className="text-gray-300">for secure, automated payments</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Tailwind CSS & Framer Motion</span>
                <span className="text-gray-300">for modern, responsive UI</span>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            This stack ensures the platform is not only robust today but also scales easily as Meridian grows.
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
            The new platform transformed how Meridian operates:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">No more manual quote processing</span>
                  <p className="text-gray-300">saving hours of admin time every week</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Integrated payments</span>
                  <p className="text-gray-300">smoother cash flow and fewer errors</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Dynamic content</span>
                  <p className="text-gray-300">faster updates and better SEO visibility</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Seamless mobile experience</span>
                  <p className="text-gray-300">improved customer satisfaction</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            Instead of wrestling with tools that don't fit, their team now runs on a custom-built system that adapts to them.
          </p>
        </motion.section>

        {/* Why This Matters */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-8 md:p-12 shadow-xl"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            Why This Matters for Growing Businesses
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6">
            This project highlights the difference between a template site and a custom solution. Templates are fine when you're starting out, but as soon as your workflows get complex, they hold you back.
          </p>
          <p className="text-white text-lg leading-relaxed mb-6">
            Custom development ensures your tools:
          </p>
          <ul className="space-y-3 text-white text-lg mb-6">
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Scale with your business</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Automate your most time-consuming tasks</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Give you unique advantages competitors can't copy</span>
            </li>
          </ul>
          <p className="text-white text-lg leading-relaxed">
            For Meridian, that meant turning a clunky process into a smooth, modern experience — and positioning their brand as a leader in luxury travel.
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
            I help small businesses and startups build custom web applications that save time, reduce manual work, and deliver better customer experiences.
          </p>
          <p className="text-white text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
            If your current software is holding you back, let's talk. I'll help design a solution tailored to your business — just like I did for Meridian Luxury Travel.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="bg-yellow text-blue font-semibold px-8 py-4 rounded-lg shadow-lg hover:bg-yellow/80 transition-all text-lg"
            >
              Start Your Project →
            </Link>
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