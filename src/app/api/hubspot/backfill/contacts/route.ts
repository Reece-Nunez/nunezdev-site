import { NextResponse } from "next/server";
import { hsGet, HSListResp } from "@/lib/hubspot";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? 500);
    const dry = url.searchParams.get("dry") === "1";

    const supabase = await supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: m } = await supabase
      .from("org_members").select("org_id").eq("user_id", user.id);
    const orgId = m?.[0]?.org_id;
    if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

    type HSContact = {
      id: string;
      properties?: { email?: string; firstname?: string; lastname?: string; phone?: string; company?: string; };
    };

    const pick = (c: HSContact) => {
      const p = c.properties ?? {};
      const name = [p.firstname, p.lastname].filter(Boolean).join(" ")
        || p.company || p.email || "—";
      return { org_id: orgId, name, email: p.email ?? null, phone: p.phone ?? null, company: p.company ?? null };
    };

    let after: string | undefined;
    let scanned = 0, upserts = 0;

    while (scanned < limit) {
      const batch = await hsGet<HSListResp<HSContact>>("/crm/v3/objects/contacts", {
        properties: "email,firstname,lastname,phone,company",
        limit: "100",
        after,
      });
      if (!batch.results.length) break;

      const rows = batch.results.map(pick);
      scanned += rows.length;

      if (!dry) {
        // Instead of upsert which overwrites, handle each contact individually
        for (const row of rows) {
          if (!row.email) continue; // Skip contacts without email
          
          // Check if client already exists
          const { data: existing } = await supabase
            .from("clients")
            .select("id, name, phone, company")
            .eq("org_id", orgId)
            .eq("email", row.email)
            .maybeSingle();

          if (existing) {
            // Update only empty/null fields to preserve manual data
            const updates: any = {};
            
            if (!existing.name || existing.name.trim() === '' || existing.name === '—') {
              updates.name = row.name;
            }
            if (!existing.phone && row.phone) {
              updates.phone = row.phone;
            }
            if (!existing.company && row.company) {
              updates.company = row.company;
            }
            
            // Only update if we have fields to update
            if (Object.keys(updates).length > 0) {
              const { error } = await supabase
                .from("clients")
                .update(updates)
                .eq("id", existing.id);
              
              if (!error) upserts++;
            }
          } else {
            // Create new client
            const { error } = await supabase
              .from("clients")
              .insert(row);
            
            if (!error) upserts++;
          }
        }
      }

      after = batch.paging?.next?.after;
      if (!after) break;
    }

    return NextResponse.json({ scanned, upserts, dry });  // <-- always JSON
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
