"use client";

import { motion } from "framer-motion";
import ThreeBackground from "@/components/ThreeBackground";
import Image from "next/image";
import Link from "next/link";
import Hero from "@/components/Hero";
import { Variants } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBolt,
  faHandshake,
  faWrench,
  faRocket,
  faLightbulb,
  faThumbsUp,
} from "@fortawesome/free-solid-svg-icons";
import { services } from "@/data/services";
import { projects } from "@/data/projects";
import StatsSection from "@/components/StatsSection";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" },
  },
};

export default function HomeClient() {
  return (
    <main className="flex min-h-screen flex-col items-center text-center text-offwhite overflow-hidden">
      <ThreeBackground />

      <Hero />

      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.15 } },
        }}
        className="relative w-full max-w-5xl px-4 sm:px-6 z-10 py-16 sm:py-24"
      >
        <div className="relative bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-6 sm:p-10 md:p-16 shadow-xl">
          <div className="flex flex-col md:flex-row gap-8 md:gap-16 items-center md:items-start">
            {/* Left — Avatar */}
            <motion.div
              variants={fadeInUp}
              className="flex flex-col items-center shrink-0"
            >
              <div className="w-32 sm:w-40 md:w-44 h-32 sm:h-40 md:h-44 rounded-full overflow-hidden border-4 border-yellow shadow-[0_0_30px_rgba(255,195,18,0.3)] animate-pulse-glow">
                <Image
                  src="/reece-avatar.png"
                  alt="Reece Nunez"
                  width={176}
                  height={176}
                  className="object-cover w-full h-full"
                  loading="lazy"
                />
              </div>
              <h3 className="text-yellow font-bold text-xl mt-4">
                Reece Nunez
              </h3>
              <p className="text-white/60 text-sm tracking-wide uppercase">
                Full-Stack Developer
              </p>
            </motion.div>

            {/* Right — Content */}
            <div className="flex flex-col text-center md:text-left">
              <motion.p
                variants={fadeInUp}
                className="text-yellow/70 text-sm uppercase tracking-widest font-medium mb-2"
              >
                Meet the developer behind NunezDev
              </motion.p>

              <motion.h2
                variants={fadeInUp}
                className="text-2xl sm:text-3xl md:text-4xl font-bold text-yellow mb-6 tracking-tight"
              >
                Built Different.
                <br />
                Built to Last.
              </motion.h2>

              <motion.p
                variants={fadeInUp}
                className="text-white/80 text-base md:text-lg leading-relaxed mb-8"
              >
                I founded NunezDev to help businesses go beyond templates and
                launch with purpose-built tools. Whether it&apos;s a blazing-fast
                website, a dashboard to manage operations, or automation to save
                time — I craft systems that make your work life easier.
              </motion.p>

              <motion.div
                variants={fadeInUp}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="self-center md:self-start"
              >
                <a
                  href="/about"
                  className="inline-block bg-yellow text-gray-900 font-semibold px-7 py-3 rounded-lg shadow hover:shadow-[0_0_20px_rgba(255,195,18,0.3)] transition-shadow duration-300"
                >
                  Learn More About Me
                </a>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.section>

      <StatsSection />

      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.1 } },
        }}
        className="relative w-full max-w-6xl px-4 sm:px-6 z-10 py-16 sm:py-24"
      >
        <motion.p
          variants={fadeInUp}
          className="text-yellow/70 text-sm uppercase tracking-widest font-medium text-center mb-2"
        >
          Services
        </motion.p>
        <motion.h2
          variants={fadeInUp}
          className="text-2xl sm:text-3xl md:text-5xl font-bold text-yellow text-center mb-4 tracking-tight"
        >
          What I Can Build For You
        </motion.h2>
        <motion.p
          variants={fadeInUp}
          className="text-white/50 text-base md:text-lg text-center max-w-2xl mx-auto mb-14"
        >
          From concept to launch — every project is custom-built for your
          business.
        </motion.p>

        <motion.div
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08 } },
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {services.map((service) => (
            <motion.div
              key={service.slug}
              variants={fadeInUp}
              whileHover={{ scale: 1.03 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Link
                href={`/services/${service.slug}`}
                className="block h-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 text-left hover:border-yellow/50 hover:shadow-[0_0_25px_rgba(255,195,18,0.15)] transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-full bg-yellow/10 flex items-center justify-center mb-5">
                  <FontAwesomeIcon
                    icon={service.icon}
                    className="text-yellow text-xl"
                  />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">
                  {service.title}
                </h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  {service.shortDescription}
                </p>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          variants={fadeInUp}
          className="text-center mt-12"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="inline-block"
          >
            <a
              href="/services"
              className="inline-block bg-yellow text-gray-900 font-semibold px-7 py-3 rounded-lg shadow hover:shadow-[0_0_20px_rgba(255,195,18,0.3)] transition-shadow duration-300"
            >
              See Full Service Breakdown
            </a>
          </motion.div>
        </motion.div>
      </motion.section>

      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.1 } },
        }}
        className="relative w-full max-w-6xl px-4 sm:px-6 z-10 py-16 sm:py-24"
      >
        <motion.p
          variants={fadeInUp}
          className="text-yellow/70 text-sm uppercase tracking-widest font-medium text-center mb-2"
        >
          Why NunezDev
        </motion.p>
        <motion.h2
          variants={fadeInUp}
          className="text-2xl sm:text-3xl md:text-5xl font-bold text-yellow text-center mb-4 tracking-tight"
        >
          Why Choose Reece?
        </motion.h2>
        <motion.p
          variants={fadeInUp}
          className="text-white/50 text-base md:text-lg text-center max-w-2xl mx-auto mb-14"
        >
          No agencies, no middlemen, no templates — just a senior developer who
          ships quality work on time.
        </motion.p>

        <motion.div
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08 } },
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
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
              whileHover={{ scale: 1.03 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 text-left hover:border-yellow/50 hover:shadow-[0_0_25px_rgba(255,195,18,0.15)] transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-full bg-yellow/10 flex items-center justify-center mb-5">
                <FontAwesomeIcon
                  icon={point.icon}
                  className="text-yellow text-xl"
                />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">
                {point.title}
              </h3>
              <p className="text-white/60 text-sm leading-relaxed">
                {point.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div variants={fadeInUp} className="text-center mt-12">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="inline-block"
          >
            <a
              href="/about"
              className="inline-block bg-yellow text-gray-900 font-semibold px-7 py-3 rounded-lg shadow hover:shadow-[0_0_20px_rgba(255,195,18,0.3)] transition-shadow duration-300"
            >
              Learn More About Me
            </a>
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Recent Projects */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.1 } },
        }}
        className="relative w-full max-w-6xl px-4 sm:px-6 z-10 py-16 sm:py-24"
      >
        <motion.p
          variants={fadeInUp}
          className="text-yellow/70 text-sm uppercase tracking-widest font-medium text-center mb-2"
        >
          Portfolio
        </motion.p>
        <motion.h2
          variants={fadeInUp}
          className="text-2xl sm:text-3xl md:text-5xl font-bold text-yellow text-center mb-4 tracking-tight"
        >
          Recent Projects
        </motion.h2>
        <motion.p
          variants={fadeInUp}
          className="text-white/50 text-base md:text-lg text-center max-w-2xl mx-auto mb-14"
        >
          A look at some of the custom solutions I&apos;ve built for businesses
          across the country.
        </motion.p>

        <motion.div
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08 } },
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
        >
          {projects.slice(0, 4).map((project) => (
            <motion.div
              key={project.slug}
              variants={fadeInUp}
              whileHover={{ scale: 1.03 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Link
                href={`/portfolio/${project.slug}`}
                className="block h-full bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden text-left hover:border-yellow/50 hover:shadow-[0_0_25px_rgba(255,195,18,0.15)] transition-all duration-300 group"
              >
                <div className="h-2 bg-gradient-to-r from-yellow to-yellow/40" />
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

        <motion.div variants={fadeInUp} className="text-center mt-12">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="inline-block"
          >
            <Link
              href="/portfolio"
              className="inline-block bg-yellow text-gray-900 font-semibold px-7 py-3 rounded-lg shadow hover:shadow-[0_0_20px_rgba(255,195,18,0.3)] transition-shadow duration-300"
            >
              View Full Portfolio
            </Link>
          </motion.div>
        </motion.div>
      </motion.section>

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
        <p className="text-white text-lg mb-6">
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
            className="border border-offwhite text-white font-semibold px-6 py-3 rounded-lg hover:bg-white hover:text-gray-800 transition"
          >
            View Pricing
          </a>
        </div>
      </motion.div>

    </main>
  );
}
