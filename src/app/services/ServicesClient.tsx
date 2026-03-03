"use client";

import { motion, Variants } from "framer-motion";
import Link from "next/link";
import ThreeBackground from "@/components/ThreeBackground";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { services } from "@/data/services";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" as const },
  },
};

export default function ServicesClient() {
  return (
    <main className="flex min-h-screen flex-col items-center px-4 pt-32 pb-24 text-offwhite overflow-hidden">
      <ThreeBackground />

      {/* Hero */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.12 } },
        }}
        className="max-w-4xl text-center mb-16 z-10"
      >
        <motion.p
          variants={fadeInUp}
          className="text-yellow/70 text-sm uppercase tracking-widest font-medium mb-3"
        >
          What I Do
        </motion.p>
        <motion.h1
          variants={fadeInUp}
          className="text-yellow text-3xl sm:text-4xl md:text-6xl font-bold tracking-tight mb-6"
        >
          Full-Stack Development Services
        </motion.h1>
        <motion.p
          variants={fadeInUp}
          className="text-white/60 text-lg md:text-xl max-w-2xl mx-auto"
        >
          From custom websites to complex web applications — everything is
          hand-coded, purpose-built, and engineered to grow with your business.
        </motion.p>
      </motion.div>

      {/* Services Grid */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.08 } },
        }}
        className="w-full max-w-6xl z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16"
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
              <h2 className="text-white font-semibold text-lg mb-2">
                {service.title}
              </h2>
              <p className="text-white/60 text-sm leading-relaxed mb-4">
                {service.shortDescription}
              </p>
              <span className="text-yellow text-sm font-medium">
                Learn more &rarr;
              </span>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {/* CTA */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        variants={fadeInUp}
        className="text-center z-10 py-12"
      >
        <h3 className="text-2xl md:text-3xl font-bold text-yellow mb-4">
          Not sure what you need?
        </h3>
        <p className="text-white/60 text-lg mb-8">
          Let&apos;s talk through your project and figure out the right solution
          together.
        </p>
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          className="inline-block"
        >
          <Link
            href="/contact"
            className="inline-block bg-yellow text-gray-900 font-semibold px-8 py-3.5 rounded-lg shadow hover:shadow-[0_0_20px_rgba(255,195,18,0.3)] transition-shadow duration-300 text-lg"
          >
            Contact Me
          </Link>
        </motion.div>
      </motion.div>
    </main>
  );
}
