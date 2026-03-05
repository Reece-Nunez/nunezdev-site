import { Metadata } from "next";
import { projects } from "@/data/projects";

export function getPortfolioMetadata(slug: string, ogImage?: string): Metadata {
  const project = projects.find((p) => p.slug === slug);
  if (!project) return {};

  return {
    title: `${project.title} | Portfolio`,
    description: project.description,
    keywords: [
      ...project.tags,
      project.category.toLowerCase(),
      "custom web development",
      "NunezDev portfolio",
      "case study",
    ],
    alternates: {
      canonical: `https://www.nunezdev.com/portfolio/${project.slug}`,
    },
    openGraph: {
      title: `${project.title} | NunezDev Portfolio`,
      description: project.description,
      url: `https://www.nunezdev.com/portfolio/${project.slug}`,
      siteName: "NunezDev",
      type: "article",
      images: [
        {
          url: ogImage
            ? `https://www.nunezdev.com${ogImage}`
            : "https://www.nunezdev.com/logo.png",
          width: 1200,
          height: 630,
          alt: project.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${project.title} | NunezDev`,
      description: project.description,
    },
  };
}
