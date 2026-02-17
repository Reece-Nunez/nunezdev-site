import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/authz";
export const dynamic = "force-dynamic";

export async function GET() {
  const res = await requireOwner();
  return NextResponse.json(res);
}
