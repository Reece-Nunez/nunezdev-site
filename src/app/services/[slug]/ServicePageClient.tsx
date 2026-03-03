"use client";

import { motion, Variants } from "framer-motion";
import Link from "next/link";
import ThreeBackground from "@/components/ThreeBackground";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { Service } from "@/data/services";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" as const },
  },
};

export default function ServicePageClient({ service }: { service: Service }) {
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
        className="max-w-4xl text-center mb-20 z-10"
      >
        <motion.div
          variants={fadeInUp}
          className="w-16 h-16 rounded-full bg-yellow/10 flex items-center justify-center mx-auto mb-6"
        >
          <FontAwesomeIcon
            icon={service.icon}
            className="text-yellow text-2xl"
          />
        </motion.div>
        <motion.h1
          variants={fadeInUp}
          className="text-yellow text-4xl md:text-6xl font-bold tracking-tight mb-6"
        >
          {service.title}
        </motion.h1>
        <motion.p
          variants={fadeInUp}
          className="text-white/70 text-lg md:text-xl max-w-2xl mx-auto"
        >
          {service.shortDescription}
        </motion.p>
      </motion.div>

      <div className="w-full max-w-4xl z-10 space-y-12">
        {/* About */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-4">
            What You Get
          </h2>
          <p className="text-white/70 text-base md:text-lg leading-relaxed">
            {service.description}
          </p>
        </motion.section>

        {/* Features */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.06 } },
          }}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12"
        >
          <motion.h2
            variants={fadeInUp}
            className="text-2xl md:text-3xl font-bold text-yellow mb-8"
          >
            What&apos;s Included
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {service.features.map((feature) => (
              <motion.div
                key={feature}
                variants={fadeInUp}
                className="flex items-start gap-3"
              >
                <div className="w-6 h-6 rounded-full bg-yellow/10 flex items-center justify-center shrink-0 mt-0.5">
                  <FontAwesomeIcon
                    icon={faCheck}
                    className="text-yellow text-xs"
                  />
                </div>
                <span className="text-white/80 text-base">{feature}</span>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Technologies */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.05 } },
          }}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12"
        >
          <motion.h2
            variants={fadeInUp}
            className="text-2xl md:text-3xl font-bold text-yellow mb-6"
          >
            Technologies Used
          </motion.h2>
          <div className="flex flex-wrap gap-3">
            {service.technologies.map((tech) => (
              <motion.span
                key={tech}
                variants={fadeInUp}
                className="px-4 py-2 bg-yellow/10 border border-yellow/20 rounded-lg text-white/80 text-sm font-medium"
              >
                {tech}
              </motion.span>
            ))}
          </div>
        </motion.section>

        {/* Value Prop */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-sm border border-yellow/20 rounded-2xl p-8 md:p-12"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-4">
            Why This Matters
          </h2>
          <p className="text-white/70 text-base md:text-lg leading-relaxed">
            {service.valueProp}
          </p>
        </motion.section>

        {/* CTA */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeInUp}
          className="text-center py-12"
        >
          <h3 className="text-2xl md:text-3xl font-bold text-yellow mb-4">
            Ready to get started?
          </h3>
          <p className="text-white/60 text-lg mb-8">
            Let&apos;s talk about what you need and build something great.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              <Link
                href="/contact"
                className="inline-block bg-yellow text-gray-900 font-semibold px-8 py-3.5 rounded-lg shadow hover:shadow-[0_0_20px_rgba(255,195,18,0.3)] transition-shadow duration-300 text-lg"
              >
                Contact Me
              </Link>
            </motion.div>
            <Link
              href="/services"
              className="inline-block text-lg text-white border border-white/40 px-8 py-3.5 rounded-lg font-semibold hover:bg-white hover:text-gray-800 transition"
            >
              All Services
            </Link>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
