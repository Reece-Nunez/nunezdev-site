"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles, Zap, Building2, ShoppingCart, Rocket, Wrench, Server, Code2 } from "lucide-react";

const categories = [
  { id: "websites", label: "Websites", icon: Sparkles },
  { id: "addons", label: "Add-ons", icon: Wrench },
  { id: "hosting", label: "Hosting", icon: Server },
  { id: "applications", label: "Web Apps", icon: Code2 },
];

const pricingData = {
  websites: {
    title: "Website Packages",
    subtitle: "Custom-built websites that convert visitors into customers",
    plans: [
      {
        tier: "Starter",
        price: "$1,500",
        priceMax: "$2,500",
        icon: Zap,
        description: "Perfect for personal brands and small projects",
        features: [
          "Up to 3 custom-designed pages",
          "Mobile responsive layout",
          "Clean, modern design",
          "Contact form integration",
          "Google indexing + sitemap",
          "Secure HTTPS setup",
          "Deployed via AWS, Vercel, or preferred hosting",
        ],
        accent: "from-blue-500 to-cyan-500",
        popular: false,
      },
      {
        tier: "Business",
        price: "$2,500",
        priceMax: "$4,000",
        icon: Building2,
        description: "Ideal for growing businesses ready to scale",
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
        accent: "from-yellow-400 to-orange-500",
        popular: true,
      },
      {
        tier: "E-Commerce",
        price: "$3,500",
        priceMax: "$5,500",
        icon: ShoppingCart,
        description: "Full-featured online stores that sell",
        features: [
          "Custom e-commerce solution",
          "Up to 10 product pages",
          "Custom checkout experience",
          "Product catalog with CMS or Shopify",
          "Secure checkout (Stripe, PayPal)",
          "Inventory and order tracking",
          "Sales tax & shipping setup",
          "Abandoned cart recovery",
        ],
        accent: "from-emerald-500 to-teal-500",
        popular: false,
      },
      {
        tier: "Pro",
        price: "$5,000",
        priceMax: "+",
        icon: Rocket,
        description: "Enterprise-grade websites with advanced features",
        features: [
          "Everything in Business",
          "Up to 15 custom pages",
          "Advanced CMS features",
          "Meta Shop & Instagram Shopping",
          "Custom animations (Framer Motion, Lottie)",
          "Advanced SEO + Schema.org markup",
          "Accessibility & performance tuning",
          "Walkthrough training video",
        ],
        accent: "from-purple-500 to-pink-500",
        popular: false,
      },
    ],
  },
  addons: {
    title: "Upsells & Add-ons",
    subtitle: "Enhance your project with premium extras",
    plans: [
      {
        tier: "Branding",
        price: "$400",
        priceMax: "+",
        icon: Sparkles,
        description: "Make your brand unforgettable",
        features: [
          "Logo Design – from $400",
          "Brand color palette",
          "Typography selection",
          "Brand guidelines document",
        ],
        accent: "from-pink-500 to-rose-500",
        popular: false,
      },
      {
        tier: "Content",
        price: "$350",
        priceMax: "+",
        icon: Building2,
        description: "Professional copy that converts",
        features: [
          "Copywriting (Home + About + Services) – $350",
          "Product descriptions",
          "SEO-optimized content",
          "Call-to-action optimization",
        ],
        accent: "from-blue-500 to-indigo-500",
        popular: true,
      },
      {
        tier: "Integrations",
        price: "$100",
        priceMax: "+",
        icon: Zap,
        description: "Connect your tools and automate",
        features: [
          "Email Setup (Google/WorkMail) – $150",
          "Custom Forms + Automations – $200+",
          "Instagram Feed Embed – $100",
          "Chatbot or Live Chat – $200",
          "Google Business Profile – $200",
        ],
        accent: "from-amber-500 to-orange-500",
        popular: false,
      },
    ],
  },
  hosting: {
    title: "Hosting & Maintenance",
    subtitle: "Keep your site fast, secure, and up-to-date",
    plans: [
      {
        tier: "Basic",
        price: "$75",
        priceMax: "/mo",
        icon: Server,
        description: "Essential hosting for simple sites",
        features: [
          "Fast CDN-backed hosting",
          "SSL certificate and HTTPS",
          "Uptime monitoring",
          "Security patches",
          "1 monthly update (15 min)",
        ],
        accent: "from-slate-500 to-zinc-500",
        popular: false,
      },
      {
        tier: "Bronze",
        price: "$150",
        priceMax: "/mo",
        icon: Zap,
        description: "For sites that need regular updates",
        features: [
          "Everything in Basic",
          "Weekly backups",
          "CMS core updates",
          "2 hours/month content edits",
        ],
        accent: "from-amber-600 to-yellow-600",
        popular: false,
      },
      {
        tier: "Silver",
        price: "$350",
        priceMax: "/mo",
        icon: Building2,
        description: "Active maintenance and growth support",
        features: [
          "Everything in Bronze",
          "5 hours/month dev or content",
          "Monthly performance/SEO report",
          "Plugin and security upgrades",
        ],
        accent: "from-slate-400 to-gray-400",
        popular: true,
      },
      {
        tier: "Gold",
        price: "$750",
        priceMax: "/mo",
        icon: Sparkles,
        description: "Full-service partnership",
        features: [
          "Everything in Silver",
          "Full A/B testing & SEO optimization",
          "Conversion tracking & tuning",
          "Dedicated dev support",
        ],
        accent: "from-yellow-400 to-amber-500",
        popular: false,
      },
    ],
  },
  applications: {
    title: "Custom Web Applications",
    subtitle: "Scalable solutions built for your unique needs",
    plans: [
      {
        tier: "MVP Web App",
        price: "$15,000",
        priceMax: "+",
        icon: Rocket,
        description: "Launch your product idea",
        features: [
          "Custom front-end (React/Next.js)",
          "Secure backend (Node, Supabase, Firebase)",
          "User auth, roles, admin dashboards",
          "Cloud hosting setup (AWS, GCP, Vercel)",
          "CI/CD pipeline setup",
          "Documentation & handoff",
        ],
        accent: "from-violet-500 to-purple-500",
        popular: true,
      },
      {
        tier: "Growth Plan",
        price: "$7,500",
        priceMax: "/mo",
        icon: Zap,
        description: "Continuous development partnership",
        features: [
          "Feature rollouts",
          "Weekly sprints",
          "Monitoring & backups",
          "CI/CD pipeline maintenance",
          "Dev support & UX enhancements",
          "Priority response time",
        ],
        accent: "from-emerald-500 to-green-500",
        popular: false,
      },
    ],
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut" as const,
    },
  },
};

export default function PricingClient() {
  const [activeCategory, setActiveCategory] = useState("websites");
  const currentData = pricingData[activeCategory as keyof typeof pricingData];

  return (
    <main className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-gradient-to-br from-blue-600/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-gradient-to-tl from-purple-600/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-r from-yellow-500/5 via-transparent to-yellow-500/5" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '64px 64px',
          }}
        />
      </div>

      <div className="relative z-10 py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow/10 border border-yellow/30 mb-6"
          >
            <Sparkles className="w-4 h-4 text-yellow" />
            <span className="text-sm font-medium text-yellow">Transparent Pricing</span>
          </motion.div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            <span className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
              Invest in Your
            </span>
            <br />
            <span className="text-yellow">
              Digital Presence
            </span>
          </h1>

          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Custom-crafted solutions built with modern technologies.
            No templates, no shortcuts—just quality code that performs.
          </p>
        </motion.div>

        {/* Category Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-2 mb-16"
        >
          {categories.map((category) => {
            const Icon = category.icon;
            const isActive = activeCategory === category.id;

            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`
                  relative px-6 py-3 rounded-xl font-medium transition-all duration-300
                  flex items-center gap-2 group
                  ${isActive
                    ? "text-brand-black"
                    : "text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10"
                  }
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-yellow rounded-xl"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon className={`w-4 h-4 relative z-10 transition-transform group-hover:scale-110 ${isActive ? "text-brand-black" : ""}`} />
                <span className="relative z-10">{category.label}</span>
              </button>
            );
          })}
        </motion.div>

        {/* Section Header */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory + "-header"}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              {currentData.title}
            </h2>
            <p className="text-gray-400">{currentData.subtitle}</p>
          </motion.div>
        </AnimatePresence>

        {/* Pricing Cards */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className={`grid gap-6 ${
              currentData.plans.length === 2
                ? "md:grid-cols-2 max-w-4xl mx-auto"
                : currentData.plans.length === 3
                  ? "md:grid-cols-3"
                  : "md:grid-cols-2 lg:grid-cols-4"
            }`}
          >
            {currentData.plans.map((plan, index) => {
              const Icon = plan.icon;

              return (
                <motion.div
                  key={plan.tier}
                  variants={cardVariants}
                  whileHover={{ y: -8, transition: { duration: 0.3 } }}
                  className={`
                    relative group rounded-2xl p-[1px] overflow-hidden
                    ${plan.popular
                      ? "bg-gradient-to-b from-yellow/60 via-yellow/20 to-transparent"
                      : "bg-gradient-to-b from-white/20 via-white/5 to-transparent"
                    }
                  `}
                >
                  {/* Popular Badge */}
                  {plan.popular && (
                    <div className="absolute -top-px left-1/2 -translate-x-1/2 z-20">
                      <div className="bg-yellow text-brand-black text-xs font-bold px-4 py-1 rounded-b-lg">
                        MOST POPULAR
                      </div>
                    </div>
                  )}

                  {/* Card Content */}
                  <div className="relative bg-[#12121a] rounded-2xl p-6 h-full flex flex-col">
                    {/* Glow effect on hover */}
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl bg-gradient-to-br ${plan.accent} blur-xl -z-10`} style={{ transform: 'scale(0.9)' }} />

                    {/* Header */}
                    <div className="mb-6">
                      <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${plan.accent} mb-4`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>

                      <h3 className="text-xl font-bold text-white mb-2">{plan.tier}</h3>
                      <p className="text-sm text-gray-400 mb-4">{plan.description}</p>

                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-white">{plan.price}</span>
                        <span className="text-gray-400 text-lg">{plan.priceMax}</span>
                      </div>
                    </div>

                    {/* Features */}
                    <ul className="space-y-3 flex-grow mb-6">
                      {plan.features.map((feature, idx) => (
                        <motion.li
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 * idx + 0.3 }}
                          className="flex items-start gap-3 text-sm text-gray-300"
                        >
                          <div className={`mt-0.5 rounded-full p-1 bg-gradient-to-br ${plan.accent}`}>
                            <Check className="w-3 h-3 text-white" />
                          </div>
                          {feature}
                        </motion.li>
                      ))}
                    </ul>

                    {/* CTA Button */}
                    <a
                      href="/contact"
                      className={`
                        w-full py-3 px-6 rounded-xl font-semibold text-center transition-all duration-300 block
                        ${plan.popular
                          ? "bg-yellow text-brand-black hover:brightness-110 hover:shadow-lg hover:shadow-yellow/25"
                          : "bg-brand-blue text-white hover:brightness-110"
                        }
                      `}
                    >
                      Get Started
                    </a>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-20 text-center"
        >
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 p-8 rounded-2xl bg-gradient-to-r from-white/5 to-white/10 border border-white/10 backdrop-blur-sm">
            <div className="text-left">
              <h3 className="text-xl font-bold text-white mb-1">Need something custom?</h3>
              <p className="text-gray-400">Let&apos;s discuss your unique project requirements.</p>
            </div>
            <a
              href="/contact"
              className="whitespace-nowrap px-8 py-3 rounded-xl bg-yellow text-brand-black font-semibold hover:brightness-110 transition-all"
            >
              Book a Free Consultation
            </a>
          </div>
        </motion.div>

        {/* Trust indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.7 }}
          className="mt-16 flex flex-wrap justify-center gap-8 text-sm text-gray-500"
        >
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Free consultation included
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            No hidden fees
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" />
            Flexible payment plans
          </div>
        </motion.div>
      </div>
    </main>
  );
}
