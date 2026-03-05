import { MetadataRoute } from "next";
import { projects } from "@/data/projects";

const BASE_URL = "https://www.nunezdev.com";

const serviceSlugs = [
  "custom-websites",
  "web-applications",
  "dashboards-portals",
  "automation-integration",
  "api-development",
  "seo-optimization",
  "ongoing-support",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE_URL}/about`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/contact`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/services`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/portfolio`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/privacy-policy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/terms-of-service`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const servicePages: MetadataRoute.Sitemap = serviceSlugs.map((slug) => ({
    url: `${BASE_URL}/services/${slug}`,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const portfolioPages: MetadataRoute.Sitemap = projects.map((project) => ({
    url: `${BASE_URL}/portfolio/${project.slug}`,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticPages, ...servicePages, ...portfolioPages];
}
