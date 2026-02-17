import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/authz";
import { getAnalytics } from "@/lib/analytics";

export async function GET() {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;

  try {
    const analytics = await getAnalytics(orgId);
    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
