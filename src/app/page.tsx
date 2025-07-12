"use client";

import { TypewriterText } from "@/components/Typewriter";
import { motion } from "framer-motion";
import ThreeBackground from "@/components/ThreeBackground";
import Image from "next/image";
import Footer from "@/components/Footer";
import ScrollCue from "@/components/ScrollCue";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 pt-24 text-center bg-transparent text-offwhite">
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        whileInView={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8 }}
      >
        <ThreeBackground />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="space-y-6 mb-28"
      >
        <h1 className="text-yellow text-4xl md:text-6xl font-bold mt-64">
          <TypewriterText />
        </h1>
        <p className="max-w-xl text-yellow mx-auto text-lg md:text-xl text-yellow">
          I build full-stack websites, dashboards, and internal tools that help
          small businesses run smoother.
        </p>
        <div className="flex justify-center gap-4 pt-6">
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
        </div>
                          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-16 h-1 bg-gradient-to-r from-yellow to-white rounded-full animate-pulse mb-8" />

      </motion.div>

      {/* Avatar + Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.6 }}
        className="relative mt-64 w-full max-w-4xl px-6 z-10"
      >

        <div className="relative bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-8 md:p-12 shadow-xl">
          {/* Avatar Floating In */}
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-28 h-28 rounded-full overflow-hidden border-4 border-yellow shadow-md bg-offwhite"
          >
            <Image
              src="/reece-avatar.png"
              alt="Reece Nunez"
              width={112}
              height={112}
              className="object-cover w-full h-full"
              priority
            />
          </motion.div>


          <h2 className="text-3xl md:text-4xl font-bold text-yellow mb-6 tracking-tight mt-16">
            Welcome to NunezDev
          </h2>

          <p className="text-offwhite text-base md:text-lg leading-loose">
            I’m{" "}
            <span className="relative inline-block font-semibold text-yellow hover:animate-pulse">
              Reece Nunez
              <span className="absolute bottom-0 left-0 w-full h-[2px] bg-yellow animate-glow" />
            </span>
            — a self-taught full-stack developer, small business owner, and
            solutions-focused builder. I founded NunezDev to help businesses like
            yours go beyond templates and launch with purpose-built tools. Whether
            it’s a blazing-fast website, a dashboard to manage operations, or
            automation to save time — I craft systems that make your work life
            easier.
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
      <Footer />
      <ScrollCue />
    </main>
    
  );
}
