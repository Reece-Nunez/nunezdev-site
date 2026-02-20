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

export default function AidooAcademicCaseStudy() {
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
          Aidoo Academic Press: Multi-Journal Publishing Platform
        </h1>
        <p className="max-w-3xl text-white mx-auto text-lg md:text-xl">
          A robust academic publishing infrastructure built on Open Journal Systems, enabling a publisher to host and manage multiple peer-reviewed journals with professional editorial workflows on dedicated server infrastructure.
        </p>
        <a
          href="https://github.com/Reece-Nunez/aidoo-academic"
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
            The Challenge: Hosting Multiple Academic Journals at Scale
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6">
            An academic publisher needed reliable infrastructure to host and manage multiple peer-reviewed journals with professional editorial workflows. Each journal required its own submission pipeline, review process, and publication schedule — all running on a single, maintainable platform.
          </p>
          <p className="text-white text-lg leading-relaxed mb-6">
            The key requirements included:
          </p>
          <ul className="space-y-3 text-white text-lg">
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Support for multiple independent journals on one platform</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Full editorial workflows from manuscript submission through peer review to publication</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Reliable server infrastructure with automated provisioning</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Database management for secure storage of submissions and reviewer data</span>
            </li>
          </ul>
          <p className="text-white text-lg leading-relaxed mt-6">
            They needed a solution that could scale as new journals were added, without requiring a complete infrastructure overhaul each time.
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
            The Solution: OJS on Dedicated Server Infrastructure
          </h2>
          <p className="text-white text-lg leading-relaxed mb-8">
            I deployed and configured Open Journal Systems (OJS) 3.5 on dedicated server infrastructure running a full LAMP stack. The platform was set up with automated server provisioning via a custom install script, Apache virtual host configuration for multi-journal routing, and MariaDB database management for reliable data storage.
          </p>
          <p className="text-white text-lg leading-relaxed">
            The result is a production-ready academic publishing platform where editors can manage submissions, coordinate peer reviews, and publish articles — all from a single administrative interface that scales effortlessly as new journals are added.
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
              <h3 className="text-xl font-semibold text-yellow mb-2">Multi-Journal Hosting on Single Platform</h3>
              <p className="text-white leading-relaxed">Multiple independent journals hosted on one OJS installation, each with its own editorial team, submission pipeline, and publication schedule — reducing overhead and simplifying maintenance.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Full Editorial Workflow</h3>
              <p className="text-white leading-relaxed">Complete submission-to-publication pipeline including manuscript intake, editorial review, revisions, copyediting, and final publication — all managed through the OJS interface.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Peer Review Management System</h3>
              <p className="text-white leading-relaxed">Built-in tools for assigning reviewers, tracking review progress, managing reviewer feedback, and coordinating revision rounds — ensuring rigorous academic standards.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Automated Server Provisioning</h3>
              <p className="text-white leading-relaxed">Custom install.sh script that automates the entire server setup process, from package installation to OJS configuration — making deployments repeatable and reliable.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Apache Virtual Host Configuration</h3>
              <p className="text-white leading-relaxed">Properly configured Apache virtual hosts enabling clean URL routing for each journal, with SSL support and optimized performance settings.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">MariaDB Database Management</h3>
              <p className="text-white leading-relaxed">Secure and optimized MariaDB database configuration for storing submissions, user accounts, review data, and publication metadata with automated backups.</p>
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
            The Aidoo Academic Press platform runs on a battle-tested LAMP stack, chosen for its reliability and compatibility with the Open Journal Systems ecosystem:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Open Journal Systems (OJS) 3.5</span>
                <span className="text-gray-300">for journal management</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Ubuntu 24.04 LTS</span>
                <span className="text-gray-300">for server OS</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Apache 2.4</span>
                <span className="text-gray-300">for web server</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">PHP 8.3</span>
                <span className="text-gray-300">for application runtime</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">MariaDB 10.11</span>
                <span className="text-gray-300">for database management</span>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            This LAMP stack provides the stability and long-term support that academic publishing demands, with each component chosen for its proven track record in production environments.
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
            The platform transformed how Aidoo Academic Press manages its publishing operations:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Streamlined publication workflow</span>
                  <p className="text-gray-300">from manuscript submission to published article, all in one place</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Professional journal management</span>
                  <p className="text-gray-300">editorial teams can manage reviews and publications independently</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Scalable infrastructure</span>
                  <p className="text-gray-300">new journals can be added without rebuilding the platform</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Automated provisioning</span>
                  <p className="text-gray-300">repeatable deployments reduce setup time and human error</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            Aidoo Academic Press now has a reliable, scalable publishing infrastructure that grows with their journal portfolio.
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
            I help businesses build and deploy custom platforms that streamline their operations and scale with their growth.
          </p>
          <p className="text-white text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
            Whether you need a publishing platform, server infrastructure, or a custom web application, let's talk. I'll design a solution tailored to your business — just like I did for Aidoo Academic Press.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="bg-yellow text-blue font-semibold px-8 py-4 rounded-lg shadow-lg hover:bg-yellow/80 transition-all text-lg"
            >
              Start Your Project →
            </Link>
            <a
              href="https://github.com/Reece-Nunez/aidoo-academic"
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
