import { requireOwner } from "@/lib/authz";
import InboxClient from "./InboxClient";

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
    <div className="px-3 py-4 sm:p-6">
      <InboxClient />
    </div>
  );
}
