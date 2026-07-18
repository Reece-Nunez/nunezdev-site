"use client";

/* Hallmark · macrostructure: Long Document · tone: editorial-utilitarian · anchor hue: brand yellow #ffc312
 * theme: inherited NunezDev system (Lora display + Space Grotesk body, dark glass over ThreeBackground)
 * enrichment: none — typography only
 * states: default · hover · focus-visible · active · disabled · error · restored-draft · success
 * pre-emit critique: P5 H5 E4 S5 R5 V4
 */

import { useState, useEffect, useCallback, FormEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faSpinner,
  faCalendarCheck,
  faCircleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import ThreeBackground from "@/components/ThreeBackground";
import Turnstile from "@/components/Turnstile";
import {
  QUESTIONNAIRE_FIELDS,
  QUESTIONNAIRE_SECTIONS,
  QuestionnaireField,
  REQUIRED_QUESTIONNAIRE_FIELDS,
  fieldsForSection,
  missingRequiredAnswers,
} from "@/lib/questionnaire";

type Status = "idle" | "submitting" | "success" | "error";

// Long forms get abandoned to a stray back-button or a closed tab. Answers are
// mirrored to localStorage on every keystroke and restored on return, then
// cleared once the submission actually lands.
const DRAFT_KEY = "nunezdev:questionnaire-draft";

const EMPTY_VALUES: Record<string, string> = Object.fromEntries(
  QUESTIONNAIRE_FIELDS.map((f) => [f.name, ""])
);

function inputClasses(hasError: boolean) {
  return [
    "w-full rounded-lg px-4 py-3 text-sm text-white placeholder-white/25",
    "bg-white/[0.04] border transition-colors duration-200",
    "hover:border-white/25",
    "focus:outline-none focus:bg-white/[0.07]",
    // A border-colour change alone is too quiet to serve as a keyboard focus
    // indicator; the ring is the actual affordance. Never animated.
    "focus-visible:ring-2 focus-visible:ring-yellow/40",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    hasError
      ? "border-red-400/70 focus:border-red-400"
      : "border-white/15 focus:border-yellow/70",
  ].join(" ");
}

function Field({
  field,
  value,
  error,
  onChange,
}: {
  field: QuestionnaireField;
  value: string;
  error: boolean;
  onChange: (name: string, value: string) => void;
}) {
  const id = `q-${field.name}`;
  const helpId = field.help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;

  // Textareas earn the full row; short inputs pair up on wider screens so the
  // form reads as grouped answers rather than one endless column.
  const spanClass = field.type === "textarea" ? "sm:col-span-2" : "";

  const shared = {
    id,
    name: field.name,
    value,
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => onChange(field.name, e.target.value),
    className: inputClasses(error),
    "aria-invalid": error || undefined,
    "aria-describedby": describedBy,
    "aria-required": field.required || undefined,
  };

  return (
    <div className={spanClass}>
      <label htmlFor={id} className="block text-white/85 text-sm mb-1.5 font-medium">
        {field.label}
        {field.required && (
          <span className="text-yellow ml-1" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {field.type === "textarea" ? (
        <textarea {...shared} rows={field.rows ?? 3} placeholder={field.placeholder} />
      ) : field.type === "select" ? (
        <select {...shared}>
          <option value="">Select an option</option>
          {field.options?.map((option) => (
            <option key={option} value={option} className="bg-gray-900">
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...shared}
          type={field.type}
          placeholder={field.placeholder}
          autoComplete={
            field.name === "name"
              ? "name"
              : field.name === "email"
                ? "email"
                : field.name === "businessName"
                  ? "organization"
                  : "off"
          }
        />
      )}

      {field.help && !error && (
        <p id={helpId} className="text-white/40 text-xs mt-1.5 leading-relaxed">
          {field.help}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-red-400 text-xs mt-1.5 flex items-center gap-1.5">
          <FontAwesomeIcon icon={faCircleExclamation} aria-hidden="true" />
          This one&apos;s required.
        </p>
      )}
    </div>
  );
}

export default function QuestionnaireClient() {
  const reduceMotion = useReducedMotion();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [values, setValues] = useState<Record<string, string>>(EMPTY_VALUES);
  const [draftRestored, setDraftRestored] = useState(false);
  // Gates the save effect. Without it the first post-mount render would write
  // the empty defaults over a real saved draft before the restore lands.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, string>;
        // Only adopt keys that still exist as questions — a saved draft from an
        // older version of the form must not resurrect removed fields.
        const restored = { ...EMPTY_VALUES };
        let any = false;
        for (const field of QUESTIONNAIRE_FIELDS) {
          const v = parsed?.[field.name];
          if (typeof v === "string" && v) {
            restored[field.name] = v;
            any = true;
          }
        }
        if (any) {
          setValues(restored);
          setDraftRestored(true);
        }
      }
    } catch {
      // Private mode, quota, or corrupt JSON — a lost draft is not worth an error.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || status === "success") return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
    } catch {
      // Ignore — saving is a convenience, never a requirement.
    }
  }, [values, hydrated, status]);

  const handleChange = useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    // Clear this field's error the moment it's being fixed; leaving it red
    // while the user types reads as the form not noticing.
    setInvalidFields((prev) => {
      if (!prev.has(name)) return prev;
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
  }, []);

  function clearDraft() {
    setValues(EMPTY_VALUES);
    setInvalidFields(new Set());
    setDraftRestored(false);
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* no-op */
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setErrorMessage(null);

    const missing = missingRequiredAnswers(values);
    if (missing.length) {
      setStatus("error");
      setInvalidFields(new Set(missing));
      setErrorMessage(
        missing.length === 1
          ? "One required question still needs an answer."
          : `${missing.length} required questions still need answers.`
      );
      // Send them straight to the first gap rather than making them hunt.
      const firstEl = document.getElementById(`q-${missing[0]}`);
      firstEl?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "center",
      });
      firstEl?.focus({ preventScroll: true });
      return;
    }

    setStatus("submitting");
    setInvalidFields(new Set());

    const formData = new FormData(form);

    try {
      const res = await fetch("/api/questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          turnstileToken: String(formData.get("cf-turnstile-response") || ""),
          company_website: String(formData.get("company_website") || "").trim(),
        }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error || "Something went wrong. Please try again.");
      }

      setStatus("success");
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* no-op */
      }
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
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
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
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
            A copy of your answers is on its way to your inbox. I&apos;ll read through
            everything and come back within 24 hours with a scope, a timeline, and an
            honest price. Have logo or photo files? Just reply to that email and attach
            them.
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

      {/* Masthead — Long Document opening: standfirst, then the reading contract */}
      <motion.header
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-3xl z-10 mb-14"
      >
        <p className="text-yellow/80 text-xs uppercase tracking-[0.2em] mb-4">
          Project intake
        </p>
        <h1 className="text-yellow text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-5 [overflow-wrap:anywhere]">
          Tell me about your website
        </h1>
        <p className="text-white/60 text-base md:text-lg leading-relaxed max-w-2xl">
          Six short sections, about ten minutes. The more you fill in, the more accurate
          your quote — but answer what you know and leave the rest blank. Only the
          starred questions are required.
        </p>

        <dl className="mt-8 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6">
          {[
            ["Time", "~10 minutes"],
            [
              "Required",
              // Derived, never hand-counted — a hardcoded tally silently goes
              // stale the first time a question is added or removed.
              `${REQUIRED_QUESTIONNAIRE_FIELDS.length} of ${QUESTIONNAIRE_FIELDS.length} questions`,
            ],
            ["Your answers", "Saved as you type"],
          ].map(([term, detail]) => (
            <div key={term}>
              <dt className="text-white/35 text-[11px] uppercase tracking-wider mb-1">
                {term}
              </dt>
              <dd className="text-white/75 text-sm">{detail}</dd>
            </div>
          ))}
        </dl>
      </motion.header>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.12 }}
        className="w-full max-w-3xl z-10"
      >
        {draftRestored && (
          <div className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-yellow/25 bg-yellow/[0.06] px-4 py-3">
            <p className="text-yellow/90 text-sm">
              Picked up where you left off.
            </p>
            <button
              type="button"
              onClick={clearDraft}
              className="text-white/50 text-sm underline underline-offset-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow/60 rounded"
            >
              Start over
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-14" noValidate>
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

          {QUESTIONNAIRE_SECTIONS.map((section) => (
            <section key={section.id} aria-labelledby={`section-${section.id}`}>
              {/* Section head: tag stacked above the heading, never beside it. */}
              <div className="border-t border-white/10 pt-5 mb-7">
                <p className="text-yellow font-mono text-xs tracking-widest mb-2">
                  {section.number}
                </p>
                <h2
                  id={`section-${section.id}`}
                  className="text-white text-xl sm:text-2xl font-bold mb-1.5 [overflow-wrap:anywhere]"
                >
                  {section.title}
                </h2>
                <p className="text-white/45 text-sm leading-relaxed max-w-xl">
                  {section.blurb}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
                {fieldsForSection(section.id).map((field) => (
                  <Field
                    key={field.name}
                    field={field}
                    value={values[field.name] ?? ""}
                    error={invalidFields.has(field.name)}
                    onChange={handleChange}
                  />
                ))}
              </div>
            </section>
          ))}

          <div className="border-t border-white/10 pt-8 space-y-6">
            <Turnstile />

            {errorMessage && (
              <p
                className="text-red-400 text-sm flex items-start gap-2"
                role="alert"
              >
                <FontAwesomeIcon
                  icon={faCircleExclamation}
                  className="mt-0.5"
                  aria-hidden="true"
                />
                {errorMessage}
              </p>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-yellow text-gray-900 font-semibold text-base px-8 py-3.5 rounded-lg shadow transition-shadow duration-300 hover:shadow-[0_0_30px_rgba(255,195,18,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 active:translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {status === "submitting" ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>Send my answers &rarr;</>
                )}
              </button>
              <p className="text-white/40 text-xs">
                You&apos;ll get a copy by email. No spam, no hard sell.
              </p>
            </div>
          </div>
        </form>
      </motion.div>
    </main>
  );
}
