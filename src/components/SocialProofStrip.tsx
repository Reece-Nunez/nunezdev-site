"use client";

import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar } from "@fortawesome/free-solid-svg-icons";
import { testimonials } from "@/data/testimonials";
import { REVIEW_SUMMARY } from "@/lib/contact";

// Lightweight trust strip rendered immediately under the hero so the
// social proof reinforces the primary CTA instead of waiting four scrolls.
// Picks the first short-ish testimonial as the inline quote.
export default function SocialProofStrip() {
  // Use the shortest testimonial so the strip stays scannable above the fold.
  const featured = testimonials.length
    ? [...testimonials].sort((a, b) => a.quote.length - b.quote.length)[0]
    : null;

  if (!featured) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative w-full max-w-5xl px-4 sm:px-6 z-10 -mt-4 sm:-mt-2"
      aria-label="Client reviews summary"
    >
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 bg-white/5 backdrop-blur-sm border border-yellow/20 rounded-2xl px-6 py-5 text-center sm:text-left">
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <FontAwesomeIcon key={i} icon={faStar} className="text-yellow text-base" />
            ))}
          </div>
          <span className="text-white font-bold">
            {REVIEW_SUMMARY.rating.toFixed(1)}
          </span>
          <span className="text-white/50 text-sm">
            from {REVIEW_SUMMARY.count}+ reviews
          </span>
        </div>

        <div className="hidden sm:block w-px h-10 bg-white/10" />

        <blockquote className="text-white/80 text-sm sm:text-base italic flex-1">
          &ldquo;{featured.quote}&rdquo;
          <span className="block text-white/40 text-xs not-italic mt-1">
            — {featured.name}
            {featured.company ? `, ${featured.company}` : ""}
          </span>
        </blockquote>
      </div>
    </motion.section>
  );
}
