import { requireOwner } from "@/lib/authz";
import Composer from "./Composer";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const guard = await requireOwner();
  if (!guard.ok) {
    return (
      <div className="px-3 py-4 sm:p-6">
        <div className="rounded-xl border bg-white p-4 text-sm text-red-600">
          You do not have owner access to view this page.
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-4 sm:p-6 max-w-2xl">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Inbox</h1>
        <p className="text-sm text-gray-500">
          Send an email or text from NunezDev. Conversation threads and replies
          are coming next.
        </p>
      </div>
      <Composer />
    </div>
  );
}
