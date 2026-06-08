"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { PencilSquareIcon, CheckIcon, XMarkIcon, PlusIcon } from "@heroicons/react/24/outline";
import { setLeadEmail } from "../actions";

interface Props {
  businessId: number;
  email: string | null;
}

/**
 * Inline email display + editor for the lead's Business card. Lets the operator
 * paste a contact email that couldn't be scraped (Facebook-only pages, etc.).
 * Shows the address as a mailto link with an edit pencil, or an "Add email"
 * button when none is on file.
 */
export default function EditEmailField({ businessId, email }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(email ?? "");
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const r = await setLeadEmail(businessId, value);
      if (r.ok) {
        toast.success("Email saved");
        setEditing(false);
        router.refresh();
      } else {
        toast.error(r.message);
      }
    });
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="email"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isPending}
          placeholder="name@business.com"
          className="px-2 py-1 rounded border border-gray-300 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-50"
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
        />
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          aria-label="Save email"
          className="text-green-700 hover:text-green-800 disabled:opacity-50"
        >
          <CheckIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => { setEditing(false); setValue(email ?? ""); }}
          disabled={isPending}
          aria-label="Cancel"
          className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (!email) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
      >
        <PlusIcon className="w-3.5 h-3.5" />
        Add email
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <a className="text-blue-700 hover:underline" href={`mailto:${email}`}>{email}</a>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Edit email"
        className="text-gray-400 hover:text-gray-600"
      >
        <PencilSquareIcon className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}
