"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import ThreeBackground from "@/components/ThreeBackground";

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8 },
  },
};

export default function HideawayHairStudioCaseStudy() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start px-4 pt-32 text-left text-offwhite overflow-hidden">
      <ThreeBackground />

      {/* Hero Section */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        variants={fadeInUp}
        className="space-y-6 mb-16 max-w-4xl text-center"
      >
        <h1 className="text-yellow text-3xl md:text-5xl font-bold leading-tight">
          Hideaway Hair Studio: A Stylish Digital Presence for a Local Salon
        </h1>
        <p className="max-w-3xl text-white mx-auto text-lg md:text-xl">
          An elegant, modern website that captures the personality and quality of a local hair salon — making it easy for new clients to discover services, meet the stylists, and get in touch.
        </p>
        <a
          href="https://hideawayhairstudio.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-yellow/70 hover:text-yellow transition text-base"
        >
          hideawayhairstudio.com →
        </a>
      </motion.div>

      {/* Main Content */}
      <div className="relative w-full max-w-4xl px-6 z-10 space-y-12">

        {/* The Challenge */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-8 md:p-12 shadow-xl"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            The Challenge: Bringing a Great In-Person Experience Online
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6">
            Hideaway Hair Studio had built a loyal following through word of mouth and exceptional in-person service. But without an online presence, they were invisible to potential clients searching for salons in their area. New clients had no way to browse services, learn about the stylists, or even find contact information without asking someone who already knew.
          </p>
          <p className="text-white text-lg leading-relaxed mb-6">
            The salon needed a website that could:
          </p>
          <ul className="space-y-3 text-white text-lg">
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Reflect the salon's unique style and welcoming atmosphere</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Showcase services with clear descriptions and pricing</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Introduce the talented team of stylists</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow text-xl">•</span>
              <span>Make it simple for new clients to reach out and book</span>
            </li>
          </ul>
          <p className="text-white text-lg leading-relaxed mt-6">
            The website had to feel as inviting and polished as the salon itself — not like a generic template that could belong to any business.
          </p>
        </motion.section>

        {/* Solution Overview */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-8 md:p-12 shadow-xl"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            The Solution: A Website That Matches the Experience
          </h2>
          <p className="text-white text-lg leading-relaxed mb-8">
            I designed and built an elegant, custom website that captures the personality and quality of Hideaway Hair Studio. The design combines warm aesthetics with modern functionality, creating an online experience that feels like a natural extension of the salon itself.
          </p>
          <p className="text-white text-lg leading-relaxed">
            From the service menu to the stylist profiles, every detail was crafted to help potential clients feel confident choosing Hideaway before they even walk through the door. Smooth animations and thoughtful layouts guide visitors through the site, while a clean contact form ensures that getting in touch is effortless.
          </p>
        </motion.section>

        {/* Key Features */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-8 md:p-12 shadow-xl"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            Key Features Delivered
          </h2>

          <div className="space-y-6">
            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Service Menu Showcase</h3>
              <p className="text-white leading-relaxed">A beautifully organized service menu that presents every offering — from cuts and color to specialty treatments — with clear descriptions so clients know exactly what to expect.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Stylist Profiles</h3>
              <p className="text-white leading-relaxed">Individual profiles for each stylist, highlighting their specialties and experience. Putting faces to names builds trust and helps clients choose the right stylist for their needs.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Contact Form with Email Notifications</h3>
              <p className="text-white leading-relaxed">A streamlined contact form powered by Resend that delivers client inquiries directly to the salon's inbox, ensuring no message gets missed and response times stay fast.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Responsive Design</h3>
              <p className="text-white leading-relaxed">A fully responsive layout that looks stunning on phones, tablets, and desktops — because most people searching for a new salon are doing it from their phone.</p>
            </div>

            <div className="border-l-4 border-yellow pl-6">
              <h3 className="text-xl font-semibold text-yellow mb-2">Smooth Animations</h3>
              <p className="text-white leading-relaxed">Subtle Framer Motion animations throughout the site add a premium, polished feel that elevates the brand without distracting from the content.</p>
            </div>
          </div>
        </motion.section>

        {/* Technology Stack */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-8 md:p-12 shadow-xl"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            Technology Behind the Scenes
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6">
            A modern stack that delivers fast load times, beautiful design, and reliable functionality:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Next.js 16 + React 19</span>
                <span className="text-gray-300">for speed and SEO</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Framer Motion</span>
                <span className="text-gray-300">for elegant animations</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Resend</span>
                <span className="text-gray-300">for email notifications</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 bg-yellow rounded-full"></span>
                <span className="text-white font-semibold">Tailwind CSS 4 + Lucide Icons</span>
                <span className="text-gray-300">for modern, responsive UI</span>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            This stack ensures the site loads fast, ranks well in local search results, and is easy to maintain as the salon grows.
          </p>
        </motion.section>

        {/* Business Impact */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-white/5 backdrop-blur-lg border border-yellow/30 rounded-2xl p-8 md:p-12 shadow-xl"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            Business Impact: Results That Matter
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6">
            The new website transformed how Hideaway Hair Studio connects with clients:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Increased visibility</span>
                  <p className="text-gray-300">new clients finding the salon through search engines</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Easier client communication</span>
                  <p className="text-gray-300">inquiries delivered instantly via email</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Professional brand image</span>
                  <p className="text-gray-300">a digital presence that matches the in-salon experience</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-yellow text-2xl">→</span>
                <div>
                  <span className="text-white font-semibold">Client confidence</span>
                  <p className="text-gray-300">new visitors arrive already knowing the services and team</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-white text-lg leading-relaxed mt-6">
            Hideaway Hair Studio now has a digital presence as polished as their in-person service — attracting new clients and reinforcing the trust that keeps loyal ones coming back.
          </p>
        </motion.section>

        {/* CTA Section */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="bg-gradient-to-r from-yellow/10 to-yellow/5 backdrop-blur-lg border border-yellow/50 rounded-2xl p-8 md:p-12 shadow-xl text-center"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-yellow mb-6">
            Ready to Transform Your Business?
          </h2>
          <p className="text-white text-lg leading-relaxed mb-6 max-w-2xl mx-auto">
            I help local businesses create beautiful, effective websites that attract new customers and showcase what makes them special.
          </p>
          <p className="text-white text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
            If your business deserves more than a cookie-cutter template, let's talk. I'll build a custom website that represents your brand perfectly — just like I did for Hideaway Hair Studio.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="bg-yellow text-blue font-semibold px-8 py-4 rounded-lg shadow-lg hover:bg-yellow/80 transition-all text-lg"
            >
              Start Your Project →
            </Link>
            <a
              href="https://hideawayhairstudio.com"
              target="_blank"
              rel="noopener noreferrer"
              className="border border-yellow text-yellow font-semibold px-8 py-4 rounded-lg hover:bg-yellow hover:text-blue transition text-lg"
            >
              Visit Website →
            </a>
            <Link
              href="/case-studies"
              className="border border-offwhite text-white font-semibold px-8 py-4 rounded-lg hover:bg-white hover:text-gray-800 transition text-lg"
            >
              View More Case Studies
            </Link>
          </div>
        </motion.section>

        {/* Back to Case Studies */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeInUp}
          className="text-center py-8"
        >
          <Link
            href="/case-studies"
            className="text-yellow hover:text-yellow/80 transition font-semibold text-lg"
          >
            ← Back to Case Studies
          </Link>
        </motion.div>
      </div>
    </main>
  );
}
