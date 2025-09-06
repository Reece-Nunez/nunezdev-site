import { NextResponse } from "next/server";
import { hsGet, HSListResp } from "@/lib/hubspot";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HSInvoice = {
  id: string;
  properties?: {
    hs_number?: string;
    hs_amount_billed?: string;
    hs_invoice_status?: string;
    hs_invoice_date?: string;
    hs_due_date?: string;
    hs_payment_date?: string;
    hs_currency?: string;
    hs_comments?: string;
    hs_invoice_latest_contact_email?: string;
    hs_invoice_latest_contact_firstname?: string;
    hs_invoice_latest_contact_lastname?: string;
    hs_invoice_latest_company_name?: string;
    createdate?: string;
    lastmodifieddate?: string;
  };
  associations?: {
    contacts?: { results?: { id: string }[] };
    deals?: { results?: { id: string }[] };
    companies?: { results?: { id: string }[] };
  };
};

interface InvoicePreview {
  hubspot_id: string;
  invoice_number: string;
  amount_cents: number;
  amount_display: string;
  status: string;
  hubspot_status: string;
  client_name: string;
  client_email: string;
  date: string;
  exists_in_db: boolean;
  existing_id?: string;
  can_import: boolean;
  skip_reason?: string;
}

interface InvoiceSyncResult {
  scanned: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  dry: boolean;
  preview?: InvoicePreview[];
}

async function requireAuthedOrgId() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 as const, json: { error: "Unauthorized" as const } };

  const { data: m, error } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id);

  if (error) return { ok: false as const, status: 400 as const, json: { error: error.message } };
  const orgId = m?.[0]?.org_id;
  if (!orgId) return { ok: false as const, status: 403 as const, json: { error: "No org" as const } };

  return { ok: true as const, supabase, orgId, user };
}

function parseHubSpotAmount(amountStr?: string): number {
  if (!amountStr) return 0;
  // Remove currency symbols and parse
  const cleaned = amountStr.replace(/[$,]/g, '');
  const amount = parseFloat(cleaned);
  return Math.round(amount * 100); // Convert to cents
}

function mapHubSpotStatus(hsStatus?: string): string {
  if (!hsStatus) return 'draft';
  
  const status = hsStatus.toLowerCase();
  switch (status) {
    case 'paid':
    case 'payment_received':
      return 'paid';
    case 'sent':
    case 'delivered':
    case 'viewed':
      return 'sent';
    case 'overdue':
      return 'overdue';
    case 'void':
    case 'voided':
      return 'void';
    case 'draft':
    default:
      return 'draft';
  }
}

async function findOrCreateClient(
  hsInvoice: HSInvoice,
  supabase: any,
  orgId: string
): Promise<string | null> {
  // Get client info directly from invoice properties (no additional API calls needed)
  const email = hsInvoice.properties?.hs_invoice_latest_contact_email;
  const firstName = hsInvoice.properties?.hs_invoice_latest_contact_firstname || '';
  const lastName = hsInvoice.properties?.hs_invoice_latest_contact_lastname || '';
  const companyName = hsInvoice.properties?.hs_invoice_latest_company_name || '';
  
  if (!email) {
    console.warn(`No contact email for HubSpot invoice ${hsInvoice.id}`);
    return null;
  }

  const name = `${firstName} ${lastName}`.trim() || email;

  try {
    // Check if client already exists
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('email', email)
      .eq('org_id', orgId)
      .single();

    if (existingClient) {
      return existingClient.id;
    }

    // Create new client
    const { data: newClient, error } = await supabase
      .from('clients')
      .insert({
        org_id: orgId,
        name,
        email,
        phone: null, // Not available in invoice properties
        company: companyName || null,
        status: 'active',
        source: 'hubspot_invoice_sync'
      })
      .select('id')
      .single();

    if (error) {
      console.error(`Failed to create client for ${email}:`, error);
      return null;
    }

    return newClient.id;
  } catch (error) {
    console.error(`Failed to create/find client for ${email}:`, error);
    return null;
  }
}

export async function GET(request: Request) {
  const gate = await requireAuthedOrgId();
  if (!gate.ok) return NextResponse.json(gate.json, { status: gate.status });

  const { searchParams } = new URL(request.url);
  const requestedLimit = parseInt(searchParams.get('limit') || '100');
  const limit = Math.min(requestedLimit, 100); // HubSpot max is 100
  const dry = searchParams.get('dry') === '1';
  const preview = searchParams.get('preview') === '1';

  const result: InvoiceSyncResult = {
    scanned: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    dry,
    preview: preview ? [] : undefined
  };

  try {
    console.log(`[hubspot-invoice-sync] Starting sync (dry=${dry})`);

    // Fetch invoices from HubSpot with correct properties
    const hsInvoices = await hsGet<HSListResp<HSInvoice>>('/crm/v3/objects/invoices', {
      limit: limit.toString(),
      properties: 'hs_number,hs_amount_billed,hs_invoice_status,hs_invoice_date,hs_due_date,hs_payment_date,hs_currency,hs_comments,hs_invoice_latest_contact_email,hs_invoice_latest_contact_firstname,hs_invoice_latest_contact_lastname,hs_invoice_latest_company_name',
      associations: 'contacts,deals,companies'
    });
    
    // Debug: Log the first invoice to see what properties are available
    if (hsInvoices.results.length > 0) {
      console.log('[hubspot-invoice-sync] Sample invoice properties:', JSON.stringify(hsInvoices.results[0].properties, null, 2));
    }

    console.log(`[hubspot-invoice-sync] Found ${hsInvoices.results.length} HubSpot invoices`);

    for (const hsInvoice of hsInvoices.results) {
      result.scanned++;
      
      try {
        // Use correct HubSpot property names
        const invoiceNumber = hsInvoice.properties?.hs_number;
        const amount = parseHubSpotAmount(hsInvoice.properties?.hs_amount_billed);
        const hubspotStatus = hsInvoice.properties?.hs_invoice_status || 'unknown';
        const status = mapHubSpotStatus(hubspotStatus);
        
        if (!invoiceNumber || amount <= 0) {
          if (preview && result.preview) {
            result.preview.push({
              hubspot_id: hsInvoice.id,
              invoice_number: invoiceNumber || 'Unknown',
              amount_cents: amount,
              amount_display: `$${(amount / 100).toFixed(2)}`,
              status,
              hubspot_status: hubspotStatus,
              client_name: 'Unknown',
              client_email: 'Unknown',
              date: hsInvoice.properties?.hs_invoice_date || 'Unknown',
              exists_in_db: false,
              can_import: false,
              skip_reason: !invoiceNumber ? 'No invoice number' : 'Invalid amount'
            });
          }
          result.skipped++;
          continue;
        }

        // Check if invoice already exists
        const { data: existingInvoice } = await gate.supabase
          .from('invoices')
          .select('id, status, amount_cents')
          .eq('invoice_number', invoiceNumber)
          .eq('org_id', gate.orgId)
          .single();

        // Get client info from invoice properties (no additional API call needed)
        const clientEmail = hsInvoice.properties?.hs_invoice_latest_contact_email || 'Unknown';
        const clientFirstName = hsInvoice.properties?.hs_invoice_latest_contact_firstname || '';
        const clientLastName = hsInvoice.properties?.hs_invoice_latest_contact_lastname || '';
        const clientName = `${clientFirstName} ${clientLastName}`.trim() || clientEmail;

        if (preview && result.preview) {
          result.preview.push({
            hubspot_id: hsInvoice.id,
            invoice_number: invoiceNumber,
            amount_cents: amount,
            amount_display: `$${(amount / 100).toFixed(2)}`,
            status,
            hubspot_status: hubspotStatus,
            client_name: clientName,
            client_email: clientEmail,
            date: hsInvoice.properties?.hs_invoice_date || new Date().toISOString(),
            exists_in_db: !!existingInvoice,
            existing_id: existingInvoice?.id,
            can_import: !existingInvoice && clientEmail !== 'Unknown',
            skip_reason: existingInvoice ? 'Already exists' : clientEmail === 'Unknown' ? 'No client email' : undefined
          });
        }

        if (!preview) {
          // Only do actual processing if not in preview mode
          if (existingInvoice) {
            // Update existing invoice if needed
            if (existingInvoice.status !== status || existingInvoice.amount_cents !== amount) {
              if (!dry) {
                await gate.supabase
                  .from('invoices')
                  .update({
                    status,
                    amount_cents: amount,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', existingInvoice.id);
              }
              result.updated++;
              console.log(`[hubspot-invoice-sync] Updated invoice ${invoiceNumber}`);
            } else {
              result.skipped++;
            }
            continue;
          }

          // Find or create client
          const clientId = await findOrCreateClient(hsInvoice, gate.supabase, gate.orgId);
          if (!clientId) {
            result.errors.push(`No client found for invoice ${invoiceNumber}`);
            continue;
          }

          // Create new invoice
          if (!dry) {
            const invoiceData = {
              org_id: gate.orgId,
              client_id: clientId,
              invoice_number: invoiceNumber,
              amount_cents: amount,
              status,
              description: hsInvoice.properties?.hs_comments || `HubSpot Invoice ${invoiceNumber}`,
              issued_at: hsInvoice.properties?.hs_invoice_date ? new Date(hsInvoice.properties.hs_invoice_date).toISOString() : new Date().toISOString(),
              due_at: hsInvoice.properties?.hs_due_date ? new Date(hsInvoice.properties.hs_due_date).toISOString() : null,
              source: 'hubspot',
              hubspot_invoice_id: hsInvoice.id
            };

            const { data: newInvoice, error: insertError } = await gate.supabase
              .from('invoices')
              .insert(invoiceData)
              .select('id')
              .single();

            if (insertError) {
              result.errors.push(`Failed to create invoice ${invoiceNumber}: ${insertError.message}`);
              continue;
            }

            // If the invoice is marked as paid in HubSpot, create a payment record
            if (status === 'paid' && newInvoice) {
              const paymentDate = hsInvoice.properties?.hs_payment_date || hsInvoice.properties?.hs_invoice_date || new Date().toISOString();
              
              const paymentData = {
                invoice_id: newInvoice.id,
                amount_cents: amount,
                paid_at: new Date(paymentDate).toISOString(),
                payment_method: 'hubspot', // Could be enhanced to detect actual method
                metadata: {
                  source: 'hubspot_import',
                  hubspot_invoice_id: hsInvoice.id,
                  hubspot_status: hubspotStatus
                }
              };

              const { error: paymentError } = await gate.supabase
                .from('invoice_payments')
                .insert(paymentData);

              if (paymentError) {
                console.warn(`[hubspot-invoice-sync] Failed to create payment for invoice ${invoiceNumber}: ${paymentError.message}`);
                // Don't fail the entire import if payment creation fails
              } else {
                console.log(`[hubspot-invoice-sync] Created payment record for paid invoice ${invoiceNumber}`);
              }
            }
          }

          result.created++;
          console.log(`[hubspot-invoice-sync] Created invoice ${invoiceNumber} for $${(amount / 100).toFixed(2)}`);
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Error processing invoice ${hsInvoice.id}: ${errorMsg}`);
        console.error(`[hubspot-invoice-sync] Error processing invoice ${hsInvoice.id}:`, error);
      }
    }

    console.log(`[hubspot-invoice-sync] Completed: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.errors.length} errors`);

    return NextResponse.json(result);

  } catch (error: unknown) {
    console.error("[hubspot-invoice-sync] Fatal error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ 
      error: message,
      ...result
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const gate = await requireAuthedOrgId();
  if (!gate.ok) return NextResponse.json(gate.json, { status: gate.status });

  try {
    const { selected_invoices } = await request.json();
    
    if (!Array.isArray(selected_invoices) || selected_invoices.length === 0) {
      return NextResponse.json({ error: "No invoices selected" }, { status: 400 });
    }

    const result: InvoiceSyncResult = {
      scanned: selected_invoices.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      dry: false
    };

    console.log(`[hubspot-invoice-import] Importing ${selected_invoices.length} selected invoices`);

    for (const hubspotId of selected_invoices) {
      try {
        // Get invoice details from HubSpot
        const hsInvoice = await hsGet<HSInvoice>(`/crm/v3/objects/invoices/${hubspotId}`, {
          properties: 'hs_number,hs_amount_billed,hs_invoice_status,hs_invoice_date,hs_due_date,hs_payment_date,hs_currency,hs_comments,hs_invoice_latest_contact_email,hs_invoice_latest_contact_firstname,hs_invoice_latest_contact_lastname,hs_invoice_latest_company_name',
          associations: 'contacts,deals,companies'
        });

        const invoiceNumber = hsInvoice.properties?.hs_number;
        const amount = parseHubSpotAmount(hsInvoice.properties?.hs_amount_billed);
        const status = mapHubSpotStatus(hsInvoice.properties?.hs_invoice_status);

        if (!invoiceNumber || amount <= 0) {
          result.errors.push(`Invalid invoice data for ${hubspotId}`);
          continue;
        }

        // Check if already exists
        const { data: existingInvoice } = await gate.supabase
          .from('invoices')
          .select('id')
          .eq('invoice_number', invoiceNumber)
          .eq('org_id', gate.orgId)
          .single();

        if (existingInvoice) {
          result.skipped++;
          console.log(`[hubspot-invoice-import] Invoice ${invoiceNumber} already exists, skipping`);
          continue;
        }

        // Find or create client
        const clientId = await findOrCreateClient(hsInvoice, gate.supabase, gate.orgId);
        if (!clientId) {
          result.errors.push(`No client found for invoice ${invoiceNumber}`);
          continue;
        }

        // Create invoice
        const invoiceData = {
          org_id: gate.orgId,
          client_id: clientId,
          invoice_number: invoiceNumber,
          amount_cents: amount,
          status,
          description: hsInvoice.properties?.hs_comments || `HubSpot Invoice ${invoiceNumber}`,
          issued_at: hsInvoice.properties?.hs_invoice_date ? new Date(hsInvoice.properties.hs_invoice_date).toISOString() : new Date().toISOString(),
          due_at: hsInvoice.properties?.hs_due_date ? new Date(hsInvoice.properties.hs_due_date).toISOString() : null,
          source: 'hubspot',
          hubspot_invoice_id: hsInvoice.id
        };

        const { data: newInvoice, error: insertError } = await gate.supabase
          .from('invoices')
          .insert(invoiceData)
          .select('id')
          .single();

        if (insertError) {
          result.errors.push(`Failed to create invoice ${invoiceNumber}: ${insertError.message}`);
          continue;
        }

        // If the invoice is marked as paid in HubSpot, create a payment record
        if (status === 'paid' && newInvoice) {
          const hubspotStatus = hsInvoice.properties?.hs_invoice_status || 'unknown';
          const paymentDate = hsInvoice.properties?.hs_payment_date || hsInvoice.properties?.hs_invoice_date || new Date().toISOString();
          
          const paymentData = {
            invoice_id: newInvoice.id,
            amount_cents: amount,
            paid_at: new Date(paymentDate).toISOString(),
            payment_method: 'hubspot', // Could be enhanced to detect actual method
            metadata: {
              source: 'hubspot_import',
              hubspot_invoice_id: hsInvoice.id,
              hubspot_status: hubspotStatus
            }
          };

          const { error: paymentError } = await gate.supabase
            .from('invoice_payments')
            .insert(paymentData);

          if (paymentError) {
            console.warn(`[hubspot-invoice-import] Failed to create payment for invoice ${invoiceNumber}: ${paymentError.message}`);
            // Don't fail the entire import if payment creation fails
          } else {
            console.log(`[hubspot-invoice-import] Created payment record for paid invoice ${invoiceNumber}`);
          }
        }

        result.created++;
        console.log(`[hubspot-invoice-import] Created invoice ${invoiceNumber} for $${(amount / 100).toFixed(2)}`);

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Error importing invoice ${hubspotId}: ${errorMsg}`);
        console.error(`[hubspot-invoice-import] Error importing ${hubspotId}:`, error);
      }
    }

    console.log(`[hubspot-invoice-import] Completed: ${result.created} created, ${result.skipped} skipped, ${result.errors.length} errors`);

    return NextResponse.json(result);

  } catch (error: unknown) {
    console.error("[hubspot-invoice-import] Fatal error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}