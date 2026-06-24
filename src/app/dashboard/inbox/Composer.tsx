"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { PaperAirplaneIcon, EnvelopeIcon, ChatBubbleOvalLeftIcon } from "@heroicons/react/24/outline";
import AttachmentPicker, { type InboxAttachment } from "./AttachmentPicker";

type Channel = "email" | "sms";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Composer: send a free-form email or text from the dashboard. Used both for
 * starting a brand-new conversation (the inbox "New message" panel) and as a
 * standalone send tool. On success, onSent fires with the conversation id so
 * the inbox can jump straight to the new thread.
 */
export default function Composer({
  onSent,
  initialChannel,
  initialTo,
}: {
  onSent?: (conversationId: string, channel: Channel) => void;
  /** Pre-select the channel/recipient (e.g. opened from a lead's email/phone). */
  initialChannel?: Channel;
  initialTo?: string;
}) {
  const [channel, setChannel] = useState<Channel>(initialChannel ?? "email");
  const [to, setTo] = useState(initialTo ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<InboxAttachment[]>([]);
  const [sending, setSending] = useState(false);

  const isEmail = channel === "email";

  function validate(): string | null {
    if (isEmail && !EMAIL_RE.test(to.trim())) return "Enter a valid email address";
    if (!isEmail && to.replace(/\D/g, "").length < 10) return "Enter a valid US phone number";
    // An email carrying attachments may have an empty body (just a screenshot).
    if (!body.trim() && !(isEmail && attachments.length > 0)) return "Message body is required";
    return null;
  }

  async function send() {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          to: to.trim(),
          subject: isEmail ? subject.trim() : undefined,
          body: body.trim(),
          attachments: isEmail ? attachments : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Send failed");
        return;
      }
      if (data.optInRequested) {
        // Recipient hasn't opted into texts — we sent a "reply YES" request
        // instead of the message. Tell the operator to re-send after the YES.
        toast.success(
          data.alreadyRequested
            ? `Already asked ${data.to} to opt in — waiting on their YES.`
            : `${data.to} hasn't opted into texts yet, so we sent a quick opt-in request. They'll get your message once they reply YES.`,
          { duration: 8000 },
        );
        setBody("");
        if (data.conversationId) onSent?.(data.conversationId, channel);
        return;
      }
      toast.success(isEmail ? "Email sent" : "Text sent");
      // Keep the recipient (likely sending a follow-up); clear the message.
      setSubject("");
      setBody("");
      setAttachments([]);
      if (data.conversationId) onSent?.(data.conversationId, channel);
    } catch {
      toast.error("Network error — message not sent");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      {/* Channel toggle */}
      <div className="flex border-b">
        {(["email", "sms"] as Channel[]).map((c) => {
          const active = channel === c;
          const Icon = c === "email" ? EnvelopeIcon : ChatBubbleOvalLeftIcon;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setChannel(c)}
              className={
                "flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors " +
                (active
                  ? "text-brand-black border-b-2 border-brand-yellow bg-brand-yellow/10"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50")
              }
            >
              <Icon className="w-4 h-4" />
              {c === "email" ? "Email" : "Text"}
            </button>
          );
        })}
      </div>

      <div className="p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {isEmail ? "To (email)" : "To (phone)"}
          </label>
          <input
            type={isEmail ? "email" : "tel"}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder={isEmail ? "name@business.com" : "(405) 555-1234"}
            disabled={sending}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
          />
        </div>

        {isEmail && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              disabled={sending}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={isEmail ? 8 : 4}
            placeholder={isEmail ? "Write your email…" : "Write your text… (1 SMS ≈ 160 chars)"}
            disabled={sending}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none resize-y"
          />
          {!isEmail && (
            <div className="mt-1 text-right text-xs text-gray-400">{body.length} chars</div>
          )}
        </div>

        {isEmail && (
          <AttachmentPicker
            attachments={attachments}
            setAttachments={setAttachments}
            disabled={sending}
          />
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={send}
            disabled={sending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-brand-yellow text-brand-black border border-brand-yellow hover:bg-brand-yellow/90 hover:shadow-[0_0_18px_rgba(255,195,18,0.35)] transition-shadow disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
            {sending ? "Sending…" : isEmail ? "Send Email" : "Send Text"}
          </button>
        </div>
      </div>
    </div>
  );
}
