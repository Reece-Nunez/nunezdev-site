"use client";

import { useTransition } from "react";
import toast from "react-hot-toast";
import { PaperAirplaneIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { sendEmailOutreach } from "../actions";

interface Props {
  businessId: number;
  recipientEmail: string | null;
}

/**
 * Per-channel send button on the email OutreachBlock. Click → confirm
 * toast with [Send] [Cancel]. Click Send → server action triggers the
 * pipeline's Resend send, which mark the draft 'sent' and the business
 * 'contacted'. Toast feedback on outcome; the dashboard's revalidate
 * makes the status flip on next render.
 *
 * Disabled when the business has no email on file — clicking is
 * pointless without a recipient.
 */
export default function SendEmailButton({ businessId, recipientEmail }: Props) {
  const [isPending, startTransition] = useTransition();
  const disabled = isPending || !recipientEmail;

  function doSend() {
    startTransition(async () => {
      const result = await sendEmailOutreach(businessId);
      if (result.ok) {
        toast.success("Email sent");
      } else {
        toast.error(result.message);
      }
    });
  }

  function confirm() {
    if (disabled || !recipientEmail) return;
    toast(
      (t) => (
        <div className="flex items-start gap-3 text-sm">
          <div className="flex-1">
            <div className="font-medium text-gray-900">Send this email?</div>
            <div className="text-xs text-gray-600 mt-0.5 break-all">
              To: {recipientEmail}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-gray-900 text-white border border-gray-900 hover:bg-gray-800"
              onClick={() => {
                toast.dismiss(t.id);
                doSend();
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

  if (!recipientEmail) {
    return (
      <span className="text-xs text-gray-500 italic">
        No email on file
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={confirm}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-gray-900 text-white border border-gray-900 hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <PaperAirplaneIcon className="w-3.5 h-3.5" />
      {isPending ? "Sending..." : "Send draft"}
    </button>
  );
}
