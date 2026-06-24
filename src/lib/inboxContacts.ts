/**
 * Resolve a friendly display name for an inbox conversation by cross-referencing
 * its phone/email against the client and lead lists — so a thread shows
 * "Aaron Rian" instead of "+15037107584", even when the number wasn't matched
 * at the moment the conversation was created (e.g. the texter became a client
 * later, or the phone was stored on the client in a different format).
 *
 * The owner's client list is small, so for the conversation LIST we load it
 * once and build in-memory maps rather than doing a per-conversation lookup.
 * For a single thread, prefer resolveContact() from inbox.ts.
 *
 * Server-only (service-role Supabase client).
 */
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizePhoneE164 } from '@/lib/sms';

export interface ContactNameMaps {
  byPhone: Map<string, string>;
  byEmail: Map<string, string>;
}

interface ContactRow {
  name: string | null;
  phone: string | null;
  email: string | null;
}

function addContact(maps: ContactNameMaps, row: ContactRow): void {
  const name = row.name?.trim();
  if (!name) return;
  if (row.phone) {
    // Normalize to E.164 so it matches conversations.contact_phone, which is
    // always stored canonical.
    const e164 = normalizePhoneE164(row.phone);
    if (e164) maps.byPhone.set(e164, name);
  }
  if (row.email) {
    maps.byEmail.set(row.email.trim().toLowerCase(), name);
  }
}

/** Load all clients + leads into phone→name / email→name maps (clients win). */
export async function buildContactNameMaps(): Promise<ContactNameMaps> {
  const supabase = supabaseAdmin();
  const maps: ContactNameMaps = { byPhone: new Map(), byEmail: new Map() };

  const [clientsRes, leadsRes] = await Promise.all([
    supabase.from('clients').select('name, phone, email'),
    supabase.from('leads').select('name, phone, email'),
  ]);

  // Leads first, clients second — a real client name overrides a lead's for
  // the same phone/email.
  for (const l of (leadsRes.data ?? []) as unknown as ContactRow[]) addContact(maps, l);
  for (const c of (clientsRes.data ?? []) as unknown as ContactRow[]) addContact(maps, c);

  return maps;
}

/**
 * Look up a name for one conversation against pre-built maps. Returns null when
 * neither the phone nor the email matches a client/lead.
 */
export function resolveDisplayName(
  maps: ContactNameMaps,
  conv: { contact_phone?: string | null; contact_email?: string | null },
): string | null {
  if (conv.contact_phone) {
    const e164 = normalizePhoneE164(conv.contact_phone);
    if (e164) {
      const byPhone = maps.byPhone.get(e164);
      if (byPhone) return byPhone;
    }
  }
  if (conv.contact_email) {
    const byEmail = maps.byEmail.get(conv.contact_email.trim().toLowerCase());
    if (byEmail) return byEmail;
  }
  return null;
}
