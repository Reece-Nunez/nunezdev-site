import { getPortfolioMetadata } from "@/lib/seo/portfolioMetadata";
import { projects } from "@/data/projects";
import PortfolioStructuredData from "@/components/PortfolioStructuredData";
import BreadcrumbJsonLd from "@/components/BreadcrumbJsonLd";
import CaseStudyClient from "./CaseStudyClient";

const slug = "go-girl-painting";
const project = projects.find((p) => p.slug === slug)!;

export const metadata = getPortfolioMetadata(slug);

export default function Page() {
  return (
    <>
      <PortfolioStructuredData project={project} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "https://www.nunezdev.com" },
          { name: "Portfolio", url: "https://www.nunezdev.com/portfolio" },
          { name: project.title, url: `https://www.nunezdev.com/portfolio/${slug}` },
        ]}
      />
      <CaseStudyClient />
    </>
  );
}
