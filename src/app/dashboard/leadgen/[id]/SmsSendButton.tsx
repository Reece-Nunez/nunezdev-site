"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import {
  PaperAirplaneIcon,
  XMarkIcon,
  CheckIcon,
  ShieldCheckIcon,
  NoSymbolIcon,
} from "@heroicons/react/24/outline";
import { recordSmsConsent, sendSmsOutreach } from "../actions";
import { SMS_CONSENT_BASES, smsConsentLabel } from "../utils";
import type { SmsConsentBasis } from "@/lib/leadgen-api";

interface Props {
  businessId: number;
  phone: string | null;
  consentBasis: SmsConsentBasis | null;
  optedOut: boolean;
}

/**
 * SMS send affordance with a built-in consent gate. State machine:
 *   opted out      → blocked badge (they replied STOP)
 *   no phone       → muted "no number"
 *   no consent     → record-consent form (lawful basis the operator attests to)
 *   consent on file→ Send SMS (confirm) — all other guardrails (opt-out, quiet
 *                    hours, sender ID + STOP) are enforced server-side.
 */
export default function SmsSendButton({ businessId, phone, consentBasis, optedOut }: Props) {
  const [isPending, startTransition] = useTransition();
  const [recording, setRecording] = useState(false);
  const [basis, setBasis] = useState<SmsConsentBasis>(SMS_CONSENT_BASES[0].value);
  const [note, setNote] = useState("");

  if (optedOut) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border bg-red-50 text-red-700 border-red-200">
        <NoSymbolIcon className="w-3.5 h-3.5" />
        Opted out (STOP)
      </span>
    );
  }

  if (!phone) {
    return <span className="text-xs text-gray-500 italic">No phone on file</span>;
  }

  function saveConsent() {
    startTransition(async () => {
      const result = await recordSmsConsent(businessId, basis, note);
      if (result.ok) {
        toast.success("Consent recorded");
        setRecording(false);
        setNote("");
      } else {
        toast.error(result.message);
      }
    });
  }

  function send() {
    startTransition(async () => {
      const result = await sendSmsOutreach(businessId);
      if (result.ok) toast.success("SMS sent");
      else toast.error(result.message);
    });
  }

  function confirmSend() {
    toast(
      (t) => (
        <div className="flex items-start gap-3 text-sm">
          <div className="flex-1">
            <div className="font-medium text-gray-900">Send this text?</div>
            <div className="text-xs text-gray-600 mt-0.5">To: {phone}</div>
            <div className="text-[11px] text-gray-500 mt-1">
              We append &ldquo;Reply STOP to opt out&rdquo; and only send within
              8am–9pm local time.
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-brand-yellow text-brand-black border border-brand-yellow hover:bg-brand-yellow/90"
              onClick={() => {
                toast.dismiss(t.id);
                send();
              }}
            >
              <PaperAirplaneIcon className="w-3 h-3" />
              Send
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
              onClick={() => toast.dismiss(t.id)}
            >
              <XMarkIcon className="w-3 h-3" />
              Cancel
            </button>
          </div>
        </div>
      ),
      { duration: Infinity },
    );
  }

  // Consent on file → show the send button + a small consent badge.
  if (consentBasis) {
    return (
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border bg-emerald-50 text-emerald-700 border-emerald-200"
          title={`Consent: ${smsConsentLabel(consentBasis)}`}
        >
          <ShieldCheckIcon className="w-3.5 h-3.5" />
          Consent
        </span>
        <button
          type="button"
          onClick={confirmSend}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-brand-yellow text-brand-black border border-brand-yellow hover:bg-brand-yellow/90 hover:shadow-[0_0_18px_rgba(255,195,18,0.35)] transition-shadow disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <PaperAirplaneIcon className="w-3.5 h-3.5" />
          {isPending ? "Sending..." : "Send SMS"}
        </button>
      </div>
    );
  }

  // No consent yet → record it before texting.
  if (!recording) {
    return (
      <button
        type="button"
        onClick={() => setRecording(true)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-amber-800 border border-amber-300 bg-amber-50 hover:bg-amber-100"
      >
        <ShieldCheckIcon className="w-3.5 h-3.5" />
        Record consent to text
      </button>
    );
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
      <div className="text-sm font-medium text-gray-900">How did they consent to texts?</div>
      <p className="text-[11px] text-gray-500">
        Marketing texts require prior consent. Only record this if it&rsquo;s true —
        it&rsquo;s your lawful basis on file.
      </p>
      <select
        value={basis}
        onChange={(e) => setBasis(e.target.value as SmsConsentBasis)}
        disabled={isPending}
        className="block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
      >
        {SMS_CONSENT_BASES.map((b) => (
          <option key={b.value} value={b.value}>{b.label}</option>
        ))}
      </select>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={isPending}
        placeholder="Note (optional, e.g. date/context)"
        className="block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={saveConsent}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-brand-yellow text-brand-black border border-brand-yellow hover:bg-brand-yellow/90 disabled:opacity-60"
        >
          <CheckIcon className="w-3.5 h-3.5" />
          {isPending ? "Saving..." : "Save consent"}
        </button>
        <button
          type="button"
          onClick={() => setRecording(false)}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-60"
        >
          <XMarkIcon className="w-3.5 h-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
}
