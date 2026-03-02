"use client";

import { TypewriterText } from "@/components/Typewriter";
import { motion, Variants } from "framer-motion";
import Image from "next/image";
import ScrollCue from "@/components/ScrollCue";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" as const },
  },
};

const stagger: Variants = {
  visible: {
    transition: { staggerChildren: 0.15 },
  },
};

export default function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="flex flex-col items-center space-y-8"
      >
        <motion.div variants={fadeInUp}>
          <Image
            src="/n-logo.svg"
            alt="NunezDev logo"
            width={120}
            height={120}
            priority
            className="mx-auto drop-shadow-lg"
          />
        </motion.div>

        <motion.h1
          variants={fadeInUp}
          className="text-yellow text-5xl md:text-7xl font-bold tracking-tight leading-tight"
        >
          Code That Builds
          <br />
          Businesses.
        </motion.h1>

        <motion.div
          variants={fadeInUp}
          className="text-white/90 text-2xl md:text-3xl font-medium h-10"
        >
          <TypewriterText />
        </motion.div>

        <motion.p
          variants={fadeInUp}
          className="max-w-xl text-white/70 mx-auto text-base md:text-lg"
        >
          Full-stack websites, dashboards, and internal tools that help small
          businesses run smoother.
        </motion.p>

        <motion.div
          variants={fadeInUp}
          className="flex flex-col sm:flex-row justify-center gap-4 pt-4"
        >
          <a
            href="/pricing"
            className="bg-yellow text-blue font-semibold px-8 py-3.5 rounded-lg shadow hover:bg-yellow/80 transition-all text-lg"
          >
            View Pricing
          </a>
          <a
            href="/contact"
            className="text-lg text-white border border-white/40 px-8 py-3.5 rounded-lg font-semibold hover:bg-white hover:text-gray-800 transition"
          >
            Contact Me
          </a>
        </motion.div>
      </motion.div>

      <ScrollCue />
    </section>
  );
}
