import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/authz";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  encrypt,
  decrypt,
  maskSSN,
  maskEIN,
  maskRouting,
  maskAccount,
  maskEnd,
} from "@/lib/encryption";

const PLAIN_FIELDS = [
  "business_name",
  "address_street",
  "address_city",
  "address_state",
  "address_zip",
  "phone",
  "email",
  "website",
  "business_type",
  "formation_date",
  "bank_name",
] as const;

type SensitiveField = {
  column: string;
  key: string;
  mask: (v: string) => string;
};

const SENSITIVE_FIELDS: SensitiveField[] = [
  { column: "ein_encrypted", key: "ein", mask: maskEIN },
  { column: "ssn_encrypted", key: "ssn", mask: maskSSN },
  { column: "bank_routing_encrypted", key: "bank_routing", mask: maskRouting },
  { column: "bank_account_encrypted", key: "bank_account", mask: maskAccount },
  { column: "state_tax_id_encrypted", key: "state_tax_id", mask: (v) => maskEnd(v, 4) },
  { column: "business_license_encrypted", key: "business_license", mask: (v) => maskEnd(v, 4) },
];

// GET /api/settings
// By default returns sensitive fields masked. Pass ?reveal=ein,ssn to decrypt specific fields.
export async function GET(req: Request) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;

  const { searchParams } = new URL(req.url);
  const revealKeys = new Set(
    (searchParams.get("reveal") ?? "").split(",").filter(Boolean)
  );

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const result: Record<string, unknown> = { id: data.id };

  for (const field of PLAIN_FIELDS) {
    result[field] = (data as Record<string, unknown>)[field] ?? null;
  }

  for (const { column, key, mask } of SENSITIVE_FIELDS) {
    const ciphertext = (data as Record<string, unknown>)[column] as string | null;
    if (!ciphertext) {
      result[key] = null;
      result[`${key}_set`] = false;
      continue;
    }

    result[`${key}_set`] = true;

    if (revealKeys.has(key)) {
      result[key] = decrypt(ciphertext);
    } else {
      const plaintext = decrypt(ciphertext);
      result[key] = plaintext ? mask(plaintext) : null;
    }
  }

  return NextResponse.json(result);
}

// PATCH /api/settings
export async function PATCH(req: Request) {
  const guard = await requireOwner();
  if (!guard.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const orgId = guard.orgId!;

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  for (const field of PLAIN_FIELDS) {
    if (field in body) {
      updates[field] = body[field] === "" ? null : body[field];
    }
  }

  for (const { column, key } of SENSITIVE_FIELDS) {
    if (key in body) {
      const value = body[key];
      if (value === null || value === "") {
        updates[column] = null;
      } else {
        updates[column] = encrypt(String(value));
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("organizations")
    .update(updates)
    .eq("id", orgId);

  if (error) {
    console.error("[PATCH /api/settings]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
