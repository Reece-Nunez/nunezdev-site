"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Variants } from "framer-motion";

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.25,
    },
  },
};

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
};


export default function AboutPage() {
  return (
    <main className="bg-black min-h-screen px-6 py-24 mx-auto text-offwhite">
      {/* Section Heading */}
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center mb-16 mt-24"
      >
        <h1 className="text-yellow text-4xl md:text-6xl font-bold tracking-tight mb-2">
          Meet Reece Nunez
        </h1>
        <div className="mx-auto w-24 h-1 bg-gradient-to-r from-yellow to-white rounded-full animate-pulse" />
      </motion.div>

      {/* Hero Section with Image */}
      <motion.section
        initial="hidden"
        animate="show"
        variants={containerVariants}
        className="grid md:grid-cols-2 gap-16 items-start"
      >
        {/* Profile Image */}
        <motion.div variants={fadeInUp} className="flex justify-center">
          <div className="relative w-96 h-96 rounded-full overflow-hidden border-4 border-yellow shadow-xl">
            <Image
              src="/reece-avatar.png"
              alt="Reece Nunez"
              fill
              className="object-cover"
              priority
            />
          </div>
        </motion.div>

        {/* Text Content */}
        <motion.div variants={fadeInUp} className="space-y-6 text-lg leading-relaxed">
          <p>
            I&#39;m <span className="text-yellow font-semibold">Reece Nunez</span>,
            a full-stack software engineer and founder of{" "}
            <span className="text-yellow font-semibold">NunezDev</span>. I earned my bachelor&#39;s degree in Software
            Engineering in March 2024 and have since been helping small
            businesses modernize and streamline their operations through
            custom-built digital tools.
          </p>

          <p>
            From construction firms to homesteaders, I’ve built platforms that
            simplify complex workflows — client dashboards, quote builders,
            CRM tools, and more — always tailored to real needs.
          </p>

          <p>
            I’m also a husband, father, and country-living builder. Whether I&#39;m
            coding, coaching soccer, hiking Oklahoma trails, or working on our
            land, I bring the same focus and grit to every project I take on.
          </p>

          <p>
            I started NunezDev not just to build software — but to build{" "}
            <span className="text-yellow font-semibold">solutions</span> that
            respect your time, budget, and vision.
          </p>

          <motion.a
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            href="/contact"
            className="inline-block mt-6 bg-yellow text-blue font-semibold px-8 py-4 rounded-lg shadow-lg hover:bg-yellow/90 transition-all"
          >
            Let’s Work Together →
          </motion.a>
        </motion.div>
      </motion.section>
    </main>
  );
}
