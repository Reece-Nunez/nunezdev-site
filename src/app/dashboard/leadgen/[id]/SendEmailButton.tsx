"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { PaperAirplaneIcon, XMarkIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { sendEmailOutreach } from "../actions";

interface Props {
  businessId: number;
  recipientEmail: string | null;
}

// Loose sanity check, mirrors the API's _EMAIL_RE — block obvious garbage
// without rejecting valid-but-unusual addresses.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Per-channel send button on the email OutreachBlock.
 *
 * Two modes:
 *  - Email on file → "Send draft" (confirm toast → send), plus a "different
 *    email" link to correct it.
 *  - No email on file → an inline input + "Save & send". The operator often
 *    finds an address by hand (e.g. off the business's Facebook page) after
 *    prospecting came up empty. The typed address is persisted on the
 *    business (server action), so it's on file for this send and future ones.
 */
export default function SendEmailButton({ businessId, recipientEmail }: Props) {
  const [isPending, startTransition] = useTransition();
  // Show the input when there's nothing on file, or when the operator opts
  // to change an existing address.
  const [entering, setEntering] = useState(false);
  const [email, setEmail] = useState(recipientEmail ?? "");

  const showInput = entering || !recipientEmail;

  function doSend(toEmail: string, override: boolean) {
    startTransition(async () => {
      const result = await sendEmailOutreach(businessId, override ? toEmail : undefined);
      if (result.ok) {
        toast.success("Email sent");
        setEntering(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  function confirm(toEmail: string, override: boolean) {
    const clean = toEmail.trim();
    if (!EMAIL_RE.test(clean)) {
      toast.error("Enter a valid email address");
      return;
    }
    toast(
      (t) => (
        <div className="flex items-start gap-3 text-sm">
          <div className="flex-1">
            <div className="font-medium text-gray-900">Send this email?</div>
            <div className="text-xs text-gray-600 mt-0.5 break-all">To: {clean}</div>
          </div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-brand-yellow text-brand-black border border-brand-yellow hover:bg-brand-yellow/90 hover:shadow-[0_0_18px_rgba(255,195,18,0.35)] transition-shadow"
              onClick={() => {
                toast.dismiss(t.id);
                doSend(clean, override);
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

  if (showInput) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && email.trim()) confirm(email, true);
          }}
          placeholder="name@business.com"
          disabled={isPending}
          className="w-52 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => confirm(email, true)}
          disabled={isPending || !email.trim()}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-brand-yellow text-brand-black border border-brand-yellow hover:bg-brand-yellow/90 hover:shadow-[0_0_18px_rgba(255,195,18,0.35)] transition-shadow disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <PaperAirplaneIcon className="w-3.5 h-3.5" />
          {isPending ? "Sending..." : "Save & send"}
        </button>
        {recipientEmail && (
          <button
            type="button"
            onClick={() => {
              setEntering(false);
              setEmail(recipientEmail);
            }}
            disabled={isPending}
            className="inline-flex items-center px-1.5 py-1 rounded text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => confirm(recipientEmail as string, false)}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-brand-yellow text-brand-black border border-brand-yellow hover:bg-brand-yellow/90 hover:shadow-[0_0_18px_rgba(255,195,18,0.35)] transition-shadow disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <PaperAirplaneIcon className="w-3.5 h-3.5" />
        {isPending ? "Sending..." : "Send draft"}
      </button>
      <button
        type="button"
        onClick={() => setEntering(true)}
        disabled={isPending}
        className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
      >
        <PencilSquareIcon className="w-3 h-3" />
        different email
      </button>
    </div>
  );
}
