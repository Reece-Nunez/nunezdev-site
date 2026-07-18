"use client";

import { useState, FormEvent } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faSpinner, faCalendarCheck } from "@fortawesome/free-solid-svg-icons";
import ThreeBackground from "@/components/ThreeBackground";
import Turnstile from "@/components/Turnstile";
import {
  QUESTIONNAIRE_FIELDS,
  QuestionnaireField,
  missingRequiredAnswers,
} from "@/lib/questionnaire";

type Status = "idle" | "submitting" | "success" | "error";

const inputCls =
  "w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-yellow/60 focus:bg-white/10 transition-colors";
const labelCls = "block text-white/80 text-sm mb-1.5 font-medium";

function Field({ field }: { field: QuestionnaireField }) {
  const id = `q-${field.name}`;
  const describedBy = field.help ? `${id}-help` : undefined;

  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {field.label}
        {field.required && <span className="text-yellow ml-1">*</span>}
      </label>
      {field.type === "textarea" ? (
        <textarea
          id={id}
          name={field.name}
          rows={field.rows ?? 3}
          required={field.required}
          className={inputCls}
          placeholder={field.placeholder}
          aria-describedby={describedBy}
        />
      ) : field.type === "select" ? (
        <select
          id={id}
          name={field.name}
          required={field.required}
          className={inputCls}
          defaultValue=""
          aria-describedby={describedBy}
        >
          <option value="">Select an option</option>
          {field.options?.map((option) => (
            <option key={option} value={option} className="bg-gray-900">
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          name={field.name}
          type={field.type}
          required={field.required}
          className={inputCls}
          placeholder={field.placeholder}
          autoComplete={
            field.name === "name" ? "name" : field.name === "email" ? "email" : "off"
          }
          aria-describedby={describedBy}
        />
      )}
      {field.help && (
        <p id={describedBy} className="text-white/40 text-xs mt-1.5">
          {field.help}
        </p>
      )}
    </div>
  );
}

export default function QuestionnaireClient() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const answers: Record<string, string> = {};
    for (const field of QUESTIONNAIRE_FIELDS) {
      answers[field.name] = String(formData.get(field.name) ?? "").trim();
    }

    const missing = missingRequiredAnswers(answers);
    if (missing.length) {
      setStatus("error");
      setErrorMessage("Please answer the questions marked with a star.");
      return;
    }

    try {
      const res = await fetch("/api/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...answers,
          turnstileToken: String(formData.get("cf-turnstile-response") || ""),
          company_website: String(formData.get("company_website") || "").trim(),
        }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error || "Something went wrong. Please try again.");
      }

      setStatus("success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: unknown) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    }
  }

  if (status === "success") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-32 text-offwhite overflow-hidden">
        <ThreeBackground />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="z-10 bg-white/5 backdrop-blur-sm border border-yellow/40 rounded-2xl p-8 sm:p-12 text-center max-w-xl"
        >
          <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-5">
            <FontAwesomeIcon icon={faCheck} className="text-green-400 text-xl" />
          </div>
          <h1 className="text-yellow text-2xl sm:text-3xl font-bold mb-3">
            Got it — thank you.
          </h1>
          <p className="text-white/70 mb-8 leading-relaxed">
            A copy of your answers is on its way to your inbox. I&apos;ll review
            everything and follow up within 24 hours with a scope, a timeline, and
            an honest price. Have logo or photo files? Just reply to that email.
          </p>
          <Link
            href="/book"
            className="inline-flex items-center justify-center gap-2 bg-yellow text-gray-900 font-semibold text-base px-8 py-3.5 rounded-lg shadow hover:shadow-[0_0_30px_rgba(255,195,18,0.3)] transition-shadow duration-300"
          >
            <FontAwesomeIcon icon={faCalendarCheck} />
            Book a call to walk through it
          </Link>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center px-4 pt-32 pb-24 text-offwhite overflow-hidden">
      <ThreeBackground />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-3xl text-center mb-12 z-10"
      >
        <h1 className="text-yellow text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-5">
          Website Questionnaire
        </h1>
        <p className="text-white/60 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
          The more you tell me here, the more accurate your quote and the faster we
          can start. Takes about 10 minutes — answer what you can and leave the rest
          blank. Only the starred questions are required.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="w-full max-w-3xl z-10 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 sm:p-8 md:p-10"
      >
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Honeypot — off-screen rather than display:none so bots that skip
              hidden fields still fill it. Any value flags the request server-side. */}
          <div
            aria-hidden="true"
            style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}
          >
            <label htmlFor="company_website">Company website (leave blank)</label>
            <input
              id="company_website"
              name="company_website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          {QUESTIONNAIRE_FIELDS.map((field) => (
            <Field key={field.name} field={field} />
          ))}

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
                  Submitting...
                </>
              ) : (
                <>Submit questionnaire &rarr;</>
              )}
            </button>
            <p className="text-white/40 text-xs">
              You&apos;ll get a copy of your answers by email.
            </p>
          </div>

          {errorMessage && (
            <p className="text-red-400 text-sm" role="alert">
              {errorMessage}
            </p>
          )}
        </form>
      </motion.div>
    </main>
  );
}
