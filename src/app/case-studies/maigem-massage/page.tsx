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

export default function MaigemMassageCaseStudy() {
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
          Maigem Massage: Full-Stack Booking Platform with Integrated Payments
        </h1>
        <p className="max-w-3xl text-white mx-auto text-lg md:text-xl">
          A custom booking platform that replaced phone-and-text scheduling with real-time availability, online appointment booking, and integrated Square payments — giving a massage therapist back hours of their week.
        </p>
        <a
          href="https://maigemassage.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-yellow/70 hover:text-yellow transition text-base"
        >
          maigemassage.com →
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
            The Challenge: Manual Booking Chaos
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6">
            Maigem Massage was managing their entire booking operation through phone calls and text messages. The therapist was spending hours each week coordinating schedules, chasing confirmations, and handling payments in person. Double bookings happened. Appointments were forgotten. Revenue was left on the table when clients couldn't easily book or pay.
          </p>
          <p className="text-white text-lg leading-relaxed mb-6">
            They needed a system that could:
          </p>
          <ul className="space-y-3 text-white text-lg">
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Show real-time availability so clients can self-book</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Process payments and deposits online to reduce no-shows</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Send automated confirmations so nothing falls through the cracks</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Eliminate scheduling conflicts and double bookings permanently</span>
            </li>
          </ul>
          <p className="text-white text-lg leading-relaxed mt-6">
            The therapist didn't need another generic scheduling tool with monthly fees — they needed a custom platform built around how they actually run their practice.
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
            The Solution: A Custom Booking Platform
          </h2>
          <p className="text-white text-lg leading-relaxed mb-8">
            I designed and built a full-stack booking platform tailored to Maigem Massage's specific workflow. Clients can view real-time availability, select their preferred service and time slot, and complete payment — all in one seamless flow. The platform is backed by Supabase for reliable data management and Square for secure payment processing.
          </p>
          <p className="text-white text-lg leading-relaxed">
            Automated email confirmations go out the moment a booking is made, and the therapist has a clear view of their schedule at all times. No more back-and-forth texts, no more double bookings, and no more chasing down payments. The platform handles it all, so the therapist can focus on what they do best.
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
              <h3 className="text-xl font-semibold text-yellow mb-2">Real-Time Appointment Scheduling</h3>
              <p className="text-white leading-relaxed">An intuitive day picker powered by react-day-picker lets clients browse available dates and time slots in real time, eliminating the need for back-and-forth communication.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Square Payment Integration</h3>
              <p className="text-white leading-relaxed">Secure payment processing through Square handles deposits and full payments at the time of booking, reducing no-shows and ensuring the therapist gets paid reliably.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Supabase-Powered Appointment Database</h3>
              <p className="text-white leading-relaxed">All appointments, client information, and booking history are stored securely in Supabase with real-time sync, giving the therapist a complete view of their business at any time.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Automated Email Confirmations</h3>
              <p className="text-white leading-relaxed">Booking confirmations are sent automatically via Resend the moment an appointment is made, keeping both the client and therapist informed without any manual effort.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Timezone-Aware Scheduling</h3>
              <p className="text-white leading-relaxed">Built with date-fns for accurate timezone handling, ensuring that appointment times display correctly regardless of where the client is browsing from.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Form Validation with Zod</h3>
              <p className="text-white leading-relaxed">Every booking form submission is validated with Zod schemas, ensuring clean data and preventing incomplete or invalid bookings from entering the system.</p>
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
            A robust full-stack architecture built for real-time reliability and secure payment processing:
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
                <span className="text-white font-semibold">Supabase</span>
                <span className="text-gray-300">for auth and database</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Square API</span>
                <span className="text-gray-300">for payment processing</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">date-fns + react-day-picker</span>
                <span className="text-gray-300">for scheduling UI</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Resend</span>
                <span className="text-gray-300">for email confirmations</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Zod + Tailwind CSS 4</span>
                <span className="text-gray-300">for validation and UI</span>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            This full-stack architecture ensures that bookings are reliable, payments are secure, and the platform can scale as the practice grows.
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
            The booking platform completely transformed how Maigem Massage operates:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Eliminated scheduling conflicts</span>
                  <p className="text-gray-300">real-time availability prevents double bookings</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Automated payment collection</span>
                  <p className="text-gray-300">deposits collected at booking through Square</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Reduced no-shows</span>
                  <p className="text-gray-300">email confirmations and payment deposits ensure commitment</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Hours saved every week</span>
                  <p className="text-gray-300">no more coordinating bookings via phone and text</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            Maigem Massage now runs on a system built for their business — not a generic tool with features they don't need and limitations that hold them back. The therapist spends less time on the phone and more time doing what they love.
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
            I help service-based businesses replace manual scheduling and payment headaches with custom booking platforms that run on autopilot.
          </p>
          <p className="text-white text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
            If you're spending hours managing bookings by hand or losing money to no-shows, let's talk. I'll build a platform tailored to your workflow — just like I did for Maigem Massage.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="bg-yellow text-blue font-semibold px-8 py-4 rounded-lg shadow-lg hover:bg-yellow/80 transition-all text-lg"
            >
              Start Your Project →
            </Link>
            <a
              href="https://maigemassage.com"
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
