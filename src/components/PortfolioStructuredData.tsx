import { Project } from "@/data/projects";

interface Props {
  project: Project;
  ogImage?: string;
}

export default function PortfolioStructuredData({ project, ogImage }: Props) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.title,
    description: project.description,
    url: `https://www.nunezdev.com/portfolio/${project.slug}`,
    image: ogImage
      ? `https://www.nunezdev.com${ogImage}`
      : "https://www.nunezdev.com/logo.png",
    author: {
      "@type": "Person",
      name: "Reece Nunez",
      url: "https://www.nunezdev.com/about",
    },
    creator: {
      "@id": "https://www.nunezdev.com/#organization",
    },
    genre: project.category,
    keywords: project.tags.join(", "),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
