"use client";

import { useState } from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import {
  EnvelopeIcon,
  ChatBubbleOvalLeftIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  ArrowLeftIcon,
  XMarkIcon,
  PaperClipIcon,
} from "@heroicons/react/24/outline";
import Composer from "./Composer";
import AttachmentPicker, { type InboxAttachment } from "./AttachmentPicker";

type Channel = "email" | "sms";

interface MessageAttachment {
  key: string;
  filename: string;
  contentType: string;
  size: number;
  url: string | null;
}

interface ConversationListItem {
  id: string;
  channel: Channel;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  subject: string | null;
  status: string;
  unread: boolean;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_direction: "inbound" | "outbound" | null;
}

interface Message {
  id: string;
  direction: "inbound" | "outbound";
  channel: Channel;
  from_address: string;
  to_address: string;
  subject: string | null;
  body_text: string | null;
  status: string;
  error: string | null;
  attachments?: MessageAttachment[];
  created_at: string;
}

interface ConversationDetail {
  conversation: ConversationListItem;
  messages: Message[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** Display label for a contact — name, then email, then phone. */
function contactLabel(c: ConversationListItem): string {
  return c.contact_name || c.contact_email || c.contact_phone || "Unknown";
}

/** Compact relative time. Avoids a date lib for one small helper. */
function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function InboxClient() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const { data: listData, mutate: mutateList } = useSWR<{ conversations: ConversationListItem[] }>(
    "/api/inbox/conversations",
    fetcher,
    { refreshInterval: 10000 },
  );
  const conversations = listData?.conversations ?? [];

  const { data: detail, mutate: mutateDetail } = useSWR<ConversationDetail>(
    selectedId ? `/api/inbox/conversations/${selectedId}` : null,
    fetcher,
    { refreshInterval: 8000 },
  );

  function openConversation(id: string) {
    setSelectedId(id);
    // The GET marks it read server-side; refresh the list so the unread dot
    // clears without waiting for the 10s poll.
    setTimeout(() => mutateList(), 400);
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] lg:h-[calc(100vh-3rem)] overflow-hidden rounded-xl border bg-white shadow-sm">
      {/* ── List pane ───────────────────────────────────────────────── */}
      <div
        className={`${selectedId ? "hidden lg:flex" : "flex"} w-full shrink-0 flex-col border-r lg:w-80`}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h1 className="text-base font-semibold text-gray-900">Inbox</h1>
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-yellow px-2.5 py-1.5 text-xs font-medium text-brand-black border border-brand-yellow hover:bg-brand-yellow/90 transition-colors"
          >
            <PencilSquareIcon className="h-4 w-4" />
            New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">
              No conversations yet. Hit “New” to send the first one.
            </p>
          ) : (
            conversations.map((c) => {
              const Icon = c.channel === "email" ? EnvelopeIcon : ChatBubbleOvalLeftIcon;
              const active = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openConversation(c.id)}
                  className={`flex w-full items-start gap-2.5 border-b px-4 py-3 text-left transition-colors ${
                    active ? "bg-brand-yellow/10" : "hover:bg-gray-50"
                  }`}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-sm ${c.unread ? "font-semibold text-gray-900" : "text-gray-700"}`}
                      >
                        {contactLabel(c)}
                      </span>
                      <span className="shrink-0 text-[11px] text-gray-400">
                        {relativeTime(c.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {c.last_direction === "outbound" && (
                        <span className="shrink-0 text-[11px] text-gray-400">You:</span>
                      )}
                      <span
                        className={`truncate text-xs ${c.unread ? "text-gray-700" : "text-gray-400"}`}
                      >
                        {c.last_message_preview || "—"}
                      </span>
                    </div>
                  </div>
                  {c.unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-yellow" />}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Thread pane ─────────────────────────────────────────────── */}
      <div className={`${selectedId ? "flex" : "hidden lg:flex"} min-w-0 flex-1 flex-col`}>
        {!selectedId ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-gray-400">
            Select a conversation to read and reply.
          </div>
        ) : detail ? (
          <Thread
            detail={detail}
            onBack={() => setSelectedId(null)}
            onSent={() => {
              mutateDetail();
              mutateList();
            }}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-400">Loading…</div>
        )}
      </div>

      {/* ── New-message modal ───────────────────────────────────────── */}
      {composing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-20">
          <div className="w-full max-w-lg">
            <div className="mb-2 flex items-center justify-between text-white">
              <span className="text-sm font-medium">New message</span>
              <button
                type="button"
                onClick={() => setComposing(false)}
                className="rounded-lg p-1 hover:bg-white/10"
                aria-label="Close"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <Composer
              onSent={(conversationId) => {
                setComposing(false);
                mutateList();
                openConversation(conversationId);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Conversation thread + reply box. */
function Thread({
  detail,
  onBack,
  onSent,
}: {
  detail: ConversationDetail;
  onBack: () => void;
  onSent: () => void;
}) {
  const { conversation: c, messages } = detail;
  const [reply, setReply] = useState("");
  const [attachments, setAttachments] = useState<InboxAttachment[]>([]);
  const [sending, setSending] = useState(false);

  const isEmail = c.channel === "email";
  const recipient = isEmail ? c.contact_email : c.contact_phone;

  async function sendReply() {
    const text = reply.trim();
    // Email may go out with only attachments; SMS needs text.
    if (!text && !(isEmail && attachments.length > 0)) return;
    if (!recipient) {
      toast.error("No recipient address on this conversation");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: c.channel,
          to: recipient,
          subject: isEmail ? c.subject ?? undefined : undefined,
          body: text,
          conversationId: c.id,
          attachments: isEmail ? attachments : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Send failed");
        return;
      }
      setReply("");
      setAttachments([]);
      onSent();
    } catch {
      toast.error("Network error — reply not sent");
    } finally {
      setSending(false);
    }
  }

  const ChannelIcon = c.channel === "email" ? EnvelopeIcon : ChatBubbleOvalLeftIcon;

  return (
    <>
      {/* Thread header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 lg:hidden"
          aria-label="Back"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <ChannelIcon className="h-4 w-4 text-gray-400" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-gray-900">{contactLabel(c)}</div>
          <div className="truncate text-xs text-gray-400">{recipient}</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-gray-50 px-4 py-4">
        {messages.map((m) => {
          const outbound = m.direction === "outbound";
          return (
            <div key={m.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[80%]">
                {c.channel === "email" && m.subject && (
                  <div className={`mb-0.5 text-[11px] text-gray-400 ${outbound ? "text-right" : ""}`}>
                    {m.subject}
                  </div>
                )}
                {(m.body_text || !m.attachments?.length) && (
                  <div
                    className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                      outbound
                        ? "rounded-br-sm bg-brand-yellow text-brand-black"
                        : "rounded-bl-sm border bg-white text-gray-800"
                    }`}
                  >
                    {m.body_text || <span className="italic text-gray-400">(no text)</span>}
                  </div>
                )}
                {!!m.attachments?.length && (
                  <div className={`mt-1 flex flex-wrap gap-2 ${outbound ? "justify-end" : ""}`}>
                    {m.attachments.map((a) =>
                      a.contentType.startsWith("image/") && a.url ? (
                        <a key={a.key} href={a.url} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={a.url}
                            alt={a.filename}
                            className="max-h-48 max-w-[12rem] rounded-lg border object-cover"
                          />
                        </a>
                      ) : (
                        <a
                          key={a.key}
                          href={a.url ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          <PaperClipIcon className="h-3 w-3 text-gray-400" />
                          <span className="max-w-[160px] truncate">{a.filename}</span>
                        </a>
                      ),
                    )}
                  </div>
                )}
                <div className={`mt-0.5 flex items-center gap-1 text-[11px] text-gray-400 ${outbound ? "justify-end" : ""}`}>
                  <span>{relativeTime(m.created_at)}</span>
                  {m.status === "failed" && <span className="text-red-500">· failed</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reply box */}
      <div className="border-t p-3">
        {isEmail && (
          <div className="mb-2">
            <AttachmentPicker
              attachments={attachments}
              setAttachments={setAttachments}
              disabled={sending}
            />
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter newline (chat convention).
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!sending) sendReply();
              }
            }}
            rows={2}
            placeholder={isEmail ? "Write a reply…" : "Write a text…"}
            disabled={sending}
            className="flex-1 resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={sendReply}
            disabled={sending || (!reply.trim() && attachments.length === 0)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-yellow px-3 py-2 text-sm font-medium text-brand-black border border-brand-yellow hover:bg-brand-yellow/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="h-4 w-4" />
            {sending ? "…" : "Send"}
          </button>
        </div>
      </div>
    </>
  );
}
