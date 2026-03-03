"use client";

import { useState } from "react";
import { motion, Variants } from "framer-motion";
import Link from "next/link";
import ThreeBackground from "@/components/ThreeBackground";
import CustomBooking from "@/components/CustomBooking";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCompass,
  faCalendarCheck,
  faCode,
  faArrowRight,
  faEnvelope,
  faMapMarkerAlt,
  faClock,
  faCheck,
} from "@fortawesome/free-solid-svg-icons";
import { FaGithub, FaLinkedin, FaFacebookF, FaInstagram } from "react-icons/fa";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" as const },
  },
};

const discussionTopics = [
  {
    icon: faCompass,
    title: "Your Vision",
    description:
      "Share your project goals, target audience, and what success looks like for your business.",
  },
  {
    icon: faCalendarCheck,
    title: "Timeline & Budget",
    description:
      "Realistic planning so we can scope the right solution for your timeline and investment.",
  },
  {
    icon: faCode,
    title: "Technical Approach",
    description:
      "I'll recommend the best technologies and architecture for your specific needs.",
  },
  {
    icon: faArrowRight,
    title: "Next Steps",
    description:
      "Walk away with a clear action plan and proposal outline — no guesswork.",
  },
];

const socialLinks = [
  { Icon: FaGithub, href: "https://github.com/reece-nunez", label: "GitHub" },
  {
    Icon: FaLinkedin,
    href: "https://linkedin.com/in/reecenunez",
    label: "LinkedIn",
  },
  {
    Icon: FaFacebookF,
    href: "https://facebook.com/NunezDevLLC",
    label: "Facebook",
  },
  {
    Icon: FaInstagram,
    href: "https://instagram.com/nunez_dev",
    label: "Instagram",
  },
];

export default function ContactClient() {
  const [isBookingOpen, setIsBookingOpen] = useState(false);

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
          Contact
        </motion.p>
        <motion.h1
          variants={fadeInUp}
          className="text-yellow text-3xl sm:text-4xl md:text-6xl font-bold tracking-tight mb-6"
        >
          Let&apos;s Build Something Great
        </motion.h1>
        <motion.p
          variants={fadeInUp}
          className="text-white/60 text-lg md:text-xl max-w-2xl mx-auto"
        >
          Ready to bring your project to life? Schedule a free discovery call to
          discuss your goals and how we can work together.
        </motion.p>
      </motion.div>

      <div className="w-full max-w-5xl z-10 space-y-12">
        {/* CTA Card */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.1 } },
          }}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 sm:p-8 md:p-12 text-center"
        >
          <motion.div
            variants={fadeInUp}
            className="w-16 h-16 rounded-full bg-yellow/10 flex items-center justify-center mx-auto mb-6"
          >
            <FontAwesomeIcon
              icon={faCalendarCheck}
              className="text-yellow text-2xl"
            />
          </motion.div>
          <motion.h2
            variants={fadeInUp}
            className="text-2xl md:text-3xl font-bold text-yellow mb-3"
          >
            Schedule Your Free Discovery Call
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="text-white/60 text-lg max-w-xl mx-auto mb-8"
          >
            A 30-minute conversation to understand your project, answer
            questions, and map out the best path forward.
          </motion.p>

          <motion.div variants={fadeInUp}>
            <motion.button
              onClick={() => setIsBookingOpen(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="inline-block bg-yellow text-gray-900 font-semibold text-lg px-10 py-4 rounded-lg shadow hover:shadow-[0_0_30px_rgba(255,195,18,0.3)] transition-shadow duration-300"
            >
              Book a Call &rarr;
            </motion.button>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-8"
          >
            {["30-minute call", "No pressure", "Honest advice"].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 text-white/50 text-sm"
              >
                <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faCheck}
                    className="text-green-400 text-[10px]"
                  />
                </div>
                {item}
              </div>
            ))}
          </motion.div>
        </motion.section>

        {/* What We'll Discuss */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08 } },
          }}
        >
          <motion.h2
            variants={fadeInUp}
            className="text-2xl md:text-3xl font-bold text-yellow mb-8 text-center"
          >
            What We&apos;ll Discuss
          </motion.h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {discussionTopics.map((topic) => (
              <motion.div
                key={topic.title}
                variants={fadeInUp}
                whileHover={{ scale: 1.03 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:border-yellow/50 hover:shadow-[0_0_25px_rgba(255,195,18,0.15)] transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-full bg-yellow/10 flex items-center justify-center mb-4">
                  <FontAwesomeIcon
                    icon={topic.icon}
                    className="text-yellow text-lg"
                  />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">
                  {topic.title}
                </h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  {topic.description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Contact Info + Socials */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.1 } },
          }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Direct Contact */}
          <motion.div
            variants={fadeInUp}
            className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8"
          >
            <h3 className="text-xl font-bold text-yellow mb-6">
              Reach Out Directly
            </h3>
            <div className="space-y-5">
              <a
                href="mailto:reece@nunezdev.com"
                className="flex items-center gap-4 group"
              >
                <div className="w-10 h-10 rounded-lg bg-yellow/10 border border-yellow/20 flex items-center justify-center group-hover:bg-yellow/20 transition-colors">
                  <FontAwesomeIcon
                    icon={faEnvelope}
                    className="text-yellow text-sm"
                  />
                </div>
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wider">
                    Email
                  </p>
                  <p className="text-white/80 text-sm group-hover:text-yellow transition-colors">
                    reece@nunezdev.com
                  </p>
                </div>
              </a>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-yellow/10 border border-yellow/20 flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faMapMarkerAlt}
                    className="text-yellow text-sm"
                  />
                </div>
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wider">
                    Location
                  </p>
                  <p className="text-white/80 text-sm">
                    Ponca City, Oklahoma
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-yellow/10 border border-yellow/20 flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faClock}
                    className="text-yellow text-sm"
                  />
                </div>
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wider">
                    Response Time
                  </p>
                  <p className="text-white/80 text-sm">
                    Within 24 hours
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Connect */}
          <motion.div
            variants={fadeInUp}
            className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8"
          >
            <h3 className="text-xl font-bold text-yellow mb-6">
              Connect Online
            </h3>
            <p className="text-white/60 text-sm leading-relaxed mb-6">
              Follow along for project updates, dev tips, and behind-the-scenes
              looks at what I&apos;m building.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/5 border border-white/10 hover:border-yellow/40 hover:bg-yellow/5 transition-all duration-300 group"
                >
                  <social.Icon className="w-4 h-4 text-white/50 group-hover:text-yellow transition-colors" />
                  <span className="text-white/70 text-sm font-medium group-hover:text-white transition-colors">
                    {social.label}
                  </span>
                </a>
              ))}
            </div>
          </motion.div>
        </motion.section>

        {/* Bottom CTA */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeInUp}
          className="text-center py-8"
        >
          <p className="text-white/40 text-sm mb-4">
            Not ready to book a call yet?
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/portfolio"
              className="inline-block text-sm text-white border border-white/20 px-6 py-2.5 rounded-lg font-medium hover:bg-white hover:text-gray-800 transition"
            >
              View My Work
            </Link>
            <Link
              href="/pricing"
              className="inline-block text-sm text-white border border-white/20 px-6 py-2.5 rounded-lg font-medium hover:bg-white hover:text-gray-800 transition"
            >
              See Pricing
            </Link>
            <Link
              href="/services"
              className="inline-block text-sm text-white border border-white/20 px-6 py-2.5 rounded-lg font-medium hover:bg-white hover:text-gray-800 transition"
            >
              Explore Services
            </Link>
          </div>
        </motion.div>
      </div>

      <CustomBooking
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
      />
    </main>
  );
}
