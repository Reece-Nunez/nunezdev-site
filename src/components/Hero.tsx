"use client";

import { TypewriterText } from "@/components/Typewriter";
import { motion, Variants } from "framer-motion";
import ScrollCue from "@/components/ScrollCue";
import ParticleLogo from "@/components/ParticleLogo";
import { trackEvent } from "@/lib/gtag";

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
        <motion.div variants={fadeInUp} className="flex justify-center">
          <div className="hidden sm:block">
            <ParticleLogo src="/n-logo-big.svg" width={280} height={280} />
          </div>
          <div className="block sm:hidden">
            <ParticleLogo src="/n-logo-big.svg" width={160} height={160} />
          </div>
        </motion.div>

        <motion.h1
          variants={fadeInUp}
          className="text-yellow text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight leading-tight"
        >
          Code That Builds
          <br />
          Businesses.
        </motion.h1>

        <motion.div
          variants={fadeInUp}
          className="text-white/90 text-lg sm:text-2xl md:text-3xl font-medium h-8 sm:h-10"
        >
          <TypewriterText />
        </motion.div>

        <motion.p
          variants={fadeInUp}
          className="max-w-xl text-white/70 mx-auto text-base md:text-lg"
        >
          Custom websites, dashboards, and automation built one-on-one for
          small businesses — no agencies, no templates, no offshore.
        </motion.p>

        <motion.div
          variants={fadeInUp}
          className="flex flex-col sm:flex-row justify-center gap-4 pt-4"
        >
          <a
            href="/contact"
            onClick={() => trackEvent("book_consult_click", { location: "hero" })}
            className="bg-yellow text-blue font-semibold px-6 sm:px-8 py-3 sm:py-3.5 rounded-lg shadow hover:bg-yellow/80 transition-all text-base sm:text-lg"
          >
            Book a Free Consult &rarr;
          </a>
          <a
            href="/pricing"
            className="text-base sm:text-lg text-white border border-white/40 px-6 sm:px-8 py-3 sm:py-3.5 rounded-lg font-semibold hover:bg-white hover:text-gray-800 transition"
          >
            See Pricing
          </a>
        </motion.div>
      </motion.div>

      <ScrollCue />
    </section>
  );
}
