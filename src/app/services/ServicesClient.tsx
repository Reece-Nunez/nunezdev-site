"use client";

import { motion } from "framer-motion";
import { Variants } from "framer-motion";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: "easeOut" },
  },
};

const services = [
  {
    title: "Starter Website",
    description:
      "Perfect for new businesses or one-pagers that need a professional online presence.",
    features: [
      "Up to 3 custom-designed pages",
      "Mobile responsive layout",
      "Modern design with contact form",
      "Google indexing + sitemap",
      "HTTPS and secure deployment",
    ],
  },
  {
    title: "Business Website",
    description:
      "For businesses ready to stand out with a full custom experience and backend control.",
    features: [
      "Includes everything in Starter",
      "Up to 8 custom pages with CMS",
      "Blog or portfolio section",
      "SEO meta + social previews",
      "Google Analytics + domain setup",
    ],
  },
  {
    title: "E-Commerce Website",
    description:
      "For businesses ready to sell online with style and scalability.",
    features: [
      "Includes everything in Business",
      "Product catalog with Shopify or CMS",
      "Stripe/PayPal integration",
      "Inventory & order tracking",
      "Shipping, tax, and recovery setup",
    ],
  },
  {
    title: "Pro Website",
    description:
      "For high-traffic brands needing advanced features and polish.",
    features: [
      "Includes everything in Business or E-Commerce",
      "Meta Shop + Instagram Shopping",
      "Custom animations + accessibility tuning",
      "Schema.org + performance boost",
      "CMS walkthrough training video",
    ],
  },
  {
    title: "Upsells & Add-ons",
    description:
      "Enhance your website with additional features and custom tools.",
    features: [
      "Logo Design – from $300",
      "Copywriting – $250",
      "Email Setup – $100",
      "Custom Forms + Automations – $150+",
      "Instagram Feed, Chatbots, Graphics",
    ],
  },
  {
    title: "Custom Web Applications",
    description:
      "Scalable web apps built with modern tech tailored to your workflow.",
    features: [
      "React/Next.js frontend + secure backend",
      "User auth, roles, and admin panels",
      "Database + hosting (AWS, GCP, Supabase)",
      "API integrations + Stripe billing",
      "CI/CD + growth plan support",
    ],
  },
];

export default function ServicesPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-900 to-blue-900 py-36 px-6 text-white">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        variants={fadeInUp}
        className="text-center mb-20"
      >
        <h1 className="text-yellow text-4xl md:text-6xl font-bold mb-6">
          Web Services That Work For You
        </h1>
        <p className="text-lg text-zinc-300 max-w-2xl mx-auto">
          From simple landing pages to full-stack apps, NunezDev delivers
          custom-built digital solutions ready to grow with your business.
        </p>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-10">
        {services.map((service, i) => (
          <motion.div
            key={service.title}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.4 }}
            variants={fadeInUp}
            transition={{ delay: i * 0.2 }}
            className="bg-zinc-900 rounded-xl p-8 border-2 border-zinc-700 hover:border-yellow hover:shadow-yellow hover:shadow-md transition-all duration-300"
          >
            <h2 className="text-yellow text-2xl font-bold mb-3">
              {service.title}
            </h2>
            <p className="text-sm text-zinc-300 mb-5">{service.description}</p>
            <ul className="space-y-2 text-sm text-zinc-400">
              {service.features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        variants={fadeInUp}
        className="flex justify-center mt-20"
      >
        <a
          href="/pricing"
          className="text-lg border border-offwhite px-6 py-3 rounded-md font-semibold hover:bg-offwhite hover:text-blue transition"
        >
          View Pricing
        </a>
      </motion.div>
    </main>
  );
}
