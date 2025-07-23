"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
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

const pricingData = [
  {
    category: "Website Packages",
    range: "$750 – $2,500+",
    plans: [
      {
        tier: "Starter Website",
        price: "$750 - $1,500",
        features: [
          "Up to 3 custom-designed pages",
          "Mobile responsive layout",
          "Clean, modern design",
          "Contact form integration",
          "Google indexing + sitemap",
          "Secure HTTPS setup",
          "Deployed via AWS, Vercel, or preferred hosting",
        ],
      },
      {
        tier: "Business Website",
        price: "$1,500 - $2,500",
        features: [
          "Everything in Starter",
          "Up to 8 custom pages",
          "Headless CMS (Sanity, Payload, WordPress)",
          "Blog or portfolio section",
          "Google Analytics setup",
          "SEO meta tags + social share previews",
          "Facebook Pixel or Google Tag Manager",
          "Free domain guidance",
        ],
      },
      {
        tier: "E-Commerce Website",
        price: "$2,500 - $3,500",
        features: [
          "This is a custom e-commerce solution",
          "Up to 10 product pages",
          "Custom checkout experience",
          "Product catalog with CMS or Shopify integration",
          "Secure checkout (Stripe, PayPal, or Shopify)",
          "Inventory and order tracking setup",
          "Sales tax & shipping setup",
          "Abandoned cart recovery (if supported)",
        ],
      },
      {
        tier: "Pro Website",
        price: "$2,500+",
        features: [
          "Everything in Business",
          "Up to 15 custom pages",
          "Advanced CMS features (custom types, relations)",
          "Meta Shop and Instagram Shopping integration",
          "Custom animations (Framer Motion, Lottie)",
          "Advanced SEO setup + Schema.org markup",
          "Accessibility and performance tuning",
          "Walkthrough training video for your CMS",
        ],
      },
    ],
  },
  {
    category: "Upsells & Add-ons",
    range: "Starting at $75",
    plans: [
      {
        tier: "Available Add-ons",
        price: "Custom Pricing",
        features: [
          "Logo Design – from $300",
          "Copywriting (Home + About + Services) – $250",
          "Email Setup (Google Workspace or WorkMail) – $100",
          "Custom Forms + Automations – $150+",
          "Product Photography/Graphics – Custom Quote",
          "Instagram Feed Embed – $75",
          "Chatbot or Live Chat Setup – $150",
          "Google Business Profile Setup – $150",
        ],
      },
    ],
  },
  {
    category: "Hosting & Maintenance Plans",
    range: "$50 – $1,200/mo",
    plans: [
      {
        tier: "Basic Hosting",
        price: "$50/mo",
        features: [
          "Fast CDN-backed hosting (AWS, Vercel, or Render)",
          "SSL certificate and HTTPS",
          "Uptime monitoring and security patches",
          "1 monthly update request (15 min max)",
        ],
      },
      {
        tier: "Bronze Plan",
        price: "$100/mo",
        features: [
          "Uptime monitoring",
          "Weekly backups",
          "CMS core updates",
          "2 hours/month content edits",
        ],
      },
      {
        tier: "Silver Plan",
        price: "$250/mo",
        features: [
          "Everything in Bronze",
          "5 hours/month dev or content work",
          "Monthly performance/SEO report",
          "Plugin and security upgrades",
        ],
      },
      {
        tier: "Gold Plan",
        price: "$500/mo",
        features: [
          "Everything in Silver",
          "Full A/B testing and SEO optimization",
          "Conversion tracking & tuning",
          "Dedicated dev support",
        ],
      },
    ],
  },
  {
    category: "Custom Web Applications",
    range: "$10,000+",
    plans: [
      {
        tier: "MVP Web App",
        price: "From $10,000",
        features: [
          "Custom front-end (React/Next.js)",
          "Secure backend (Node, Supabase, Firebase, etc.)",
          "User auth, roles, admin dashboards",
          "Cloud hosting setup (AWS, GCP, Vercel)",
        ],
      },
      {
        tier: "Growth Plan",
        price: "$5,000/mo",
        features: [
          "Feature rollouts",
          "Weekly sprints",
          "Monitoring, backups, CI/CD pipeline",
          "Dev support and UX enhancements",
        ],
      },
    ],
  },
];

export default function PricingClient() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-black via-gray-800 to-blue-900 py-36 px-4 text-white">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="text-4xl text-yellow md:text-6xl font-extrabold text-center mb-12"
      >
        NunezDev Pricing
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        viewport={{ once: true }}
        className="text-sm text-center max-w-3xl mx-auto mb-16"
      >
        *Note: All packages include a free consultation. Hosting & maintenance
        available monthly. Custom features can be quoted and added to any plan.
      </motion.p>

      <Tabs defaultValue="Website Packages" className="w-full">
        <TabsList className="flex flex-wrap justify-center gap-4 mb-10">
          {pricingData.map((pkg) => (
            <TabsTrigger
              key={pkg.category}
              value={pkg.category}
              className="hover:scale-105 transition-transform duration-200"
            >
              {pkg.category}
            </TabsTrigger>
          ))}
        </TabsList>

        {pricingData.map((pkg) => (
          <TabsContent key={pkg.category} value={pkg.category}>
            <div className="grid md:grid-cols-3 gap-8">
              {pkg.plans.map((plan, index) => (
                <motion.div
                  key={plan.tier}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  viewport={{ once: true }}
                >
                  <Card className="bg-zinc-900 border-2 border-zinc-700 hover:border-yellow hover:shadow-yellow hover:shadow-md transition-all duration-300">
                    <CardHeader>
                      <CardTitle className="text-yellow text-xl font-bold drop-shadow">
                        {plan.tier}
                        <span className="block text-sm font-medium text-white mt-1">
                          {plan.price}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc pl-5 space-y-2 text-sm text-zinc-300">
                        {plan.features.map((feature, idx) => (
                          <li key={idx}>{feature}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        variants={fadeInUp}
        className="flex justify-center gap-4 pt-6"
      >
        <a
          href="/services"
          className="text-lg border border-offwhite px-6 py-3 rounded-md font-semibold hover:bg-offwhite hover:text-blue transition"
        >
          View Services
        </a>
      </motion.div>
    </main>
  );
}
