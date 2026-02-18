import { requireOwner } from "@/lib/authz";
import BusinessProfileClient from "./BusinessProfileClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
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
    <div className="px-3 py-4 sm:p-6 max-w-3xl">
      <BusinessProfileClient />
    </div>
  );
}
