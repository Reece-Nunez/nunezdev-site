import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { posts } from "@/data/blog";

const BASE_URL = "https://www.nunezdev.com";

export const metadata: Metadata = {
  title: "Blog | Web Design & Software Tips for Small Businesses",
  description:
    "Practical advice on websites, local SEO, automation, and custom software for small businesses — from a developer in Ponca City, Oklahoma.",
  keywords: [
    "small business website tips",
    "web design blog",
    "local SEO Oklahoma",
    "custom software blog",
    "NunezDev blog",
  ],
  alternates: {
    canonical: `${BASE_URL}/blog`,
  },
  openGraph: {
    title: "NunezDev Blog | Web Design & Software Tips for Small Businesses",
    description:
      "Practical advice on websites, local SEO, automation, and custom software for small businesses.",
    url: `${BASE_URL}/blog`,
    siteName: "NunezDev",
    type: "website",
  },
};

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogPage() {
  return (
    <main className="flex min-h-screen flex-col items-center text-offwhite overflow-hidden pt-24">
      <Script
        id="blog-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Blog",
            name: "NunezDev Blog",
            url: `${BASE_URL}/blog`,
            description:
              "Practical advice on websites, local SEO, automation, and custom software for small businesses.",
            publisher: {
              "@type": "Organization",
              name: "NunezDev",
              url: BASE_URL,
            },
            blogPost: posts.map((post) => ({
              "@type": "BlogPosting",
              headline: post.title,
              url: `${BASE_URL}/blog/${post.slug}`,
              datePublished: post.date,
            })),
          }),
        }}
      />

      {/* Hero */}
      <section className="w-full max-w-5xl px-4 sm:px-6 py-16 sm:py-20 text-center">
        <p className="text-yellow/70 text-sm uppercase tracking-[0.2em] font-medium mb-4">
          The NunezDev Blog
        </p>
        <h1 className="text-yellow text-3xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
          Straight answers about websites
          <br className="hidden sm:block" /> and software for small business.
        </h1>
        <p className="text-white/70 text-base md:text-lg max-w-2xl mx-auto mt-6">
          No jargon, no sales funnels — just what I&apos;ve learned building
          websites, portals, and automation for businesses in Oklahoma and
          beyond.
        </p>
      </section>

      {/* Post list */}
      <section className="w-full max-w-3xl px-4 sm:px-6 pb-24">
        <div className="flex flex-col gap-6">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 sm:p-8 hover:border-yellow/40 transition-colors"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/50 mb-3">
                <span className="text-yellow/80 font-medium">
                  {post.category}
                </span>
                <span aria-hidden>•</span>
                <time dateTime={post.date}>{formatDate(post.date)}</time>
                <span aria-hidden>•</span>
                <span>{post.readingTimeMinutes} min read</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-semibold text-white group-hover:text-yellow transition-colors">
                {post.title}
              </h2>
              <p className="text-white/70 mt-3 leading-relaxed">
                {post.excerpt}
              </p>
              <span className="inline-block mt-4 text-yellow font-medium">
                Read the post &rarr;
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
