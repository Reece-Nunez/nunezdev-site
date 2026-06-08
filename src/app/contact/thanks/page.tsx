import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { PHONE_DISPLAY, PHONE_TEL } from "@/lib/contact";

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
        <p className="text-white/50 text-sm mb-8">
          Urgent? Call or text me at{" "}
          <a href={`tel:${PHONE_TEL}`} className="text-yellow hover:underline">
            {PHONE_DISPLAY}
          </a>
          .
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
