import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { requireOwner } from "@/lib/authz";
import { getOperatorProfile } from "@/lib/leadgen-api";
import SettingsForm from "./SettingsForm";

// force-dynamic so the form always reflects the latest persisted profile —
// settings edits go through a server action that revalidatePath()s, but the
// page itself shouldn't be served from a stale data cache between sessions.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LeadgenSettings() {
  const guard = await requireOwner();
  if (!guard.ok) {
    return (
      <div className="px-3 py-4 sm:p-6 max-w-full min-w-0">
        <div className="rounded-xl border bg-white p-4 text-sm text-red-600">
          You do not have owner access.
        </div>
      </div>
    );
  }

  const profile = await getOperatorProfile();

  return (
    <div className="px-3 py-4 sm:p-6 space-y-6 max-w-full min-w-0">
      <div className="space-y-2">
        <Link
          href="/dashboard/leadgen"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to prospecting
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operator profile</h1>
          <p className="text-sm text-gray-500 mt-1">
            How proposals and outreach sign themselves. Used by every build
            and outreach run from here forward — previously-generated
            content is not retroactively rewritten.
          </p>
        </div>
      </div>

      <SettingsForm initialProfile={profile} />
    </div>
  );
}
