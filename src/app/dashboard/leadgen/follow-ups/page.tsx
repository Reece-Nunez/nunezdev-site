import Link from "next/link";
import { ArrowLeftIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { requireProspecting } from "@/lib/authz";
import { isAvailable, listFollowUps } from "@/lib/leadgen-api";
import FollowUpActions from "./FollowUpActions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function FollowUpsQueue() {
  const guard = await requireProspecting();
  if (!guard.ok) {
    return (
      <div className="px-3 py-4 sm:p-6 max-w-full min-w-0">
        <div className="rounded-xl border bg-white p-4 text-sm text-red-600">
          You do not have owner access.
        </div>
      </div>
    );
  }

  const available = await isAvailable();
  const followUps = available ? await listFollowUps("due", 200) : [];

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
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PaperAirplaneIcon className="w-6 h-6 text-gray-600" />
            Follow-ups due
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Drafted automatically for contacted leads that haven&apos;t replied.
            Review each, then send, snooze, or skip. Sequences stop on their own
            once a lead replies.
          </p>
        </div>
      </div>

      {followUps.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500">
          Nothing due right now. New follow-ups appear here as contacted leads
          go quiet (day 3, 7, then 14).
        </div>
      ) : (
        <div className="space-y-4">
          {followUps.map((f) => (
            <div key={f.id} className="rounded-xl border bg-white p-4 sm:p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/leadgen/${f.business_id}`}
                    className="text-base font-semibold text-gray-900 hover:underline"
                  >
                    {f.business_name}
                  </Link>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Follow-up #{f.step_number}
                    {f.business_email ? ` · ${f.business_email}` : " · no email on file"}
                  </div>
                </div>
                <FollowUpActions followUpId={f.id} canSend={!!f.business_email} />
              </div>

              {f.subject && (
                <div className="text-sm">
                  <span className="text-gray-500">Subject: </span>
                  <span className="text-gray-900 font-medium">{f.subject}</span>
                </div>
              )}
              {f.message && (
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans bg-gray-50 border border-gray-200 rounded-lg p-3">
                  {f.message}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
