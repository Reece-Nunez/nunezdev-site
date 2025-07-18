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

export default function AboutClient() {
  return (
    <main className="bg-black min-h-screen px-4 sm:px-6 py-24 mx-auto text-offwhite overflow-x-hidden">
      {/* Section Heading */}
      <motion.div
        initial={{ opacity: 0, y: -40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center mb-16 mt-24"
      >
        <h1 className="text-yellow text-3xl sm:text-4xl md:text-6xl font-bold tracking-tight mb-2">
          Meet Reece Nunez
        </h1>
        <div className="mx-auto w-24 h-1 bg-gradient-to-r from-yellow to-white rounded-full animate-pulse" />
      </motion.div>

      {/* Hero Section */}
      <motion.section
        initial="hidden"
        animate="show"
        variants={containerVariants}
        className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start max-w-6xl mx-auto"
      >
        {/* Profile + Family Images */}
        <motion.div
          variants={fadeInUp}
          className="flex flex-col items-center space-y-10 w-full"
        >
          {/* Avatar Image */}
          <div className="relative w-48 sm:w-64 md:w-80 aspect-square rounded-full overflow-hidden border-4 border-yellow shadow-xl">
            <Image
              src="/reece-avatar.png"
              alt="Reece Nunez"
              fill
              className="object-cover"
              priority
            />
          </div>

          {/* Family Image */}
          <div className="relative w-full max-w-md aspect-video overflow-hidden rounded-lg">
            <Image
              src="/family.jpg"
              alt="Reece and Family"
              fill
              className="object-cover"
              style={{
                filter:
                  "brightness(0.98) drop-shadow(0 0 10px rgba(255, 255, 0, 0.3))",
              }}
              priority
            />
          </div>
        </motion.div>

        {/* Text Content */}
        <motion.div
          variants={fadeInUp}
          className="space-y-10 text-base sm:text-lg leading-relaxed w-full"
        >
          <section className="space-y-4">
            <p>
              Hey! I’m Reece — a husband, dad of four, and full-time software
              problem solver. I started{" "}
              <span className="text-yellow font-semibold">NunezDev</span> to
              help small businesses like yours build custom software that fits
              your unique needs.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg sm:text-xl font-bold text-yellow">
              A Bit About Me
            </h2>
            <p>
              Since marrying my incredible wife in 2011, life has taken us from
              the mountains of Utah to the wide skies of Texas and Alaska. We’ve
              now planted roots in Oklahoma on a 10-acre homestead with our
              extended family — raising animals, chasing sunsets, and doing our
              best to keep up with four amazing kids.
            </p>
            <p>
              When I’m not coaching soccer or baseball, you’ll probably find me
              outdoors, on a bike, or rewatching Star Wars, Harry Potter, or
              LOTR (yes, I’m that kind of nerd).
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg sm:text-xl font-bold text-yellow">
              What I Love to Build
            </h2>
            <p>
              I absolutely love building full-stack software solutions from
              scratch — turning an idea into something real and functional is
              deeply fulfilling. Whether it’s a quote builder, CRM tool, or
              client dashboard, I’m here to help you create something practical
              and powerful.
            </p>
            <p>
              Good software is built with empathy, creativity, and purpose. I’d
              love to help bring your vision to life.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg sm:text-xl font-bold text-yellow">
              Who I Work With
            </h2>
            <p>
              From construction firms to homesteaders, I’ve built platforms that
              simplify complex workflows — everything from custom dashboards to
              portals and CMS integrations — always tailored to real business
              needs.
            </p>
          </section>

          <section className="space-y-4">
            <p>
              I’m also a country-living builder at heart. Whether I&#39;m
              writing code, hiking Oklahoma trails, or coaching my kids&#39;
              teams, I bring the same focus and grit to every project I take on.
            </p>
            <p>
              I started NunezDev not just to build websites — but to build
              <span className="text-yellow font-semibold">
                {" "}
                real solutions
              </span>{" "}
              that respect your time, budget, and goals.
            </p>
          </section>

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
