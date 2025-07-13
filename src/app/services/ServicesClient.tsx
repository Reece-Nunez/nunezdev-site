'use client';

import { motion } from 'framer-motion';
import { Variants } from 'framer-motion';

const fadeInUp: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.8, ease: 'easeOut' },
    },
};

const services = [
    {
        title: 'Starter Website',
        description:
            'Ideal for local businesses, personal brands, or new ventures that need a solid online foundation.',
        features: [
            '📱 Fully responsive across all devices',
            '🔍 Basic SEO setup (meta tags, page titles)',
            '📄 Up to 6 custom-designed pages',
            '📝 Contact form setup + spam protection',
            '🎨 Custom branding integration (colors/fonts)',
        ],
    },
    {
        title: 'Growth Site',
        description:
            'Designed to help businesses grow and capture leads. Perfect for service-based brands ready to scale.',
        features: [
            '🧩 CMS-driven blog, testimonials, or projects',
            '📆 Booking/calendar integrations',
            '📧 Newsletter/email capture system',
            '🗺️ Google Maps & schema markup for local SEO',
            '📈 Built-in analytics tracking (GTM or Plausible)',
        ],
    },
    {
        title: 'Custom Web App',
        description:
            'Engineered for businesses needing secure, scalable web applications or client portals.',
        features: [
            '🔐 Auth system (email/password, roles)',
            '🗂️ Dashboard UI (cards, tables, charts)',
            '🛠️ CRUD system w/ PostgreSQL + Prisma or Firebase',
            '💳 Stripe subscriptions or invoice billing',
            '🔁 API integrations (CRM, Airtable, Zapier)',
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
                <h1 className="text-4xl md:text-6xl font-bold mb-6">
                    Custom Solutions That Grow With You
                </h1>
                <p className="text-lg text-zinc-300 max-w-2xl mx-auto">
                    Whether you&#39;re just getting started or scaling fast, NunezDev builds websites and apps that move with your business.
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
                        className="bg-zinc-900 rounded-xl p-8 border border-zinc-700 hover:border-yellow-400 hover:shadow-yellow-400/20 hover:shadow-lg transition-all duration-300"
                    >
                        <h2 className="text-2xl font-bold text-yellow-400 mb-3">
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