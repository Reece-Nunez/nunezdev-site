export interface Project {
  title: string;
  description: string;
  tags: string[];
  slug: string;
  featured?: boolean;
  category: string;
}

export const projects: Project[] = [
  {
    title: "Meridian Luxury Travel",
    description:
      "Full-stack travel platform with automated bookings, Stripe payments, and a custom CMS for a luxury travel business.",
    tags: ["Next.js", "Supabase", "Stripe"],
    slug: "meridian-luxury-travel",
    featured: true,
    category: "Travel & Hospitality",
  },
  {
    title: "Refinery Scheduler",
    description:
      "Safety-compliant workforce scheduling system for oil refinery operations with RP-755 fatigue policy enforcement.",
    tags: ["Next.js", "Prisma", "React Big Calendar"],
    slug: "refinery-scheduler",
    category: "Industrial",
  },
  {
    title: "Sterling Financial",
    description:
      "Cross-platform personal finance app with native iOS and Android apps sharing a unified Supabase backend.",
    tags: ["Turborepo", "Swift", "Kotlin", "Supabase"],
    slug: "sterling-financial",
    category: "FinTech",
  },
  {
    title: "Goldman Financial",
    description:
      "Digital financial services platform with online applications, e-signatures, PDF generation, and branch locator.",
    tags: ["Next.js", "Google Maps", "PDF Generation"],
    slug: "goldman-financial",
    category: "Financial Services",
  },
  {
    title: "Goldman Merchant Services",
    description:
      "Professional payment processing website with animated service showcases and lead capture forms.",
    tags: ["Next.js", "Framer Motion", "Resend"],
    slug: "goldman-merchant-services",
    category: "Financial Services",
  },
  {
    title: "Maigem Massage",
    description:
      "Full-stack booking platform with real-time scheduling, Square payment integration, and automated confirmations.",
    tags: ["Next.js", "Supabase", "Square"],
    slug: "maigem-massage",
    category: "Health & Wellness",
  },
  {
    title: "PC United FC",
    description:
      "Youth soccer club management platform with player registration, stats tracking, and video highlight management.",
    tags: ["Next.js", "Supabase", "AWS S3"],
    slug: "pc-united",
    category: "Sports",
  },
  {
    title: "Farm Expense Tracker",
    description:
      "Smart agricultural expense tracking with OCR receipt scanning, barcode reading, and tax report generation.",
    tags: ["React", "AWS Amplify", "Tesseract.js"],
    slug: "farm-expense-tracker",
    category: "Agriculture",
  },
  {
    title: "Aidoo Academic Press",
    description:
      "Multi-journal academic publishing platform with editorial workflows and peer review management.",
    tags: ["OJS", "PHP", "MariaDB"],
    slug: "aidoo-academic",
    category: "Education",
  },
  {
    title: "Truvino",
    description:
      "Geographic wine discovery platform with interactive maps and a Python-powered data enrichment pipeline.",
    tags: ["Next.js", "React Simple Maps", "Python"],
    slug: "truvino",
    category: "Food & Beverage",
  },
  {
    title: "Jones Legacy Creations",
    description:
      "Multi-service business website with advanced validated forms for construction, real estate, and interior design.",
    tags: ["Next.js", "React Hook Form", "Zod"],
    slug: "jones-legacy-creations",
    category: "Construction",
  },
  {
    title: "Hideaway Hair Studio",
    description:
      "Stylish salon website with service menus, stylist profiles, and integrated booking links.",
    tags: ["Next.js", "Lucide", "Resend"],
    slug: "hideaway-hair-studio",
    category: "Beauty & Wellness",
  },
  {
    title: "Kristina Curtis Photography",
    description:
      "Photography portfolio with tag-based galleries, investment info, vendor directory, and AWS Lambda contact forms.",
    tags: ["Next.js", "AWS Lambda", "Tailwind CSS"],
    slug: "kristina-curtis-photography",
    category: "Creative Services",
  },
  {
    title: "Go Girl Painting",
    description:
      "Professional website for a women-owned painting company with project gallery and quote request forms.",
    tags: ["Next.js", "Tailwind CSS", "Framer Motion"],
    slug: "go-girl-painting",
    category: "Home Services",
  },
  {
    title: "Vacation Rental Site",
    description:
      "Direct-booking vacation rental website with property galleries, amenity highlights, and inquiry forms.",
    tags: ["React", "Vite", "Tailwind CSS"],
    slug: "nunez-vacation-site",
    category: "Travel & Hospitality",
  },
];
