'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { motion } from 'framer-motion';
import { Variants } from "framer-motion";
import PricingStructuredData from '@/components/PricingStructuredData';

export const metadata = {
  title: "Transparent Web & Software Pricing | NunezDev",
  description:
    "Explore clear pricing for custom websites, CRM dashboards, client portals, and web applications. Find the right package for your business—from $300 starter sites to $20k+ enterprise builds.",
  keywords: [
    "web development pricing",
    "custom website cost",
    "CRM pricing for small business",
    "client portal development",
    "web app pricing",
    "freelance developer rates",
    "Oklahoma web developer pricing",
    "NunezDev pricing plans"
  ],
  alternates: {
    canonical: "https://www.nunezdev.com/pricing",
  },
  openGraph: {
    title: "Transparent Web & Software Pricing | NunezDev",
    description:
      "From small business websites to custom enterprise platforms—see our full pricing tiers and what each plan includes.",
    url: "https://www.nunezdev.com/pricing",
    siteName: "NunezDev",
    type: "website",
    images: [
      {
        url: "https://www.nunezdev.com/logo.png",
        width: 1200,
        height: 630,
        alt: "NunezDev pricing banner",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Website & Software Pricing | NunezDev",
    description:
      "Starter sites from $300. CRMs, portals, and custom platforms up to $20k+. View our transparent pricing breakdown.",
    images: ["https://www.nunezdev.com/logo.png"],
  },
};



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
    category: "Starter Website",
    range: "$300 – $1,500",
    plans: [
      {
        tier: "Basic",
        price: "$300–$750",
        features: [
          "Up to 3 pages (Home, About, Contact)",
          "Mobile-friendly layout",
          "Contact form setup",
          "Custom colors and fonts",
          "Basic on-page SEO",
          "Hosted via AWS or static host"
        ]
      },
      {
        tier: "Standard",
        price: "$1,000–$1,200",
        features: [
          "4–6 pages (adds Blog, Services, FAQ, etc.)",
          "Light custom animation",
          "Integrated calendar or third-party form",
          "Google Maps or location",
          "Analytics (Google Tag Manager)",
          "Simple CMS (Framer CMS or Notion API)"
        ]
      },
      {
        tier: "Enhanced",
        price: "$1,300–$1,500",
        features: [
          "All Standard features",
          "Full brand style guide application",
          "Multi-language support",
          "Accessibility optimization (A11y)",
          "Basic GDPR/privacy policy setup",
          "Blog or portfolio gallery with lightbox"
        ]
      }
    ]
  },
  {
    category: "Growth Site Package",
    range: "$2,000 – $5,000",
    plans: [
      {
        tier: "Lite",
        price: "$2,000–$2,500",
        features: [
          "6–8 pages",
          "Newsletter/email capture",
          "Custom lead form",
          "Light CMS (projects, blog, etc.)",
          "SEO markup + social share metadata"
        ]
      },
      {
        tier: "Pro",
        price: "$3,000–$3,800",
        features: [
          "All Lite features",
          "Booking/calendar integration",
          "Page transition animations",
          "Testimonials slider or case study",
          "Light client portal (not login-gated)"
        ]
      },
      {
        tier: "Max",
        price: "$4,000–$5,000",
        features: [
          "All Pro features",
          "Fully gated client portal (login)",
          "CMS dashboard for content",
          "Interactive elements (calculators/maps)",
          "CRM or Airtable integration"
        ]
      }
    ]
  },
  {
    category: "Web App Package",
    range: "$6,000 – $20,000+",
    plans: [
      {
        tier: "Core",
        price: "$6,000–$8,000",
        features: [
          "User auth (email/password)",
          "Dashboard UI (sidebar, cards, forms)",
          "PostgreSQL, Prisma or Firebase",
          "CRUD system",
          "Deployment (Vercel or AWS Amplify)"
        ]
      },
      {
        tier: "Standard",
        price: "$9,000–$12,000",
        features: [
          "All Core features",
          "Multi-role access",
          "Email alerts (SendGrid/AWS SES)",
          "Stripe payments/subscriptions",
          "Analytics dashboard"
        ]
      },
      {
        tier: "Enterprise",
        price: "$15,000–$20,000+",
        features: [
          "All Standard features",
          "Real-time data updates",
          "AI integrations",
          "Offline storage (IndexedDB/PWA)",
          "Dynamic API connections",
          "Permissions system + audit logs"
        ]
      }
    ]
  }
];

export default function PricingPage() {
  return (
    <>
      <PricingStructuredData />
    <main className="min-h-screen bg-gradient-to-br from-black via-gray-800 to-blue-900 py-36 px-4 text-white">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="text-4xl md:text-6xl font-extrabold text-center mb-12"
      >
        NunezDev Pricing
      </motion.h1>

      <Tabs defaultValue="Starter Website" className="w-full">
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
                  <Card className="bg-zinc-900 border border-zinc-700 hover:border-yellow-400 hover:shadow-yellow-400/20 hover:shadow-lg transition-all duration-300">
                    <CardHeader>
                      <CardTitle className="text-xl font-bold text-yellow-400 drop-shadow">
                        {plan.tier}
                        <span className="block text-sm font-medium text-white mt-1">{plan.price}</span>
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
    </>
  );
}
