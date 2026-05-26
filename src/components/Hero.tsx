"use client";

import { useEffect, useState } from "react";
import { TypewriterText } from "@/components/Typewriter";
import { motion, Variants, AnimatePresence } from "framer-motion";
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
  // Hint reveals the ParticleLogo is interactive — most visitors miss this
  // on a static glance. Auto-hides after 6s OR when the user actually
  // moves their mouse over the logo (whichever first).
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const reveal = window.setTimeout(() => setShowHint(true), 1200);
    const hide = window.setTimeout(() => setShowHint(false), 7200);
    return () => {
      window.clearTimeout(reveal);
      window.clearTimeout(hide);
    };
  }, []);

  return (
    <section className="relative min-h-[85vh] flex items-center px-4 sm:px-8 lg:px-16 pt-24 pb-12 w-full">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center"
      >
        {/* Left column — copy biased to ~60% width */}
        <div className="lg:col-span-7 text-center lg:text-left">
          <motion.h1
            variants={fadeInUp}
            className="text-yellow text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]"
          >
            Code That Builds
            <br />
            Businesses.
          </motion.h1>

          <motion.div
            variants={fadeInUp}
            className="text-white/90 text-lg sm:text-2xl md:text-3xl font-medium h-8 sm:h-10 mt-6"
          >
            <TypewriterText />
          </motion.div>

          <motion.p
            variants={fadeInUp}
            className="text-white/70 text-base md:text-lg max-w-xl mt-6 mx-auto lg:mx-0"
          >
            Custom websites, dashboards, and automation built one-on-one for
            small businesses. No agencies, no templates, no offshore.
          </motion.p>

          <motion.div
            variants={fadeInUp}
            className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-4 mt-10"
          >
            <a
              href="/contact"
              onClick={() => trackEvent("book_consult_click", { location: "hero" })}
              className="bg-yellow text-blue font-semibold px-6 sm:px-8 py-3 sm:py-3.5 rounded-lg hover:bg-yellow/80 transition-colors text-base sm:text-lg text-center"
            >
              Book a Free Consult &rarr;
            </a>
            <a
              href="/pricing"
              className="text-base sm:text-lg text-white border border-white/40 px-6 sm:px-8 py-3 sm:py-3.5 rounded-lg font-semibold hover:bg-white hover:text-gray-800 transition-colors text-center"
            >
              See Pricing
            </a>
          </motion.div>
        </div>

        {/* Right column — ParticleLogo pinned right + interactivity hint */}
        <motion.div
          variants={fadeInUp}
          className="lg:col-span-5 hidden lg:flex flex-col items-center justify-center relative"
          onMouseEnter={() => setShowHint(false)}
        >
          <ParticleLogo src="/n-logo-big.svg" width={360} height={360} />
          <AnimatePresence>
            {showHint && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="absolute bottom-0 text-white/40 text-xs uppercase tracking-[0.2em] pointer-events-none select-none"
              >
                &uarr; try moving your mouse
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Mobile only — smaller logo above heading */}
        <motion.div
          variants={fadeInUp}
          className="lg:hidden flex justify-center -order-1"
        >
          <ParticleLogo src="/n-logo-big.svg" width={160} height={160} />
        </motion.div>
      </motion.div>

      <ScrollCue />
    </section>
  );
}
