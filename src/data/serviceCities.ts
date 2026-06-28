// City landing pages for local SEO. Each entry renders /web-design/[city] via
// the dynamic route. Ponca City is intentionally NOT here — it has its own
// hand-tuned page at /web-design-ponca-city (don't duplicate that URL).

export const REGION = "Oklahoma";

export interface ServiceCity {
  slug: string;
  city: string;
  /** Nearby towns named in copy + areaServed schema to widen the local net. */
  nearby: string[];
}

export const serviceCities: ServiceCity[] = [
  { slug: "stillwater", city: "Stillwater", nearby: ["Ponca City", "Perkins", "Cushing", "Guthrie", "Oklahoma City"] },
  { slug: "enid", city: "Enid", nearby: ["Ponca City", "Kingfisher", "Hennessey", "Stillwater", "Oklahoma City"] },
  { slug: "bartlesville", city: "Bartlesville", nearby: ["Ponca City", "Dewey", "Pawhuska", "Owasso", "Tulsa"] },
  { slug: "tulsa", city: "Tulsa", nearby: ["Owasso", "Broken Arrow", "Bartlesville", "Sand Springs", "Bixby"] },
  { slug: "oklahoma-city", city: "Oklahoma City", nearby: ["Edmond", "Norman", "Moore", "Yukon", "Stillwater"] },
  { slug: "edmond", city: "Edmond", nearby: ["Oklahoma City", "Guthrie", "Norman", "Stillwater", "Yukon"] },
  { slug: "norman", city: "Norman", nearby: ["Oklahoma City", "Moore", "Edmond", "Noble", "Purcell"] },
  { slug: "owasso", city: "Owasso", nearby: ["Tulsa", "Bartlesville", "Collinsville", "Claremore", "Broken Arrow"] },
  { slug: "broken-arrow", city: "Broken Arrow", nearby: ["Tulsa", "Bixby", "Owasso", "Coweta", "Jenks"] },
];

export function getServiceCity(slug: string): ServiceCity | undefined {
  return serviceCities.find((c) => c.slug === slug);
}
