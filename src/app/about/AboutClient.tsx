"use client";

import { motion, Variants } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import ThreeBackground from "@/components/ThreeBackground";
import StatsSection from "@/components/StatsSection";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" as const },
  },
};

const techStack = [
  "Next.js",
  "React",
  "TypeScript",
  "Node.js",
  "PostgreSQL",
  "Supabase",
  "AWS",
  "Tailwind CSS",
  "Stripe",
  "Three.js",
  "Framer Motion",
  "Vercel",
  "Git",
  "REST APIs",
];

export default function AboutClient() {
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
          About
        </motion.p>
        <motion.h1
          variants={fadeInUp}
          className="text-yellow text-4xl md:text-6xl font-bold tracking-tight mb-6"
        >
          Meet Reece Nunez
        </motion.h1>
        <motion.p
          variants={fadeInUp}
          className="text-white/60 text-lg md:text-xl max-w-2xl mx-auto"
        >
          Husband, father of four, and full-stack developer building custom
          software for businesses that want more than a template.
        </motion.p>
      </motion.div>

      <div className="w-full max-w-5xl z-10 space-y-12">
        {/* Profile Card */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.15 } },
          }}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-10 md:p-16"
        >
          <div className="flex flex-col md:flex-row gap-10 md:gap-16 items-center md:items-start">
            <motion.div
              variants={fadeInUp}
              className="flex flex-col items-center shrink-0"
            >
              <div className="w-44 h-44 rounded-full overflow-hidden border-4 border-yellow animate-pulse-glow">
                <Image
                  src="/reece-avatar.png"
                  alt="Reece Nunez"
                  width={176}
                  height={176}
                  className="object-cover w-full h-full"
                  priority
                />
              </div>
              <h2 className="text-yellow font-bold text-xl mt-4">
                Reece Nunez
              </h2>
              <p className="text-white/60 text-sm tracking-wide uppercase">
                Full-Stack Developer
              </p>
            </motion.div>

            <div className="flex flex-col text-center md:text-left">
              <motion.p
                variants={fadeInUp}
                className="text-white/80 text-base md:text-lg leading-relaxed mb-4"
              >
                I started{" "}
                <span className="text-yellow font-semibold">NunezDev</span> to
                help small businesses build custom software that fits their
                unique needs. No templates, no page builders — just clean,
                hand-coded solutions engineered for your workflow.
              </motion.p>
              <motion.p
                variants={fadeInUp}
                className="text-white/80 text-base md:text-lg leading-relaxed"
              >
                I started NunezDev not just to build websites — but to build
                <span className="text-yellow font-semibold">
                  {" "}
                  real solutions
                </span>{" "}
                that respect your time, budget, and goals.
              </motion.p>
            </div>
          </div>
        </motion.section>

        {/* My Story */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.12 } },
          }}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12"
        >
          <motion.h2
            variants={fadeInUp}
            className="text-2xl md:text-3xl font-bold text-yellow mb-6"
          >
            A Bit About Me
          </motion.h2>

          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-1 space-y-4">
              <motion.p
                variants={fadeInUp}
                className="text-white/70 text-base md:text-lg leading-relaxed"
              >
                Since marrying my incredible wife in 2011, life has taken us
                from the mountains of Utah to the wide skies of Texas and
                Alaska. We&apos;ve now planted roots in Oklahoma on a 10-acre
                homestead with our extended family — raising animals, chasing
                sunsets, and doing our best to keep up with four amazing kids.
              </motion.p>
              <motion.p
                variants={fadeInUp}
                className="text-white/70 text-base md:text-lg leading-relaxed"
              >
                When I&apos;m not coaching soccer or baseball, you&apos;ll
                probably find me outdoors, on a bike, or rewatching Star Wars,
                Harry Potter, or LOTR (yes, I&apos;m that kind of nerd).
              </motion.p>
            </div>

            <motion.div
              variants={fadeInUp}
              className="w-full md:w-80 shrink-0 rounded-xl overflow-hidden border border-white/10"
            >
              <Image
                src="/family.jpg"
                alt="Reece and Family"
                width={320}
                height={213}
                className="object-cover w-full h-full"
              />
            </motion.div>
          </div>
        </motion.section>

        {/* What I Build */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.12 } },
          }}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12"
        >
          <motion.h2
            variants={fadeInUp}
            className="text-2xl md:text-3xl font-bold text-yellow mb-6"
          >
            What I Love to Build
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="text-white/70 text-base md:text-lg leading-relaxed mb-4"
          >
            I absolutely love building full-stack software solutions from
            scratch — turning an idea into something real and functional is
            deeply fulfilling. Whether it&apos;s a quote builder, CRM tool,
            client portal, or internal dashboard, I&apos;m here to help you
            create something practical and powerful.
          </motion.p>
          <motion.p
            variants={fadeInUp}
            className="text-white/70 text-base md:text-lg leading-relaxed"
          >
            Good software is built with empathy, creativity, and purpose.
            I&apos;d love to help bring your vision to life.
          </motion.p>
        </motion.section>

        {/* Who I Work With */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            Who I Work With
          </h2>
          <p className="text-white/70 text-base md:text-lg leading-relaxed">
            From construction firms to homesteaders, I&apos;ve built platforms
            that simplify complex workflows — everything from custom dashboards
            to portals and CMS integrations — always tailored to real business
            needs. If you run a business and need software that works the way
            you do, we&apos;ll get along great.
          </p>
        </motion.section>

        {/* Tech Stack */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.04 } },
          }}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12"
        >
          <motion.h2
            variants={fadeInUp}
            className="text-2xl md:text-3xl font-bold text-yellow mb-6"
          >
            Tech Stack
          </motion.h2>
          <div className="flex flex-wrap gap-3">
            {techStack.map((tech) => (
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
      </div>

      {/* Stats */}
      <div className="w-full z-10 flex justify-center py-16">
        <StatsSection />
      </div>

      {/* CTA */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        variants={fadeInUp}
        className="text-center z-10 py-8"
      >
        <h3 className="text-2xl md:text-3xl font-bold text-yellow mb-4">
          Ready to build something together?
        </h3>
        <p className="text-white/60 text-lg mb-8">
          Let&apos;s talk about your project and make it happen.
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
              Let&apos;s Work Together
            </Link>
          </motion.div>
          <Link
            href="/services"
            className="inline-block text-lg text-white border border-white/40 px-8 py-3.5 rounded-lg font-semibold hover:bg-white hover:text-gray-800 transition"
          >
            View Services
          </Link>
        </div>
      </motion.div>
    </main>
  );
}
