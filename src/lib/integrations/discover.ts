/**
 * Auto-discovery of per-client report integrations from just the client's
 * website URL:
 *   - Vercel project ID  — match the hostname against each project's domains
 *   - GA4 property ID     — match the hostname against each property's data-stream URL
 *
 * The matching is intentionally conservative: only an exact apex-hostname match
 * counts. If zero or several candidates match, we return `null` plus a reason
 * rather than guessing and silently wiring up the wrong client's analytics.
 *
 * The pure helpers (apexHostname / matchByApex) carry the logic and are unit
 * tested; the async resolvers wrap the Vercel + GA4 Admin APIs around them.
 */
import { googleServiceFactory } from '@/lib/google/googleServiceFactory';

const VERCEL_API = 'https://api.vercel.com';

/**
 * Normalize any URL-ish string to its apex hostname: lowercased, no protocol,
 * no path, no leading `www.`. Returns null if it can't be parsed.
 */
export function apexHostname(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const host = new URL(withProto).hostname.toLowerCase();
    return host.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

/**
 * Return the first domain in `domains` whose apex equals `target`, else null.
 * Each domain is normalized the same way as the target so `www.foo.com`,
 * `foo.com`, and `https://foo.com/` all compare equal.
 */
export function matchByApex(target: string, domains: (string | null | undefined)[]): string | null {
  for (const d of domains) {
    if (apexHostname(d) === target) return (d ?? '').trim();
  }
  return null;
}

export interface ResolveResult {
  /** The discovered ID, or null if not found / not available. */
  value: string | null;
  /** Which domain/stream matched, for surfacing to the user. */
  matched?: string;
  /** Why nothing was found (only set when value is null). */
  reason?: string;
}

function vercelTeamParam(): string {
  const teamId = process.env.VERCEL_TEAM_ID;
  return teamId ? `&teamId=${encodeURIComponent(teamId)}` : '';
}

async function vercelGet(path: string): Promise<any | null> {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) return null;
  const res = await fetch(`${VERCEL_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function resolveVercelProjectId(websiteUrl: string): Promise<ResolveResult> {
  const apex = apexHostname(websiteUrl);
  if (!apex) return { value: null, reason: 'Could not parse a hostname from the website URL' };
  if (!process.env.VERCEL_API_TOKEN) return { value: null, reason: 'VERCEL_API_TOKEN is not configured' };

  const list = await vercelGet(`/v9/projects?limit=100${vercelTeamParam()}`);
  const projects: { id: string; name: string }[] = list?.projects || [];
  if (projects.length === 0) return { value: null, reason: 'No Vercel projects accessible with this token' };

  // Fetch each project's domains in parallel and match by apex hostname.
  const matches = await Promise.all(
    projects.map(async (p) => {
      const data = await vercelGet(`/v9/projects/${p.id}/domains?limit=100${vercelTeamParam()}`);
      const domains: string[] = (data?.domains || []).map((d: any) => d?.name).filter(Boolean);
      const matched = matchByApex(apex, domains);
      return matched ? { id: p.id, matched } : null;
    }),
  );

  const hit = matches.find(Boolean);
  if (hit) return { value: hit.id, matched: hit.matched };
  return { value: null, reason: `No Vercel project has a domain matching ${apex}` };
}

export async function resolveGa4PropertyId(websiteUrl: string): Promise<ResolveResult> {
  const apex = apexHostname(websiteUrl);
  if (!apex) return { value: null, reason: 'Could not parse a hostname from the website URL' };

  const admin = await googleServiceFactory.getAnalyticsAdminClient();
  if (!admin) return { value: null, reason: 'GA4 Admin API unavailable (service account not configured)' };

  let propertyNames: string[];
  try {
    const summaries = await admin.accountSummaries.list({ pageSize: 200 });
    const accounts = summaries?.data?.accountSummaries || [];
    propertyNames = accounts
      .flatMap((a: any) => a.propertySummaries || [])
      .map((p: any) => p.property as string) // e.g. "properties/123456"
      .filter(Boolean)
      .slice(0, 200);
  } catch (e: any) {
    return { value: null, reason: `GA4 Admin API error: ${e.message} (is the Admin API enabled?)` };
  }

  if (propertyNames.length === 0) {
    return { value: null, reason: 'Service account has access to no GA4 properties' };
  }

  // Match each property's web data-stream URL against the client's hostname.
  const matches = await Promise.all(
    propertyNames.map(async (name) => {
      try {
        const streams = await admin.properties.dataStreams.list({ parent: name, pageSize: 50 });
        const uris: string[] = (streams?.data?.dataStreams || [])
          .map((s: any) => s?.webStreamData?.defaultUri)
          .filter(Boolean);
        const matched = matchByApex(apex, uris);
        return matched ? { name, matched } : null;
      } catch {
        return null; // no access to this property's streams — skip it
      }
    }),
  );

  const hit = matches.find(Boolean);
  if (hit) {
    return { value: hit.name.replace('properties/', ''), matched: hit.matched };
  }
  return { value: null, reason: `No GA4 property has a web stream matching ${apex}` };
}

/**
 * Apex hostname of a Search Console site URL, handling both property kinds:
 *   - URL-prefix:  "https://www.example.com/" -> "example.com"
 *   - domain:      "sc-domain:example.com"    -> "example.com"
 */
export function gscSiteApex(siteUrl: string | null | undefined): string | null {
  if (!siteUrl) return null;
  const domain = siteUrl.match(/^sc-domain:(.+)$/i);
  return apexHostname(domain ? domain[1] : siteUrl);
}

export async function resolveGscSiteUrl(websiteUrl: string): Promise<ResolveResult> {
  const apex = apexHostname(websiteUrl);
  if (!apex) return { value: null, reason: 'Could not parse a hostname from the website URL' };

  const sc = await googleServiceFactory.getSearchConsoleClient();
  if (!sc) return { value: null, reason: 'Search Console API unavailable (service account not configured)' };

  let sites: { siteUrl?: string }[];
  try {
    const res = await sc.sites.list();
    sites = res?.data?.siteEntry || [];
  } catch (e: any) {
    return { value: null, reason: `Search Console API error: ${e.message}` };
  }

  if (sites.length === 0) {
    return { value: null, reason: 'Service account is not added to any Search Console property' };
  }

  for (const s of sites) {
    if (s.siteUrl && gscSiteApex(s.siteUrl) === apex) {
      return { value: s.siteUrl, matched: s.siteUrl };
    }
  }
  return { value: null, reason: `Service account has no Search Console property matching ${apex}` };
}

export interface DiscoveredIntegrations {
  apex: string | null;
  vercel: ResolveResult;
  ga4: ResolveResult;
  gsc: ResolveResult;
}

/**
 * Resolve every auto-detectable integration for a website in parallel.
 * Never throws — each integration reports its own success/reason.
 */
export async function discoverIntegrations(websiteUrl: string): Promise<DiscoveredIntegrations> {
  const apex = apexHostname(websiteUrl);
  if (!apex) {
    const reason = 'Could not parse a hostname from the website URL';
    return { apex: null, vercel: { value: null, reason }, ga4: { value: null, reason }, gsc: { value: null, reason } };
  }
  const [vercel, ga4, gsc] = await Promise.all([
    resolveVercelProjectId(websiteUrl).catch((e) => ({ value: null, reason: `Vercel lookup failed: ${e.message}` } as ResolveResult)),
    resolveGa4PropertyId(websiteUrl).catch((e) => ({ value: null, reason: `GA4 lookup failed: ${e.message}` } as ResolveResult)),
    resolveGscSiteUrl(websiteUrl).catch((e) => ({ value: null, reason: `Search Console lookup failed: ${e.message}` } as ResolveResult)),
  ]);
  return { apex, vercel, ga4, gsc };
}
