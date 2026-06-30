"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { PencilSquareIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { saveOutreachDraft } from "../actions";

interface Props {
  businessId: number;
  channel: "email" | "sms" | "phone";
  subject: string | null;
  message: string | null;
  screenshotUrl: string | null;
  /** False once the draft has been sent — editing is disabled server-side too. */
  editable: boolean;
}

/**
 * The body of an outreach draft card: subject (email only), the inline
 * screenshot preview, and the message — with inline editing. The operator
 * can tweak the AI-generated copy before sending. Saves persist to the
 * outreach row via a server action; the API refuses edits to a sent draft.
 */
export default function OutreachDraftBody({
  businessId,
  channel,
  subject,
  message,
  screenshotUrl,
  editable,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  // Local copies so the view reflects a save immediately.
  const [subj, setSubj] = useState(subject ?? "");
  const [msg, setMsg] = useState(message ?? "");
  // Snapshot to restore on cancel.
  const [snapshot, setSnapshot] = useState({ subj: subject ?? "", msg: message ?? "" });

  const isEmail = channel === "email";

  function startEdit() {
    setSnapshot({ subj, msg });
    setEditing(true);
  }

  function cancel() {
    setSubj(snapshot.subj);
    setMsg(snapshot.msg);
    setEditing(false);
  }

  function save() {
    if (!msg.trim()) {
      toast.error("Message can't be empty");
      return;
    }
    startTransition(async () => {
      const result = await saveOutreachDraft(
        businessId,
        channel,
        msg,
        isEmail ? subj : undefined,
      );
      if (result.ok) {
        toast.success("Draft saved");
        setEditing(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* Edit / Save / Cancel controls */}
      <div className="flex justify-end">
        {!editing ? (
          editable && (
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800"
            >
              <PencilSquareIcon className="w-3.5 h-3.5" />
              Edit draft
            </button>
          )
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-brand-yellow text-brand-black border border-brand-yellow hover:bg-brand-yellow/90 hover:shadow-[0_0_18px_rgba(255,195,18,0.35)] transition-shadow disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <CheckIcon className="w-3.5 h-3.5" />
              {isPending ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={isPending}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-60"
            >
              <XMarkIcon className="w-3.5 h-3.5" />
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Subject (email only) */}
      {isEmail && (
        <div className="text-sm">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
            Subject
          </div>
          {editing ? (
            <input
              type="text"
              value={subj}
              onChange={(e) => setSubj(e.target.value)}
              disabled={isPending}
              placeholder="Email subject line"
              className="block w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
            />
          ) : (
            <div className="text-gray-900 font-medium">{subj || <span className="text-gray-400">No subject</span>}</div>
          )}
        </div>
      )}

      {/* Mockup screenshot preview. Email inlines it in the body; SMS attaches
          it as MMS media on text 1. Shown so the operator can confirm the
          mockup before sending. */}
      {screenshotUrl && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            {isEmail ? "Inline preview" : "Attached to text 1 (MMS) + link"}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={screenshotUrl}
            alt={isEmail ? "Mockup screenshot the prospect will see inline" : "Mockup screenshot attached to the text"}
            className="w-full max-w-[620px] rounded-lg border border-gray-200 shadow-sm"
          />
        </div>
      )}

      {/* Message */}
      {editing ? (
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          disabled={isPending}
          rows={Math.min(18, Math.max(6, msg.split("\n").length + 1))}
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 leading-relaxed font-sans focus:border-gray-400 focus:outline-none"
        />
      ) : (
        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed bg-gray-50/60 rounded-md p-3 border border-gray-100">
          {msg}
        </pre>
      )}
    </div>
  );
}
