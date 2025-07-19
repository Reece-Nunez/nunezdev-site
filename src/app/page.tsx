"use client";

import { TypewriterText } from "@/components/Typewriter";
import { motion } from "framer-motion";
import ThreeBackground from "@/components/ThreeBackground";
import Image from "next/image";
import ScrollCue from "@/components/ScrollCue";
import { Variants } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLaptopCode,
  faCubes,
  faChartBar,
  faCogs,
  faArrowTrendUp,
  faShieldAlt,
  faBolt,
  faHandshake,
  faWrench,
  faRocket,
  faLightbulb,
  faThumbsUp,
} from "@fortawesome/free-solid-svg-icons";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" },
  },
};

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 pt-24 text-center text-offwhite  overflow-hidden">
      <ThreeBackground />

      {/* Hero Section */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        variants={fadeInUp}
        className="space-y-6 mb-28"
      >
        <h1 className="text-yellow text-4xl md:text-6xl font-bold mt-64">
          <TypewriterText />
        </h1>

        <motion.p
          variants={fadeInUp}
          className="max-w-xl text-yellow mx-auto text-lg md:text-xl"
        >
          I build full-stack websites, dashboards, and internal tools that help
          small businesses run smoother.
        </motion.p>

        <motion.div
          variants={fadeInUp}
          className="flex justify-center gap-4 pt-6"
        >
          <a
            href="/pricing"
            className="text-lg border border-offwhite px-6 py-3 rounded-md font-semibold hover:bg-offwhite hover:text-blue transition"
          >
            View Pricing
          </a>
          <a
            href="/contact"
            className="text-lg border border-offwhite px-6 py-3 rounded-md font-semibold hover:bg-offwhite hover:text-blue transition"
          >
            Contact Me
          </a>
        </motion.div>

        <div className="absolute -bottom left-1/2 transform -translate-x-1/2 w-16 h-1 bg-gradient-to-r from-yellow to-white rounded-full animate-pulse mb-12" />
      </motion.div>

      {/* Welcome Section */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        variants={fadeInUp}
        className="relative mt-64 w-full max-w-4xl px-6 z-10"
      >
        <div className="mb-16 relative bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-8 md:p-12 shadow-xl">
          {/* Avatar Floating In */}
          <motion.div
            variants={fadeInUp}
            className="mx-auto -mt-24 mb-4 w-40 h-40 rounded-full overflow-hidden border-4 border-yellow shadow-md bg-offwhite relative z-10"
          >
            <Image
              src="/reece-avatar.png"
              alt="Reece Nunez"
              width={160}
              height={160}
              className="object-cover w-full h-full"
              loading="lazy"
            />
          </motion.div>

          <h2 className="text-3xl md:text-4xl font-bold text-yellow mb-6 tracking-tight mt-20">
            Welcome to NunezDev
          </h2>

          <p className="text-offwhite text-base md:text-lg leading-loose">
            I’m{" "}
            <span className="relative inline-block font-semibold text-yellow hover:animate-pulse">
              Reece Nunez
              <span className="absolute bottom-0 left-0 w-full h-[2px] bg-yellow animate-glow" />
            </span>{" "}
            — a full-stack developer, small business owner, and
            solutions-focused builder. I founded NunezDev to help businesses
            like yours go beyond templates and launch with purpose-built tools.
            Whether it’s a blazing-fast website, a dashboard to manage
            operations, or automation to save time — I craft systems that make
            your work life easier.
          </p>

          <div className="mt-8">
            <a
              href="/about"
              className="inline-block bg-yellow text-blue font-semibold px-6 py-3 rounded-lg shadow hover:bg-yellow/80 transition-all"
            >
              Learn More About Me →
            </a>
          </div>
        </div>
      </motion.div>
      {/* Services Section - Scrollable w/ Icons & Motion */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        variants={fadeInUp}
        className="relative mt-64 w-full px-6 z-10"
      >
        <h2 className="text-3xl md:text-4xl font-bold text-yellow mb-10 text-center">
          What I Can Build For You
        </h2>

        <motion.div
          variants={fadeInUp}
          className="relative bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-6 md:p-10 shadow-xl overflow-x-auto"
        >
          <div className="flex md:grid md:grid-cols-3 gap-6 min-w-[720px] md:min-w-full pb-4">
            {[
              {
                icon: faLaptopCode,
                title: "Custom Websites",
                description:
                  "Modern, fast websites built with Next.js & Tailwind. Perfect for marketing or service-based businesses.",
              },
              {
                icon: faCubes,
                title: "DIY Website Setup",
                description:
                  "I’ll build your site in WordPress or Framer and hand it off with full training so you stay in control.",
              },
              {
                icon: faChartBar,
                title: "Dashboards & Portals",
                description:
                  "Custom tools like lead trackers, quote builders, or client portals — tailored to your workflow.",
              },
              {
                icon: faCogs,
                title: "Automation & Integration",
                description:
                  "Stripe, AWS, Zapier, Supabase — I hook up the tech that powers your operations behind the scenes.",
              },
              {
                icon: faArrowTrendUp,
                title: "SEO & Growth Support",
                description:
                  "From local SEO to meta tags and review integration — get found online with smart optimization.",
              },
              {
                icon: faShieldAlt,
                title: "Ongoing Support",
                description:
                  "Monthly care plans to keep your site secure, updated, and evolving with your business.",
              },
            ].map((service) => (
              <motion.div
                key={service.title}
                variants={fadeInUp}
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="flex-shrink-0 w-72 md:w-full bg-black/30 border border-yellow/20 rounded-xl p-6 text-left text-offwhite shadow hover:shadow-yellow transition-shadow duration-300"
              >
                <FontAwesomeIcon
                  icon={service.icon}
                  className="text-yellow text-3xl mb-4"
                />
                <h3 className="text-yellow font-semibold text-xl mb-2">
                  {service.title}
                </h3>
                <p className="text-base leading-relaxed">
                  {service.description}
                </p>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-8">
            <a
              href="/services"
              className="inline-block bg-yellow text-blue font-semibold px-6 py-3 rounded-lg shadow hover:bg-yellow/80 transition-all"
            >
              See Full Service Breakdown →
            </a>
          </div>
        </motion.div>
      </motion.section>
      {/* Why Choose Reece Section */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        variants={fadeInUp}
        className="relative mt-64 w-full px-6 z-10"
      >
        <h2 className="text-3xl md:text-4xl font-bold text-yellow mb-10 text-center">
          Why Choose Reece?
        </h2>

        <motion.div
          variants={fadeInUp}
          className="relative bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-6 md:p-10 shadow-xl overflow-x-auto"
        >
          <div className="flex md:grid md:grid-cols-3 gap-6 min-w-[720px] md:min-w-full pb-4">
            {[
              {
                icon: faBolt,
                title: "Fast & Efficient",
                description:
                  "Quick turnarounds, optimized performance, and clean code that scales with your business.",
              },
              {
                icon: faHandshake,
                title: "Client-First Approach",
                description:
                  "I listen first, build second. Every project is custom-fit to your goals, not a template.",
              },
              {
                icon: faWrench,
                title: "Custom Built Tools",
                description:
                  "I specialize in dashboards, CRMs, portals, and backend automations that solve real problems.",
              },
              {
                icon: faRocket,
                title: "Growth-Oriented",
                description:
                  "Your site isn’t just pretty — it’s built to convert, retain clients, and grow with your brand.",
              },
              {
                icon: faLightbulb,
                title: "Creative & Technical",
                description:
                  "I blend great design with strong dev skills. No cookie-cutter solutions — just smart, creative builds.",
              },
              {
                icon: faThumbsUp,
                title: "Reliable & Honest",
                description:
                  "No upselling. No fluff. Just clear communication, transparent pricing, and results that work.",
              },
            ].map((point) => (
              <motion.div
                key={point.title}
                variants={fadeInUp}
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="flex-shrink-0 w-72 md:w-full bg-black/30 border border-yellow/20 rounded-xl p-6 text-left text-offwhite shadow hover:shadow-yellow transition-shadow duration-300"
              >
                <FontAwesomeIcon
                  icon={point.icon}
                  className="text-yellow text-3xl mb-4"
                />
                <h3 className="text-yellow font-semibold text-xl mb-2">
                  {point.title}
                </h3>
                <p className="text-base leading-relaxed">{point.description}</p>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-8">
            <a
              href="/about"
              className="inline-block bg-yellow text-blue font-semibold px-6 py-3 rounded-lg shadow hover:bg-yellow/80 transition-all"
            >
              Learn More About Me →
            </a>
          </div>
        </motion.div>
      </motion.section>

      {/* CTA After Why Choose Section */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        variants={fadeInUp}
        className="mt-24 text-center mb-12"
      >
        <h3 className="text-2xl md:text-3xl font-bold text-yellow mb-4">
          Ready to bring your vision to life?
        </h3>
        <p className="text-offwhite text-lg mb-6">
          Whether it&#39;s a website, dashboard, or full custom build — I&#39;m here to
          help you launch with confidence.
        </p>
        <div className="flex justify-center gap-4">
          <a
            href="/contact"
            className="bg-yellow text-blue font-semibold px-6 py-3 rounded-lg shadow hover:bg-yellow/80 transition-all"
          >
            Contact Me
          </a>
          <a
            href="/pricing"
            className="border border-offwhite text-offwhite font-semibold px-6 py-3 rounded-lg hover:bg-offwhite hover:text-blue transition"
          >
            View Pricing
          </a>
        </div>
      </motion.div>

      <ScrollCue />
    </main>
  );
}
