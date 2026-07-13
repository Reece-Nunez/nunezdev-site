import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faCalendarCheck } from "@fortawesome/free-solid-svg-icons";
import { PHONE_DISPLAY, PHONE_TEL } from "@/lib/contact";
import ThreeBackground from "@/components/ThreeBackground";

// Dedicated post-submit landing page. The LeadForm redirects here on a
// successful POST so that:
//   1. Google Ads can count a clean "page load: /contact/thanks" conversion
//      (the old rule fired on /contact itself, which every ad click hits).
//   2. Success is a distinct page view in GA4 rather than inline state.
// Noindexed — this page only makes sense after a form submission.

export const metadata = {
  title: "Message Sent | NunezDev",
  description: "Thanks for reaching out — I'll reply within 24 hours.",
  robots: { index: false, follow: false },
  alternates: {
    canonical: "https://www.nunezdev.com/contact/thanks",
  },
};

export default function ContactThanksPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 pt-32 pb-24 text-offwhite">
      <ThreeBackground />
      <div className="bg-white/5 backdrop-blur-sm border border-yellow/40 rounded-2xl p-8 sm:p-12 text-center max-w-lg z-10">
        <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
          <FontAwesomeIcon icon={faCheck} className="text-green-400 text-xl" />
        </div>
        <h1 className="text-yellow text-2xl sm:text-3xl font-bold mb-3">
          Got it &mdash; message sent.
        </h1>
        <p className="text-white/70 mb-2">
          I&apos;ll personally reply within 24 hours with honest thoughts, a
          rough scope, and a ballpark price.
        </p>
        <p className="text-white/50 text-sm mb-6">
          Urgent? Call or text me at{" "}
          <a href={`tel:${PHONE_TEL}`} className="text-yellow hover:underline">
            {PHONE_DISPLAY}
          </a>
          .
        </p>

        {/* Peak-intent booking CTA. The moment right after submit is when a
            lead is most ready to talk — offer a calendar instead of making them
            wait a day for a reply. Primary action; /book is the self-hosted
            scheduler. */}
        <Link
          href="/book"
          className="inline-flex items-center justify-center gap-2 w-full sm:w-auto bg-yellow text-gray-900 font-semibold text-base px-8 py-3.5 rounded-lg shadow hover:shadow-[0_0_30px_rgba(255,195,18,0.3)] transition-shadow duration-300"
        >
          <FontAwesomeIcon icon={faCalendarCheck} />
          Book a call now
        </Link>
        <p className="text-white/40 text-xs mt-3 mb-8">
          Rather not wait? Grab a free 30-minute slot that works for you.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link
            href="/portfolio"
            className="inline-block text-sm text-white border border-white/20 px-6 py-2.5 rounded-lg font-medium hover:bg-white hover:text-gray-800 transition"
          >
            View My Work
          </Link>
          <Link
            href="/"
            className="inline-block text-sm text-white border border-white/20 px-6 py-2.5 rounded-lg font-medium hover:bg-white hover:text-gray-800 transition"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
