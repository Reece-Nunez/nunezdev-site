"use client";

import { useState, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faSpinner } from "@fortawesome/free-solid-svg-icons";
import Turnstile from "@/components/Turnstile";
import { trackEvent } from "@/lib/gtag";

// Qualifying lead form. POSTs to /api/contact (extended to accept
// projectType / budget / timeline / source) so all leads flow through the
// same nurture pipeline as the legacy contact form.
//
// Pass `source` from each surface ("contact_page", "homepage_hero", etc.)
// so notification emails make the entry point obvious.

const PROJECT_TYPES = [
  "Marketing website",
  "Custom web app / dashboard",
  "Client portal or CRM",
  "Automation / API integration",
  "Redesign of an existing site",
  "Not sure yet",
];

const BUDGET_RANGES = [
  "Under $1,000",
  "$1,000 – $3,000",
  "$3,000 – $7,000",
  "$7,000 – $15,000",
  "$15,000+",
  "Need help scoping",
];

const TIMELINES = [
  "ASAP / this month",
  "Next 1 – 2 months",
  "3+ months out",
  "Just exploring",
];

type Status = "idle" | "submitting" | "success" | "error";

export default function LeadForm({
  source,
  compact = false,
}: {
  source: string;
  compact?: boolean;
}) {
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
    const payload = {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      company: String(formData.get("company") || "").trim(),
      projectType: String(formData.get("projectType") || ""),
      budget: String(formData.get("budget") || ""),
      timeline: String(formData.get("timeline") || ""),
      message: String(formData.get("message") || "").trim(),
      smsConsent: formData.get("smsConsent") === "on",
      turnstileToken: String(formData.get("cf-turnstile-response") || ""),
      source,
      subject: `Lead from ${source}`,
    };

    if (!payload.name || !payload.email || !payload.message) {
      setStatus("error");
      setErrorMessage("Name, email, and a short message are required.");
      return;
    }

    // Twilio A2P 10DLC requires that a phone number cannot be used for SMS
    // without an actively-checked consent box. If a phone is provided but
    // the user did not opt in, reject the submission rather than silently
    // storing the number.
    if (payload.phone && !payload.smsConsent) {
      setStatus("error");
      setErrorMessage(
        "To include a phone number, please check the SMS consent box. You can leave the phone field blank if you'd rather not receive texts.",
      );
      return;
    }

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

      trackEvent("lead_form_submit", {
        source,
        project_type: payload.projectType,
        budget: payload.budget,
      });
      setStatus("success");
      form.reset();
    } catch (err: unknown) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    }
  }

  if (status === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 backdrop-blur-sm border border-yellow/40 rounded-2xl p-8 text-center"
      >
        <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
          <FontAwesomeIcon icon={faCheck} className="text-green-400 text-xl" />
        </div>
        <h3 className="text-yellow text-2xl font-bold mb-2">Got it — message sent.</h3>
        <p className="text-white/70 max-w-md mx-auto">
          I'll personally reply within 24 hours with next steps. If it's urgent,
          call or text me directly.
        </p>
      </motion.div>
    );
  }

  const inputCls =
    "w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-yellow/60 focus:bg-white/10 transition-colors";
  const labelCls =
    "block text-white/70 text-xs uppercase tracking-wider mb-1.5 font-medium";

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className={compact ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : "grid grid-cols-1 md:grid-cols-2 gap-4"}>
        <div>
          <label htmlFor="lead-name" className={labelCls}>
            Your name *
          </label>
          <input
            id="lead-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            className={inputCls}
            placeholder="Jane Doe"
          />
        </div>
        <div>
          <label htmlFor="lead-email" className={labelCls}>
            Email *
          </label>
          <input
            id="lead-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={inputCls}
            placeholder="jane@business.com"
          />
        </div>
        <div>
          <label htmlFor="lead-phone" className={labelCls}>
            Phone
          </label>
          <input
            id="lead-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            className={inputCls}
            placeholder="(555) 123-4567"
            aria-describedby="lead-phone-help"
          />
          <p id="lead-phone-help" className="text-white/40 text-[11px] mt-1">
            Optional. Required only if you&apos;d like an SMS reply (see consent below).
          </p>
        </div>
        <div>
          <label htmlFor="lead-company" className={labelCls}>
            Business name
          </label>
          <input
            id="lead-company"
            name="company"
            type="text"
            autoComplete="organization"
            className={inputCls}
            placeholder="Acme Co."
          />
        </div>
        <div>
          <label htmlFor="lead-project-type" className={labelCls}>
            What do you need?
          </label>
          <select id="lead-project-type" name="projectType" className={inputCls} defaultValue="">
            <option value="" disabled>
              Select a project type
            </option>
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t} className="bg-gray-900">
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="lead-budget" className={labelCls}>
            Budget range
          </label>
          <select id="lead-budget" name="budget" className={inputCls} defaultValue="">
            <option value="" disabled>
              Select a budget
            </option>
            {BUDGET_RANGES.map((b) => (
              <option key={b} value={b} className="bg-gray-900">
                {b}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="lead-timeline" className={labelCls}>
          When do you want to start?
        </label>
        <select id="lead-timeline" name="timeline" className={inputCls} defaultValue="">
          <option value="" disabled>
            Select a timeline
          </option>
          {TIMELINES.map((t) => (
            <option key={t} value={t} className="bg-gray-900">
              {t}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="lead-message" className={labelCls}>
          Tell me about your project *
        </label>
        <textarea
          id="lead-message"
          name="message"
          rows={4}
          required
          className={inputCls}
          placeholder="A few sentences on what you're trying to build, what you've tried, and any links to inspiration."
        />
      </div>

      {/* A2P 10DLC SMS opt-in. Required by Twilio and the CTIA: the checkbox
          must be unchecked by default and the disclosure must include message
          purpose, frequency, msg&data rates, HELP/STOP, and links to terms
          and privacy. */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
        <label
          htmlFor="lead-sms-consent"
          className="flex items-start gap-3 cursor-pointer"
        >
          <input
            id="lead-sms-consent"
            name="smsConsent"
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-white/30 bg-white/10 text-yellow focus:ring-yellow/60 focus:ring-offset-0 cursor-pointer accent-yellow"
          />
          <span className="text-white/70 text-xs leading-relaxed">
            By checking this box, I agree to receive SMS messages from NunezDev
            including invoice reminders, project updates, customer service
            responses, and occasional promotional offers. Message frequency
            varies. Message and data rates may apply. Reply STOP to opt out,
            HELP for help. Consent is not a condition of purchase. See our{' '}
            <a
              href="/sms-terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow hover:underline"
            >
              SMS Terms
            </a>{' '}
            and{' '}
            <a
              href="/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow hover:underline"
            >
              Privacy Policy
            </a>
            .
          </span>
        </label>
      </div>

      <Turnstile />

      <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={status === "submitting"}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-yellow text-gray-900 font-semibold text-base px-8 py-3.5 rounded-lg shadow hover:shadow-[0_0_30px_rgba(255,195,18,0.3)] transition-shadow duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {status === "submitting" ? (
            <>
              <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
              Sending...
            </>
          ) : (
            <>Get my free quote &rarr;</>
          )}
        </button>
        <p className="text-white/40 text-xs">
          Reply within 24 hours. No spam, no hard sell.
        </p>
      </div>

      <AnimatePresence>
        {errorMessage && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-red-400 text-sm"
            role="alert"
          >
            {errorMessage}
          </motion.p>
        )}
      </AnimatePresence>
    </form>
  );
}
