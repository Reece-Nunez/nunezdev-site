import Link from "next/link";
import type { BlogPost } from "../types";

const post: BlogPost = {
  slug: "how-much-does-a-small-business-website-cost",
  title: "How Much Does a Small Business Website Cost in 2026?",
  description:
    "A developer's honest breakdown of small business website costs in 2026 — DIY builders vs. freelancers vs. agencies, hidden fees, and what you should actually pay.",
  date: "2026-06-07",
  category: "Pricing & Planning",
  keywords: [
    "small business website cost",
    "how much does a website cost",
    "website cost 2026",
    "web design pricing",
    "custom website cost",
    "website cost Oklahoma",
    "web designer Ponca City",
  ],
  readingTimeMinutes: 7,
  excerpt:
    "Quotes for the same small business website can range from $15 a month to $20,000. Here's why the spread is so wide, what each option actually gets you, and how to avoid paying for things you don't need.",
  faq: [
    {
      question: "How much should a small business website cost?",
      answer:
        "For most small businesses, a professionally built brochure-style website runs between $500 and $5,000 depending on page count, custom features, and who builds it. Simple hand-coded sites can start around $300, while sites with booking, e-commerce, or customer portals cost more.",
    },
    {
      question: "Is a $15/month website builder good enough for my business?",
      answer:
        "It can be, if you just need an online business card and are comfortable building it yourself. The tradeoffs are slower load times, template designs your competitors also use, limited local SEO control, and monthly fees that never end. Many businesses outgrow builders within a year or two.",
    },
    {
      question: "What ongoing costs does a website have?",
      answer:
        "Expect a domain name (around $10–20/year), hosting (often $0–25/month for small sites on modern platforms), and optional maintenance or content updates. Be wary of bundled 'maintenance plans' charging $100+/month for a site that rarely changes.",
    },
    {
      question: "Why do agency quotes cost so much more than freelancers?",
      answer:
        "Agencies carry overhead — project managers, account reps, office costs — that gets built into your quote. You're often paying 2–4x more for the same deliverable. A solo developer or small studio gives you direct access to the person writing the code.",
    },
  ],
  content: (
    <>
      <p>
        Ask five different providers what a small business website costs and
        you&apos;ll get five wildly different answers: $15 a month from Wix,
        $2,000 from a freelancer, $20,000 from an agency. None of them are
        lying — they&apos;re just selling very different things.
      </p>
      <p>
        I build websites and custom software for small businesses here in
        Oklahoma and across the country, so I see these quotes from the other
        side of the table. Here&apos;s an honest breakdown of what you&apos;re
        actually paying for at each price point — and where the money gets
        wasted.
      </p>

      <h2>The three ways to get a website (and what they really cost)</h2>

      <h3>1. DIY website builders: $180–600/year, forever</h3>
      <p>
        Wix, Squarespace, and GoDaddy builders advertise low monthly prices,
        but the math compounds. At $25/month you&apos;ll spend $1,500 over five
        years — and you still don&apos;t own anything. Cancel the subscription
        and the site disappears.
      </p>
      <p>The real costs are the invisible ones:</p>
      <ul>
        <li>
          Template designs that look like every other business in your
          category, because they are.
        </li>
        <li>
          Slower page loads than hand-built sites — and{" "}
          <Link href="/services/seo-optimization">page speed is a ranking
          factor</Link> Google uses to decide who shows up first.
        </li>
        <li>
          Limited control over the technical SEO (schema markup, metadata,
          sitemaps) that helps local businesses win map-pack and search
          rankings.
        </li>
      </ul>
      <p>
        DIY builders make sense if you need an online business card today and
        have more time than budget. Just know what you&apos;re trading.
      </p>

      <h3>2. Freelancers and small studios: $300–10,000</h3>
      <p>
        This is the widest range because &quot;freelancer&quot; covers
        everyone from a student reselling templates to a senior engineer
        building custom software. A few honest reference points:
      </p>
      <ul>
        <li>
          <strong>$300–1,500:</strong> a clean, fast, hand-coded brochure site
          — home, services, about, contact. This is where most local
          businesses should start. (My own{" "}
          <Link href="/pricing">quotes start at $300</Link> for exactly this.)
        </li>
        <li>
          <strong>$1,500–5,000:</strong> more pages, custom design work,
          booking or quote forms, photo galleries, and proper local SEO
          buildout.
        </li>
        <li>
          <strong>$5,000–10,000+:</strong> e-commerce, customer portals,
          dashboards, or{" "}
          <Link href="/services/automation-integration">automation that
          connects your website to the tools you already use</Link> — think
          invoicing, CRMs, and scheduling.
        </li>
      </ul>
      <p>
        The advantage at this tier: you talk directly to the person writing
        the code. No account managers, no telephone game, and changes happen
        in days instead of sprint cycles.
      </p>

      <h3>3. Agencies: $10,000–50,000+</h3>
      <p>
        Agencies do good work, and for large companies with brand guidelines,
        legal review, and six stakeholders, the overhead is worth it. For a
        small business, you&apos;re mostly paying for that overhead — project
        managers, account reps, and office space — stacked on top of the same
        build a good independent developer would deliver.
      </p>
      <p>
        If an agency quote is 3–4x a freelancer quote for the same scope, ask
        specifically what the difference buys you. Sometimes there&apos;s a
        real answer. Often there isn&apos;t.
      </p>

      <h2>The hidden costs nobody puts in the quote</h2>
      <p>
        Wherever you buy, watch for these line items that quietly double the
        lifetime cost of a website:
      </p>
      <ul>
        <li>
          <strong>Mandatory maintenance plans.</strong> $50–150/month
          &quot;maintenance&quot; on a five-page site that changes twice a
          year is profit, not protection. Modern hosting platforms handle
          security patching automatically.
        </li>
        <li>
          <strong>Hosting markup.</strong> Some providers resell $5/month
          hosting at $50/month. Small business sites built on modern stacks
          (like Next.js) can often host for free or nearly free.
        </li>
        <li>
          <strong>You don&apos;t own the site.</strong> If your provider
          disappears or you want to leave, can you take your website with you?
          Get this in writing before you pay anything.
        </li>
        <li>
          <strong>SEO sold separately.</strong> Title tags, schema markup,
          sitemaps, and mobile performance should be part of the build — not a
          $500 add-on for work that takes an experienced developer an hour.
        </li>
      </ul>

      <h2>What actually moves the needle for local businesses</h2>
      <p>
        Here in <Link href="/web-design-ponca-city">Ponca City</Link> and
        towns like it, most of your customers find you one of two ways: Google
        search or Google Maps. A website earns its keep when it&apos;s built
        for both:
      </p>
      <ul>
        <li>
          Fast load times on a phone, because that&apos;s where the majority
          of local searches happen.
        </li>
        <li>
          City-specific pages and schema markup that tell Google exactly where
          you are and what you do.
        </li>
        <li>
          A clear call to action — call, book, or get a quote — above the fold
          on every page.
        </li>
      </ul>
      <p>
        A $300 site that does those three things will outperform a $15,000
        site that doesn&apos;t. I&apos;ve seen it happen more than once — you
        can browse <Link href="/portfolio">real examples in my portfolio</Link>.
      </p>

      <h2>The bottom line</h2>
      <p>
        For most small businesses in 2026, the right answer is a hand-built
        site in the $300–5,000 range from someone who answers their own phone:
        you own the code, hosting costs stay near zero, and local SEO is baked
        in from day one. Pay more only when your business genuinely needs more
        — online ordering, customer portals, custom software.
      </p>
      <p>
        If you want a real number instead of a range,{" "}
        <Link href="/contact">tell me what you&apos;re trying to build</Link>{" "}
        and I&apos;ll give you a flat quote up front. No discovery-call sales
        funnel, no surprises.
      </p>
    </>
  ),
};

export default post;
