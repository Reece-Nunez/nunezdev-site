// Geo-based lead quality screening for public contact/lead submissions.
//
// Turnstile + the content screen in lib/leadSpamFilter stop bots and gibberish,
// but they can't stop a *real human* in an off-target market from submitting a
// low-value inquiry (YouTube-clone / AEPS-UPI recharge-app requests from outside
// North America were slipping straight into the notification + nurture + Google
// Ads conversion pipeline). This module flags those by request geography.
//
// The bias here is the mirror image of leadSpamFilter: we still STORE flagged
// leads (nothing is lost), we just quarantine them — no notifications, no
// nurture sequence, and critically no `generate_lead` conversion, so Google Ads
// Smart Bidding stops being rewarded for finding more of them. Geography is a
// softer signal than a honeypot, so quarantine (not rejection) is the safe call.

// Markets we treat as legitimate. Everything else with a *known* country is
// quarantined. Oklahoma small business + the occasional North American agency
// reseller — see the pipeline note above. Kept as a Set for O(1) membership.
export const ALLOWED_COUNTRIES = new Set(["US", "CA"]);

// Vercel populates x-vercel-ip-country on every request in production; if the
// site is fronted by Cloudflare, cf-ipcountry is present too. We read Vercel's
// first (that's our host) and fall back to Cloudflare's. Returns an uppercased
// ISO-3166 alpha-2 code, or null when geography is unavailable (local dev,
// preview, an unknown edge) — callers must treat null as "allow", never block.
export function getRequestCountry(
  headers: Pick<Headers, "get">
): string | null {
  const raw =
    headers.get("x-vercel-ip-country") ?? headers.get("cf-ipcountry") ?? "";
  const code = raw.trim().toUpperCase();
  // Cloudflare uses "XX" for unknown and "T1" for Tor — neither is a real
  // country, so treat them as "unknown" and fail open rather than quarantine.
  if (!code || code === "XX" || code === "T1") return null;
  return code;
}

// True only when we have a known country AND it's outside the allowlist. An
// unknown country (null) is NOT low quality — we never quarantine a lead just
// because geo lookup failed, mirroring leadSpamFilter's no-false-positives rule.
export function isLowQualityGeo(country: string | null): boolean {
  if (!country) return false;
  return !ALLOWED_COUNTRIES.has(country);
}
