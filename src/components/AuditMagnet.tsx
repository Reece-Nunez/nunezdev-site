"use client";

import { useState, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faSpinner,
  faMagnifyingGlass,
} from "@fortawesome/free-solid-svg-icons";
import Turnstile from "@/components/Turnstile";
import { trackEvent } from "@/lib/gtag";

// Low-friction lead magnet for cold/research-stage traffic. Captures URL +
// email so Reece can record a 5-minute audit Loom and reply manually. Sits
// on the homepage as the "not ready to talk yet" path next to the booking CTA.

type Status = "idle" | "submitting" | "success" | "error";

export default function AuditMagnet() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Capture the form ref synchronously — React nulls event.currentTarget
    // after any `await`, so reset() below would otherwise throw.
    const form = event.currentTarget;
    setStatus("submitting");
    setErrorMessage(null);

    const formData = new FormData(form);
    const websiteUrl = String(formData.get("websiteUrl") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const name = String(formData.get("name") || "").trim();

    if (!websiteUrl || !email || !name) {
      setStatus("error");
      setErrorMessage("Name, email, and a website URL are required.");
      return;
    }

    const payload = {
      name,
      email,
      message: `Audit request for: ${websiteUrl}`,
      subject: "Free website audit request",
      source: "free_website_audit",
      projectType: "Free website audit",
      turnstileToken: String(formData.get("cf-turnstile-response") || ""),
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong. Please try again.");
      }

      trackEvent("audit_request_submit", { source: "homepage" });
      setStatus("success");
      form.reset();
    } catch (err: unknown) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    }
  }

  return (
    <section className="relative w-full max-w-5xl px-4 sm:px-6 z-10 py-16 sm:py-24">
      <div className="bg-gradient-to-br from-yellow/10 via-white/5 to-transparent border border-yellow/30 rounded-2xl p-6 sm:p-10 md:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          {/* Pitch */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-yellow/10 border border-yellow/30 rounded-full px-3 py-1 mb-4">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="text-yellow text-xs" />
              <span className="text-yellow text-xs font-semibold uppercase tracking-wider">
                Free, no calls required
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-yellow mb-4 tracking-tight">
              Free 5-Minute Website Audit
            </h2>
            <p className="text-white/70 text-base md:text-lg leading-relaxed">
              Drop your URL and I'll send back a personal Loom video walking
              through what's costing you leads — speed, copy, mobile UX, SEO
              gaps. No sales pitch, no calendar booking required.
            </p>
            <ul className="mt-5 space-y-2 text-white/60 text-sm">
              {[
                "Recorded by me, not an AI tool",
                "Delivered within 48 hours",
                "Yours to keep, no strings",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 justify-center lg:justify-start">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                    <FontAwesomeIcon icon={faCheck} className="text-green-400 text-[10px]" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Form */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 sm:p-6">
            <AnimatePresence mode="wait">
              {status === "success" ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-8"
                >
                  <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                    <FontAwesomeIcon icon={faCheck} className="text-green-400 text-xl" />
                  </div>
                  <h3 className="text-yellow text-xl font-bold mb-2">Audit on the way.</h3>
                  <p className="text-white/60 text-sm">
                    I'll send your personal Loom video within 48 hours.
                  </p>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onSubmit={handleSubmit}
                  className="space-y-4"
                  noValidate
                >
                  <div>
                    <label htmlFor="audit-name" className="block text-white/70 text-xs uppercase tracking-wider mb-1.5 font-medium">
                      Your name
                    </label>
                    <input
                      id="audit-name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      required
                      className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-yellow/60 focus:bg-white/10 transition-colors"
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div>
                    <label htmlFor="audit-email" className="block text-white/70 text-xs uppercase tracking-wider mb-1.5 font-medium">
                      Email
                    </label>
                    <input
                      id="audit-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-yellow/60 focus:bg-white/10 transition-colors"
                      placeholder="jane@business.com"
                    />
                  </div>
                  <div>
                    <label htmlFor="audit-url" className="block text-white/70 text-xs uppercase tracking-wider mb-1.5 font-medium">
                      Website to audit
                    </label>
                    <input
                      id="audit-url"
                      name="websiteUrl"
                      type="url"
                      required
                      className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-yellow/60 focus:bg-white/10 transition-colors"
                      placeholder="https://yourbusiness.com"
                    />
                  </div>

                  <Turnstile />

                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    className="w-full inline-flex items-center justify-center gap-2 bg-yellow text-gray-900 font-semibold text-base px-6 py-3 rounded-lg hover:shadow-[0_0_20px_rgba(255,195,18,0.3)] transition-shadow duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {status === "submitting" ? (
                      <>
                        <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>Send me my free audit &rarr;</>
                    )}
                  </button>

                  {errorMessage && (
                    <p className="text-red-400 text-sm" role="alert">
                      {errorMessage}
                    </p>
                  )}
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
