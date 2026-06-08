import type { ReactNode } from "react";

export interface BlogFaq {
  question: string;
  answer: string;
}

export interface BlogSource {
  /** Display title of the cited source. */
  title: string;
  /** Publisher or site name, e.g. "Google", "BrightLocal". */
  publisher?: string;
  /** Full URL to the source. */
  url: string;
  /** Optional year of the data/report, e.g. "2025". */
  year?: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  /** Meta description — keep under ~155 chars. */
  description: string;
  /** ISO date, e.g. "2026-06-07" */
  date: string;
  /** ISO date of last significant update (optional). */
  updated?: string;
  category: string;
  keywords: string[];
  readingTimeMinutes: number;
  /** Short teaser shown on the blog listing page. */
  excerpt: string;
  /** Optional FAQ rendered on-page and emitted as FAQPage JSON-LD. */
  faq?: BlogFaq[];
  /** Cited sources for any statistics or factual claims in the post. */
  sources?: BlogSource[];
  /** Post body as JSX. Use bare h2/h3/p/ul/ol/a/blockquote tags — PostBody styles them. */
  content: ReactNode;
}
