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

export default function RefinerySchedulerCaseStudy() {
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
          Refinery Scheduler: Safety-Compliant Workforce Scheduling System
        </h1>
        <p className="max-w-3xl text-white mx-auto text-lg md:text-xl">
          An automated scheduling system built for oil refinery operations that enforces RP-755 fatigue policies, prevents scheduling conflicts, and ensures regulatory compliance across complex shift patterns.
        </p>
        <a
          href="https://github.com/Reece-Nunez/refinery-scheduler"
          target="_blank"
          rel="noopener noreferrer"
          className="text-yellow/70 hover:text-yellow transition text-base"
        >
          View on GitHub →
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
            The Challenge: Manual Scheduling in a High-Stakes Environment
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6">
            Managing workforce scheduling at an oil refinery is not like scheduling shifts at a retail store. The stakes are significantly higher — fatigue-related errors can lead to safety incidents, environmental violations, and regulatory penalties.
          </p>
          <p className="text-white text-lg leading-relaxed mb-6">
            The refinery was managing complex shift schedules manually, which created serious risks:
          </p>
          <ul className="space-y-3 text-white text-lg">
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>No automated enforcement of RP-755 fatigue management regulations</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Duplicate shift assignments and day/night scheduling conflicts going undetected</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Consecutive day limits being exceeded without warning</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Hours spent each week building and validating schedules by hand</span>
            </li>
          </ul>
          <p className="text-white text-lg leading-relaxed mt-6">
            One scheduling mistake could put workers at risk and expose the operation to serious compliance violations.
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
            The Solution: Automated Scheduling with Built-In Safety Validation
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6">
            I designed and built an automated scheduling system with safety compliance baked into every layer. The platform validates every shift assignment against RP-755 fatigue policies, detects conflicts before they happen, and enforces consecutive day limits based on operator classification.
          </p>
          <p className="text-white text-lg leading-relaxed mb-6">
            Schedulers now work with a visual calendar interface that flags violations in real time, preventing unsafe schedules from ever being published. The system understands the difference between regular operators and APS Green Hat trainees, applying the correct limits to each.
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
              <h3 className="text-xl font-semibold text-yellow mb-2">Multi-Day Shift Scheduling</h3>
              <p className="text-white leading-relaxed">Interactive calendar view powered by React Big Calendar, allowing schedulers to create, edit, and manage multi-day shift assignments with drag-and-drop simplicity.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">RP-755 Fatigue Policy Compliance</h3>
              <p className="text-white leading-relaxed">Every schedule is validated against API RP-755 recommended practices for fatigue risk management, ensuring workers get adequate rest between shifts.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Conflict Detection</h3>
              <p className="text-white leading-relaxed">Automatic detection of duplicate shift assignments and day/night shift conflicts, preventing dangerous scheduling overlaps before they reach workers.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Consecutive Day Limits</h3>
              <p className="text-white leading-relaxed">Enforces maximum consecutive working days — 4 days for regular operators and 7 days for APS Green Hat trainees — with automatic warnings when limits approach.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Job Assignment and Training Validation</h3>
              <p className="text-white leading-relaxed">Validates that operators are assigned only to jobs matching their training and certifications, preventing unqualified assignments.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Role-Based Admin Dashboard</h3>
              <p className="text-white leading-relaxed">Secure dashboard with role-based access control, giving supervisors and schedulers the appropriate level of visibility and editing capabilities.</p>
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
            The platform is built on a robust stack designed for reliability and safety-critical operations:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Next.js 15 + React 19</span>
                <span className="text-gray-300">for a fast, responsive interface</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">TypeScript</span>
                <span className="text-gray-300">for type-safe scheduling logic</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Prisma ORM</span>
                <span className="text-gray-300">for structured database access</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Supabase Auth</span>
                <span className="text-gray-300">for secure role-based access</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">React Big Calendar</span>
                <span className="text-gray-300">for visual shift management</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Headless UI</span>
                <span className="text-gray-300">for accessible UI components</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Framer Motion</span>
                <span className="text-gray-300">for smooth interface transitions</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Resend + Nodemailer</span>
                <span className="text-gray-300">for schedule notifications</span>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            Every technology choice was made with reliability in mind — in a refinery environment, the scheduling system must work correctly every time.
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
            The scheduling system transformed how the refinery manages its workforce:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Prevented fatigue violations</span>
                  <p className="text-gray-300">automated RP-755 compliance catches issues before they become safety risks</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Eliminated scheduling conflicts</span>
                  <p className="text-gray-300">no more duplicate shifts or day/night overlaps slipping through</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Ensured regulatory compliance</span>
                  <p className="text-gray-300">built-in validation means every published schedule meets safety standards</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Saved hours of manual scheduling</span>
                  <p className="text-gray-300">what took a full day now takes minutes with automated validation</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            The system replaced a risky, time-consuming manual process with an automated platform that puts worker safety first while dramatically reducing administrative burden.
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
            Ready to Transform Your Operations?
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6 max-w-2xl mx-auto">
            I build custom software for industrial operations, workforce management, and safety-critical environments where off-the-shelf tools fall short.
          </p>
          <p className="text-white text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
            If your scheduling or operational processes carry compliance risks, let's talk. I'll build a solution that enforces your safety policies automatically — just like I did for this refinery operation.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="bg-yellow text-blue font-semibold px-8 py-4 rounded-lg shadow-lg hover:bg-yellow/80 transition-all text-lg"
            >
              Start Your Project →
            </Link>
            <a
              href="https://github.com/Reece-Nunez/refinery-scheduler"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-yellow text-yellow font-semibold px-8 py-4 rounded-lg hover:bg-yellow hover:text-blue transition text-lg"
            >
              View on GitHub →
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
