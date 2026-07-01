"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { CheckIcon } from "@heroicons/react/24/outline";
import type { OperatorProfile } from "@/lib/leadgen-api";
import { saveOperatorProfile } from "../actions";

interface Props {
  initialProfile: OperatorProfile;
}

export default function SettingsForm({ initialProfile }: Props) {
  const [profile, setProfile] = useState<OperatorProfile>(initialProfile);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof OperatorProfile>(key: K, value: OperatorProfile[K]) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveOperatorProfile(profile);
      if (result.ok) {
        toast.success("Profile saved");
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border bg-white p-4 sm:p-6 max-w-2xl"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Your name" hint="Used as the sign-off on emails + proposals">
          <input
            type="text"
            value={profile.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Reece Nunez"
            className={inputClasses}
          />
        </Field>
        <Field label="Company / shop" hint="Optional. Appears in proposal headers">
          <input
            type="text"
            value={profile.company}
            onChange={(e) => update("company", e.target.value)}
            placeholder="NunezDev"
            className={inputClasses}
          />
        </Field>
        <Field label="Email" hint="The address prospects can reply to">
          <input
            type="email"
            value={profile.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="reece@nunezdev.com"
            className={inputClasses}
          />
        </Field>
        <Field label="Your cell phone" hint="We ring this for click-to-call. Kept private — prospects see your Twilio number in outreach, not this.">
          <input
            type="tel"
            value={profile.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="(555) 123-4567"
            className={inputClasses}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field
            label="Calendar booking URL"
            hint="Optional. Prompted in emails as the call-booking link"
          >
            <input
              type="url"
              value={profile.calendar_url}
              onChange={(e) => update("calendar_url", e.target.value)}
              placeholder="https://cal.com/reece/15min"
              className={inputClasses}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field
            label="Sign-off notes"
            hint="Free-form text injected near proposal sign-offs. Optional voice/identity hints (e.g. 'based in Ponca City', 'specialized in service trades')"
          >
            <textarea
              rows={3}
              value={profile.signoff_notes}
              onChange={(e) => update("signoff_notes", e.target.value)}
              placeholder="e.g. based in Ponca City, OK. I work primarily with service trades and local shops."
              className={`${inputClasses} resize-none`}
            />
          </Field>
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <div className="text-xs text-gray-500">
          {profile.updated_at
            ? `Last saved ${new Date(profile.updated_at).toLocaleString()}`
            : "Not yet saved."}
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white border border-gray-900 hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <CheckIcon className="w-4 h-4" />
          {isPending ? "Saving..." : "Save profile"}
        </button>
      </div>
    </form>
  );
}

const inputClasses =
  "block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus-visible:ring-1 focus-visible:ring-gray-900 outline-none";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}
