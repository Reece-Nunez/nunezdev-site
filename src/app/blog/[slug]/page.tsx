import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";
import { posts, getPostBySlug } from "@/data/blog";
import BreadcrumbJsonLd from "@/components/BreadcrumbJsonLd";
import ThreeBackground from "@/components/ThreeBackground";

const BASE_URL = "https://www.nunezdev.com";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  const url = `${BASE_URL}/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.description,
      url,
      siteName: "NunezDev",
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.updated ?? post.date,
      authors: ["Reece Nunez"],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const url = `${BASE_URL}/blog/${post.slug}`;

  return (
    <main className="flex min-h-screen flex-col items-center text-offwhite overflow-hidden pt-24">
      <ThreeBackground />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: BASE_URL },
          { name: "Blog", url: `${BASE_URL}/blog` },
          { name: post.title, url },
        ]}
      />
      <Script
        id={`article-jsonld-${post.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.description,
            url,
            datePublished: post.date,
            dateModified: post.updated ?? post.date,
            author: {
              "@type": "Person",
              name: "Reece Nunez",
              url: `${BASE_URL}/about`,
            },
            publisher: {
              "@type": "Organization",
              name: "NunezDev",
              url: BASE_URL,
              logo: {
                "@type": "ImageObject",
                url: `${BASE_URL}/logo.png`,
              },
            },
            mainEntityOfPage: { "@type": "WebPage", "@id": url },
          }),
        }}
      />
      {post.faq && post.faq.length > 0 && (
        <Script
          id={`faq-jsonld-${post.slug}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: post.faq.map((f) => ({
                "@type": "Question",
                name: f.question,
                acceptedAnswer: { "@type": "Answer", text: f.answer },
              })),
            }),
          }}
        />
      )}

      <article className="w-full max-w-3xl px-4 sm:px-6 py-12 sm:py-16">
        {/* Header */}
        <header className="mb-10">
          <Link
            href="/blog"
            className="text-yellow/70 text-sm font-medium hover:text-yellow transition-colors"
          >
            &larr; All posts
          </Link>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/50 mt-6 mb-4">
            <span className="text-yellow/80 font-medium">{post.category}</span>
            <span aria-hidden>•</span>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span aria-hidden>•</span>
            <span>{post.readingTimeMinutes} min read</span>
          </div>
          <h1 className="text-yellow text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-[1.15]">
            {post.title}
          </h1>
          <p className="text-white/60 text-sm mt-5">
            By{" "}
            <Link href="/about" className="text-white/80 hover:text-yellow">
              Reece Nunez
            </Link>
            , owner &amp; developer at NunezDev
          </p>
        </header>

        {/* Body — styles bare tags written in post content */}
        <div
          className="
            text-white/80 leading-relaxed
            [&_p]:mb-5
            [&_h2]:text-yellow [&_h2]:text-2xl [&_h2]:sm:text-3xl [&_h2]:font-bold [&_h2]:mt-12 [&_h2]:mb-4
            [&_h3]:text-white [&_h3]:text-xl [&_h3]:sm:text-2xl [&_h3]:font-semibold [&_h3]:mt-8 [&_h3]:mb-3
            [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-5 [&_ul]:space-y-2
            [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-5 [&_ol]:space-y-2
            [&_a]:text-yellow [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-yellow/80
            [&_strong]:text-white
            [&_blockquote]:border-l-2 [&_blockquote]:border-yellow/60 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-white/70 [&_blockquote]:mb-5
          "
        >
          {post.content}
        </div>

        {/* FAQ */}
        {post.faq && post.faq.length > 0 && (
          <section className="mt-14">
            <h2 className="text-yellow text-2xl sm:text-3xl font-bold mb-6">
              Frequently asked questions
            </h2>
            <div className="flex flex-col gap-4">
              {post.faq.map((f) => (
                <div
                  key={f.question}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6"
                >
                  <h3 className="text-white font-semibold text-lg mb-2">
                    {f.question}
                  </h3>
                  <p className="text-white/70 leading-relaxed">{f.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <aside className="mt-14 bg-white/5 backdrop-blur-sm border border-yellow/30 rounded-xl p-8 text-center">
          <h2 className="text-yellow text-2xl font-bold mb-3">
            Have a project in mind?
          </h2>
          <p className="text-white/70 max-w-xl mx-auto mb-6">
            I build custom websites, portals, and automation for small
            businesses — flat quotes up front, and you talk directly to the
            developer.
          </p>
          <Link
            href="/contact"
            className="inline-block bg-yellow text-gray-900 font-semibold px-8 py-3.5 rounded-lg hover:bg-yellow/80 transition-colors"
          >
            Get a Free Quote &rarr;
          </Link>
        </aside>
      </article>
    </main>
  );
}
