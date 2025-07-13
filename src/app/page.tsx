"use client";

import { TypewriterText } from "@/components/Typewriter";
import { motion } from "framer-motion";
import ThreeBackground from "@/components/ThreeBackground";
import Image from "next/image";
import ScrollCue from "@/components/ScrollCue";
import { Variants } from "framer-motion";

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
    <main className="flex min-h-screen flex-col items-center justify-center px-4 pt-24 text-center text-offwhite  overflow-x-hidden overflow-y-auto">
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

      <ScrollCue />
    </main>
  );
}
