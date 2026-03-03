import { services } from "@/data/services";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import ServicePageClient from "./ServicePageClient";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = services.find((s) => s.slug === slug);
  if (!service) return {};

  return {
    title: `${service.title} | NunezDev`,
    description: service.shortDescription,
    alternates: {
      canonical: `https://www.nunezdev.com/services/${service.slug}`,
    },
    openGraph: {
      title: `${service.title} | NunezDev`,
      description: service.shortDescription,
      url: `https://www.nunezdev.com/services/${service.slug}`,
      siteName: "NunezDev",
      type: "website",
    },
  };
}

export default async function ServicePage({ params }: Props) {
  const { slug } = await params;
  const service = services.find((s) => s.slug === slug);
  if (!service) notFound();

  return <ServicePageClient service={service} />;
}
