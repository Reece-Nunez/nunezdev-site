"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThreeBackground from "@/components/ThreeBackground";
import CustomBooking from "@/components/CustomBooking";

/**
 * Dedicated /book page. Every follow-up email and SMS points a "schedule a
 * consultation" CTA here (previously a dead link — /book 404'd, which quietly
 * killed booked calls from the nurture sequence). It mounts the existing
 * self-hosted scheduler open on load; closing it returns to /contact so the
 * visitor still lands on a real page instead of an empty backdrop.
 */
export default function BookClient() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);

  const handleClose = () => {
    setIsOpen(false);
    router.push("/contact");
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-24 text-offwhite overflow-hidden">
      <ThreeBackground />

      {/* Fallback content shown behind the scheduler modal (and if it's closed
          mid-navigation) so the page is never blank. */}
      <div className="max-w-xl text-center z-10 space-y-4">
        <h1 className="text-yellow text-3xl sm:text-4xl font-bold tracking-tight">
          Book a free discovery call
        </h1>
        <p className="text-white/60 text-base sm:text-lg">
          Pick a time that works for you. No pressure, no hard sell — we&apos;ll
          talk through your goals, and you&apos;ll walk away with a clear plan.
        </p>
        <p className="text-white/40 text-sm">
          Prefer to send details first?{" "}
          <Link href="/contact" className="text-yellow hover:underline">
            Use the contact form
          </Link>
          .
        </p>
      </div>

      <CustomBooking isOpen={isOpen} onClose={handleClose} />
    </main>
  );
}
