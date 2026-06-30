"use client";

import { useTransition } from "react";
import toast from "react-hot-toast";
import {
  PaperAirplaneIcon,
  XMarkIcon,
  ShieldCheckIcon,
  NoSymbolIcon,
} from "@heroicons/react/24/outline";
import { sendSmsOutreach } from "../actions";
import { smsConsentLabel } from "../utils";
import type { SmsConsentBasis } from "@/lib/leadgen-api";

interface Props {
  businessId: number;
  phone: string | null;
  consentBasis: SmsConsentBasis | null;
  optedOut: boolean;
}

/**
 * SMS send affordance. State machine:
 *   opted out → blocked badge (they replied STOP)
 *   no phone  → muted "no number"
 *   otherwise → Send SMS (confirm)
 *
 * The affirmative-consent gate was removed (owner policy) — the operator can
 * text any prospect directly. The remaining guardrails (opt-out/STOP, quiet
 * hours, sender ID + STOP suffix) are still enforced server-side. A consent
 * badge is shown when a basis happens to be on file, as info only.
 */
export default function SmsSendButton({ businessId, phone, consentBasis, optedOut }: Props) {
  const [isPending, startTransition] = useTransition();

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

  // Consent gate removed → Send is always available. Show an info-only consent
  // badge when a basis happens to be on file.
  return (
    <div className="flex items-center gap-2">
      {consentBasis && (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border bg-emerald-50 text-emerald-700 border-emerald-200"
          title={`Consent: ${smsConsentLabel(consentBasis)}`}
        >
          <ShieldCheckIcon className="w-3.5 h-3.5" />
          Consent
        </span>
      )}
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
