import { MetadataRoute } from "next";
import { projects } from "@/data/projects";
import { posts } from "@/data/blog";
import { serviceCities } from "@/data/serviceCities";

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
    { url: `${BASE_URL}/web-design-ponca-city`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/custom-software`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/blog`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/privacy-policy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/terms-of-service`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/sms-terms`, changeFrequency: "yearly", priority: 0.3 },
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

  const cityPages: MetadataRoute.Sitemap = serviceCities.map((c) => ({
    url: `${BASE_URL}/web-design/${c.slug}`,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const blogPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.updated ?? post.date),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticPages, ...servicePages, ...cityPages, ...portfolioPages, ...blogPages];
}
