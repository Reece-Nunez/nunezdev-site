import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/authz";
import { getLeadSourceROI } from "@/lib/leadAnalytics";

export async function GET() {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const stats = await getLeadSourceROI(guard.orgId!);
    return NextResponse.json({ stats });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load lead source ROI" },
      { status: 500 }
    );
  }
}
