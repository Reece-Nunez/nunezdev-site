import { NextResponse } from "next/server";
import { hsGet, HSListResp } from "@/lib/hubspot";
import { supabaseServer } from "@/lib/supabaseServer";

type HSDeal = {
  id: string;
  properties?: {
    dealname?: string;
    dealstage?: string;
    amount?: string;
    closedate?: string;
    createdate?: string;
    pipeline?: string;
    deal_currency_code?: string;
    description?: string;
    hs_deal_stage_probability?: string;
    hubspot_owner_id?: string;
  };
  associations?: {
    contacts?: { results?: { id: string }[] };
    companies?: { results?: { id: string }[] };
  };
};

// Map HubSpot deal stages to our database-allowed stages
// Allowed stages: 'New','Discovery','Proposal','Negotiation','Won','Lost'
function mapDealStage(hsStage?: string): string {
  if (!hsStage) return 'New';
  const stage = hsStage.toLowerCase();
  
  // Handle closed deals first
  if (stage.includes('closedwon') || stage.includes('won')) return 'Won';
  if (stage.includes('closedlost') || stage.includes('lost')) return 'Lost';
  
  // Handle active pipeline stages
  if (stage.includes('appointmentscheduled') || stage.includes('appointment')) return 'Discovery';
  if (stage.includes('qualifiedtobuy') || stage.includes('qualified')) return 'Discovery';
  if (stage.includes('presentationscheduled') || stage.includes('presentation') || stage.includes('proposal')) return 'Proposal';
  if (stage.includes('decisionmakerboughtin') || stage.includes('negotiation') || stage.includes('contract')) return 'Negotiation';
  
  // Handle your specific HubSpot stage IDs
  // These represent active deals in your pipeline, so map to 'Negotiation' (closest to contract stage)
  if (stage === '1155610492' || stage === 'stage_2') return 'Negotiation';
  
  return 'New'; // Default for unknown stages
}

async function findPrimaryContactEmail(deal: HSDeal): Promise<string | null> {
  const contactId = deal.associations?.contacts?.results?.[0]?.id;
  if (contactId) {
    try {
      const contact = await hsGet<{ properties?: { email?: string } }>(
        `/crm/v3/objects/contacts/${contactId}`, 
        { properties: "email" }
      );
      return contact.properties?.email ?? null;
    } catch (error) {
      console.warn(`Failed to fetch contact ${contactId}:`, error);
      return null;
    }
  }
  return null;
}

/**
 * GET /api/hubspot/backfill/deals?limit=300&dry=0
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? 300);
    const dry = url.searchParams.get("dry") === "1";

    const supabase = await supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: m } = await supabase.from("org_members").select("org_id").eq("user_id", user.id);
    const orgId = m?.[0]?.org_id;
    if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

    let after: string | undefined;
    let scanned = 0, upserts = 0, createdClients = 0;

    while (scanned < limit) {
      const batch = await hsGet<HSListResp<HSDeal>>("/crm/v3/objects/deals", {
        properties: "dealname,dealstage,amount,closedate,createdate,pipeline,deal_currency_code,description,hs_deal_stage_probability",
        associations: "contacts,companies",
        limit: "100",
        after
      });

      if (!batch.results.length) break;
      
      for (const deal of batch.results) {
        scanned++;

        const props = deal.properties || {};
        const email = await findPrimaryContactEmail(deal);
        let clientId: string | null = null;

        // Try to find existing client by email
        if (email) {
          const { data: existing } = await supabase
            .from("clients")
            .select("id, name, phone, company")
            .eq("org_id", orgId)
            .eq("email", email)
            .maybeSingle();

          if (existing?.id) {
            clientId = existing.id;
            
            // Only update empty fields to preserve manual data
            if (!dry) {
              const updates: any = {};
              const dealName = props.dealname || email;
              
              if (!existing.name || existing.name.trim() === '' || existing.name === '—') {
                updates.name = dealName;
              }
              
              // Only update if we have fields to update
              if (Object.keys(updates).length > 0) {
                await supabase
                  .from("clients")
                  .update(updates)
                  .eq("id", existing.id);
              }
            }
          } else if (!dry) {
            // Create new client
            const name = props.dealname || email;
            const { data: created } = await supabase
              .from("clients")
              .insert({ 
                org_id: orgId, 
                name, 
                email,
                status: 'Prospect' // Default status for deals
              })
              .select("id")
              .single();
            
            if (created?.id) {
              clientId = created.id;
              createdClients++;
            }
          }
        }

        // Map deal data
        const title = props.dealname || `Deal ${deal.id}`;
        const stage = mapDealStage(props.dealstage);
        const valueCents = Math.round(Number(props.amount ?? 0) * 100);
        const probability = Math.round(Number(props.hs_deal_stage_probability ?? 0.3) * 100); // Convert 0.1 to 10
        const expectedCloseDate = props.closedate ? new Date(props.closedate).toISOString().split('T')[0] : null;

        if (!dry) {
          const { error } = await supabase.from("deals").upsert({
            org_id: orgId,
            client_id: clientId,
            hubspot_deal_id: deal.id,
            source: "hubspot",
            title,
            stage,
            value_cents: valueCents,
            probability,
            expected_close_date: expectedCloseDate,
            description: props.description ?? null,
            created_at: props.createdate ? new Date(props.createdate).toISOString() : undefined
          }, { onConflict: "hubspot_deal_id" });

          if (!error) upserts++;
        }
      }

      after = batch.paging?.next?.after;
      if (!after) break;
    }

    return NextResponse.json({ scanned, upserts, createdClients, dry });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}