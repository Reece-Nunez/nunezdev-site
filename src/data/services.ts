import {
  faLaptopCode,
  faCubes,
  faChartBar,
  faCogs,
  faCode,
  faArrowTrendUp,
  faShieldAlt,
} from "@fortawesome/free-solid-svg-icons";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";

export interface Service {
  slug: string;
  title: string;
  shortDescription: string;
  icon: IconDefinition;
  description: string;
  features: string[];
  technologies: string[];
  valueProp: string;
}

export const services: Service[] = [
  {
    slug: "custom-websites",
    title: "Custom Websites",
    shortDescription:
      "Modern, fast websites built from scratch with Next.js & Tailwind — no templates, no page builders.",
    icon: faLaptopCode,
    description:
      "Every website I build is hand-coded from the ground up. No WordPress, no Squarespace, no drag-and-drop. You get a blazing-fast, SEO-optimized site that's built exactly for your brand and goals — with clean code that scales.",
    features: [
      "Custom-designed pages tailored to your brand",
      "Mobile-first responsive layouts",
      "SEO optimization with meta tags, sitemaps, and structured data",
      "Contact forms with email notifications",
      "Google Analytics integration",
      "HTTPS deployment with custom domain setup",
      "Performance tuned for Core Web Vitals",
      "Content management when needed",
    ],
    technologies: ["Next.js", "React", "TypeScript", "Tailwind CSS", "Vercel", "Supabase"],
    valueProp:
      "A custom-coded website loads faster, ranks better, and gives you full control — no plugin bloat, no monthly platform fees, no limitations.",
  },
  {
    slug: "web-applications",
    title: "Web Applications",
    shortDescription:
      "Scalable full-stack apps with auth, databases, and real-time features — built for your exact workflow.",
    icon: faCubes,
    description:
      "When your business needs more than a website, I build custom web applications from scratch. User authentication, role-based access, real-time data, payment processing — whatever your workflow demands, I engineer it.",
    features: [
      "User authentication and role-based access control",
      "Custom database schema design",
      "Real-time updates and notifications",
      "Payment processing with Stripe",
      "File uploads and document management",
      "Admin panels and internal tools",
      "CI/CD pipeline setup",
      "Scalable cloud infrastructure",
    ],
    technologies: [
      "Next.js",
      "React",
      "TypeScript",
      "Node.js",
      "PostgreSQL",
      "Supabase",
      "AWS",
      "Stripe",
    ],
    valueProp:
      "Off-the-shelf SaaS tools force you to adapt to their workflow. A custom web app adapts to yours — and you own every line of code.",
  },
  {
    slug: "dashboards-portals",
    title: "Dashboards & Portals",
    shortDescription:
      "Client portals, admin dashboards, and data visualization tools built to streamline your operations.",
    icon: faChartBar,
    description:
      "I build custom dashboards and client-facing portals that give you and your customers real-time visibility into what matters. Lead trackers, invoice managers, reporting tools, client portals — all tailored to your business logic.",
    features: [
      "Client-facing portals with secure login",
      "Admin dashboards with analytics and reporting",
      "Lead tracking and CRM functionality",
      "Invoice and payment management",
      "Data visualization with charts and graphs",
      "Role-based permissions and access control",
      "Real-time data syncing",
      "Export and reporting tools",
    ],
    technologies: [
      "Next.js",
      "React",
      "TypeScript",
      "Supabase",
      "PostgreSQL",
      "Chart.js",
      "Stripe",
      "Tailwind CSS",
    ],
    valueProp:
      "Stop juggling spreadsheets and disconnected tools. A custom dashboard puts everything in one place — designed around how you actually work.",
  },
  {
    slug: "automation-integration",
    title: "Automation & Integration",
    shortDescription:
      "Connect your tools and automate repetitive tasks — Stripe, email, CRMs, and more.",
    icon: faCogs,
    description:
      "I wire up the systems that power your business behind the scenes. From Stripe payment webhooks to automated email sequences, CRM syncing, and third-party API integrations — I build the plumbing so your business runs on autopilot.",
    features: [
      "Payment webhook handling (Stripe, PayPal)",
      "Automated email notifications and sequences",
      "Third-party API integrations",
      "Data syncing between platforms",
      "Scheduled tasks and cron jobs",
      "Form submission workflows",
      "Inventory and order automation",
      "Custom webhook endpoints",
    ],
    technologies: [
      "Node.js",
      "Next.js API Routes",
      "Stripe Webhooks",
      "SendGrid",
      "AWS Lambda",
      "Supabase Edge Functions",
      "REST APIs",
      "PostgreSQL",
    ],
    valueProp:
      "Every hour you spend on manual data entry or copy-pasting between tools is an hour you're not growing your business. Automation pays for itself.",
  },
  {
    slug: "api-development",
    title: "API Development",
    shortDescription:
      "RESTful APIs, webhook handlers, and backend services — secure, documented, and production-ready.",
    icon: faCode,
    description:
      "I design and build robust APIs that serve as the backbone of your application. Whether you need a REST API for a mobile app, webhook handlers for third-party integrations, or a backend service layer for your frontend — I deliver clean, documented, production-grade APIs.",
    features: [
      "RESTful API design and implementation",
      "Authentication and authorization (JWT, OAuth)",
      "Input validation and error handling",
      "Rate limiting and security hardening",
      "Database query optimization",
      "API documentation",
      "Webhook handlers and event processing",
      "Third-party API integration layers",
    ],
    technologies: [
      "Node.js",
      "TypeScript",
      "Next.js API Routes",
      "PostgreSQL",
      "Supabase",
      "JWT",
      "REST",
      "AWS",
    ],
    valueProp:
      "A well-designed API is the foundation of every scalable app. I build APIs that are fast, secure, and easy for any developer to work with.",
  },
  {
    slug: "seo-optimization",
    title: "SEO & Optimization",
    shortDescription:
      "Technical SEO, performance tuning, and search visibility — get found and load fast.",
    icon: faArrowTrendUp,
    description:
      "I handle the technical side of SEO so your site ranks and performs. From structured data and meta tags to Core Web Vitals optimization, image compression, and local SEO setup — I make sure search engines love your site as much as your customers do.",
    features: [
      "Technical SEO audit and implementation",
      "Meta tags, Open Graph, and Twitter Cards",
      "Schema.org structured data markup",
      "Core Web Vitals optimization",
      "Image optimization and lazy loading",
      "Sitemap and robots.txt configuration",
      "Google Search Console and Analytics setup",
      "Local SEO for Google Business Profile",
    ],
    technologies: [
      "Next.js",
      "Google Search Console",
      "Google Analytics",
      "Schema.org",
      "Lighthouse",
      "Core Web Vitals",
      "Vercel Analytics",
    ],
    valueProp:
      "A beautiful website is worthless if nobody finds it. Technical SEO ensures your site ranks, loads fast, and converts visitors into customers.",
  },
  {
    slug: "ongoing-support",
    title: "Ongoing Support & Maintenance",
    shortDescription:
      "Monthly care plans to keep your site secure, updated, and evolving with your business.",
    icon: faShieldAlt,
    description:
      "After launch, I don't disappear. I offer monthly retainer plans that cover bug fixes, feature updates, security patches, performance monitoring, and content changes. Your site stays fast, secure, and up-to-date — without you lifting a finger.",
    features: [
      "Monthly bug fixes and updates",
      "Security patches and dependency updates",
      "Performance monitoring and optimization",
      "Content updates and minor feature additions",
      "Uptime monitoring and alerts",
      "Monthly reports on site health",
      "Priority response times",
      "Strategic feature planning",
    ],
    technologies: [
      "Vercel",
      "GitHub",
      "Supabase",
      "Sentry",
      "Google Analytics",
      "Lighthouse",
    ],
    valueProp:
      "Software isn't set-and-forget. A maintenance plan means your site keeps working, stays secure, and grows with your business — while you focus on running it.",
  },
];
