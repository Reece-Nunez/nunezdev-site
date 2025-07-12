'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

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
    <main className="min-h-screen bg-gradient-to-br from-black via-gray-700 to-blue py-52 px-6 mx-auto text-white">
      <h1 className="text-4xl md:text-6xl font-bold text-center mb-10">NunezDev Pricing</h1>
      <Tabs defaultValue="Starter Website" className="w-full">
        <TabsList className="flex flex-wrap justify-center gap-4 mb-10">
          {pricingData.map((pkg) => (
            <TabsTrigger key={pkg.category} value={pkg.category}>
              {pkg.category}
            </TabsTrigger>
          ))}
        </TabsList>
        {pricingData.map((pkg) => (
          <TabsContent key={pkg.category} value={pkg.category}>
            <div className="grid md:grid-cols-3 gap-6">
              {pkg.plans.map((plan) => (
                <Card key={plan.tier} className="bg-zinc-900 border border-zinc-700">
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold">
                      {plan.tier} <span className="block text-sm font-normal text-yellow">{plan.price}</span>
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
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </main>
  );
}
