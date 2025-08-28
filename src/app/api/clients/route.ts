import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: memberships, error: mErr } = await supabase
    .from("org_members").select("org_id").eq("user_id", user.id);
  if (mErr || !memberships?.length) return NextResponse.json({ error: "No org" }, { status: 403 });
  const orgId = memberships[0].org_id;

  const { data, error } = await supabase
    .from("clients_overview")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ clients: data || [] });
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();

  // Auth
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Org
  const { data: memberships, error: mErr } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", auth.user.id);
  if (mErr || !memberships?.length) {
    return NextResponse.json({ error: "No org" }, { status: 403 });
  }
  const orgId = memberships[0].org_id as string;

  // Body (all fields optional)
  type ClientRequestBody = {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    status?: string;
    tags?: string[] | string;
  };

  const raw: ClientRequestBody = await req.json().catch(() => ({} as ClientRequestBody));

  const name =
    typeof raw.name === "string" && raw.name.trim().length > 0
      ? raw.name.trim()
      : "New client"; // safe default if omitted

  const email = typeof raw.email === "string" ? raw.email.trim() : null;
  const phone = typeof raw.phone === "string" ? raw.phone.trim() : null;
  const company = typeof raw.company === "string" ? raw.company.trim() : null;

  const allowedStatuses = new Set(["Lead", "Prospect", "Active", "Past"]);
  const status =
    typeof raw.status === "string" && allowedStatuses.has(raw.status)
      ? raw.status
      : "Lead";

  // tags can be: "a, b, c" or ["a","b","c"] or undefined
  let tags: string[] | null = null;
  if (Array.isArray(raw.tags)) {
    tags = (raw.tags as string[]).map((t: string) => String(t).trim()).filter(Boolean);
    if (tags.length === 0) tags = null;
  } else if (typeof raw.tags === "string") {
    tags = raw.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length === 0) tags = null;
  }

  // Insert (whitelist fields)
  const insert = {
    org_id: orgId,
    name,
    email,
    phone,
    company,
    status,
    tags, // text[] or null
  };

  const { data, error } = await supabase
    .from("clients")
    .insert(insert)
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Return just the id (your new-client page expects this)
  return NextResponse.json({ id: data.id });
}

