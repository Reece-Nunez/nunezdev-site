"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { PaperClipIcon, XMarkIcon } from "@heroicons/react/24/outline";

export interface InboxAttachment {
  key: string;
  filename: string;
  contentType: string;
  size: number;
}

// Mirrors the server allowlist in /api/inbox/upload.
const ACCEPT = "image/png,image/jpeg,image/gif,image/webp,application/pdf";
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * File picker for message attachments. Uploads each file straight to S3 via a
 * presigned PUT (browser → S3, bypassing the Vercel body limit) and hands the
 * resulting refs up to the parent. Used for email attachments and for SMS/MMS
 * image sends — callers pass `accept` to narrow the picker (images only for SMS).
 */
export default function AttachmentPicker({
  attachments,
  setAttachments,
  disabled,
  accept = ACCEPT,
}: {
  attachments: InboxAttachment[];
  setAttachments: (a: InboxAttachment[]) => void;
  disabled?: boolean;
  /** Override the accepted MIME list (defaults to email's image+pdf allowlist). */
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: InboxAttachment[] = [];
      for (const file of Array.from(files)) {
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name} is too large (max 20MB)`);
          continue;
        }
        const presignRes = await fetch("/api/inbox/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType: file.type }),
        });
        const presign = await presignRes.json().catch(() => ({}));
        if (!presignRes.ok) {
          toast.error(presign.error || `Couldn't prepare ${file.name}`);
          continue;
        }
        const put = await fetch(presign.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!put.ok) {
          toast.error(`Upload failed for ${file.name}`);
          continue;
        }
        uploaded.push({
          key: presign.key,
          filename: file.name,
          contentType: file.type,
          size: file.size,
        });
      }
      if (uploaded.length) setAttachments([...attachments, ...uploaded]);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(key: string) {
    setAttachments(attachments.filter((a) => a.key !== key));
  }

  return (
    <div>
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <span
              key={a.key}
              className="inline-flex items-center gap-1 rounded-md border bg-gray-50 px-2 py-1 text-xs text-gray-700"
            >
              <PaperClipIcon className="h-3 w-3 text-gray-400" />
              <span className="max-w-[140px] truncate">{a.filename}</span>
              <button
                type="button"
                onClick={() => remove(a.key)}
                disabled={disabled}
                className="text-gray-400 hover:text-gray-700"
                aria-label={`Remove ${a.filename}`}
              >
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-60"
      >
        <PaperClipIcon className="h-4 w-4" />
        {uploading ? "Uploading…" : "Attach"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
