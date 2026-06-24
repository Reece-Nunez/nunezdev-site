import { blankItems, markItem, type SectionStatus } from './sections';
import type { AutomationSectionResult } from './types';

function extractMeta(html: string, name: string): string | null {
  // Match <meta name="..." content="..."> or <meta property="..." content="...">
  const regex = new RegExp(`<meta\\s+(?:name|property)=["']${name}["']\\s+content=["']([^"']*)["']`, 'i');
  const altRegex = new RegExp(`<meta\\s+content=["']([^"']*)["']\\s+(?:name|property)=["']${name}["']`, 'i');
  const match = html.match(regex) || html.match(altRegex);
  return match ? match[1] : null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1].trim() : null;
}

function extractLinks(html: string, baseUrl: string): string[] {
  const linkRegex = /href=["']([^"'#]+)["']/gi;
  const links = new Set<string>();
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const url = new URL(match[1], baseUrl);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        links.add(url.href);
      }
    } catch { /* skip invalid URLs */ }
  }
  return Array.from(links);
}

/**
 * Browser-like User-Agent for the link probe. Some hosts (and CDNs/WAFs)
 * answer a generic bot UA with 403/429 while serving real browsers a 200,
 * so presenting as a browser cuts down on false "blocked" results.
 */
export const LINK_CHECK_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Pick the response charset, preferring the Content-Type header, then a
 * <meta charset>/<meta http-equiv> in the document head, defaulting to utf-8.
 * Sites that serve windows-1252 (or omit the charset) were decoded as utf-8,
 * turning em-dashes and smart quotes in <title> into the U+FFFD replacement
 * char ("Goldman Financial � Business Loans") in the client report.
 */
export function detectCharset(contentType: string | null, htmlHead: string): string {
  const fromHeader = (contentType || '').match(/charset=["']?([\w-]+)/i)?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  const fromMeta =
    htmlHead.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ||
    htmlHead.match(/charset=["']?([\w-]+)/i)?.[1];
  return (fromMeta || 'utf-8').toLowerCase();
}

/** Fetch HTML and decode it with the document's actual charset. */
async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: { 'User-Agent': 'NunezDev-ReportBot/1.0' },
  });
  if (!res.ok) return '';
  const buf = await res.arrayBuffer();
  // Sniff the head as latin1 (1 byte = 1 char) just to read the <meta charset>.
  const head = new TextDecoder('latin1').decode(new Uint8Array(buf.slice(0, 2048)));
  const charset = detectCharset(res.headers.get('content-type'), head);
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    return new TextDecoder('utf-8').decode(buf);
  }
}

export type LinkVerdict = 'ok' | 'broken' | 'unverified';

/**
 * Classify a link probe result. `status` is the HTTP status code, or 0 for a
 * network error / timeout.
 *
 * Only hard-dead responses count as broken: 404, 410, and 5xx. Everything
 * else that isn't a clean success — 401/403/429 (auth / anti-bot / rate
 * limit), 405 (HEAD not allowed), a resolved 3xx, or a network error/timeout
 * — is "unverified": we couldn't confirm the link is dead, so we don't alarm
 * the client over it. Social platforms (Instagram, Facebook) routinely answer
 * bots with 403/429/301-to-login while serving 200 to real browsers; counting
 * those as broken produced false positives on client reports.
 */
export function classifyLink(status: number): LinkVerdict {
  if (status === 404 || status === 410 || (status >= 500 && status <= 599)) {
    return 'broken';
  }
  if (status >= 200 && status < 400) {
    return 'ok';
  }
  // 0 (network error/timeout), 401/403/405/429, and any other non-dead code.
  return 'unverified';
}

export async function checkSEO(websiteUrl: string): Promise<AutomationSectionResult> {
  const items = blankItems('seo');
  const notes: string[] = [];
  const recommendations: string[] = [];
  let status: SectionStatus = 'healthy';

  let html = '';

  // Fetch homepage for meta tag analysis (charset-aware so the title renders
  // correctly in the report).
  try {
    html = await fetchHtml(websiteUrl);
  } catch { /* handled below */ }

  // Sitemap
  try {
    const sitemapUrl = `${websiteUrl.replace(/\/$/, '')}/sitemap.xml`;
    const res = await fetch(sitemapUrl, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const text = await res.text();
      if (text.includes('<urlset') || text.includes('<sitemapindex')) {
        const urlCount = (text.match(/<url>/g) || []).length;
        markItem(items, 'sitemap', 'pass', `${urlCount} URLs`);
        notes.push(`Sitemap found with ${urlCount} URLs`);
      } else {
        markItem(items, 'sitemap', 'fail', 'not valid XML');
        notes.push('Sitemap exists but may not be valid XML');
        recommendations.push('Sitemap.xml exists but is not valid — regenerate it so search engines can parse it.');
        if (status === 'healthy') status = 'attention';
      }
    } else {
      markItem(items, 'sitemap', 'fail', `not found (HTTP ${res.status})`);
      notes.push('No sitemap.xml found');
      recommendations.push('Create and submit a sitemap.xml to improve search-engine indexing.');
      if (status === 'healthy') status = 'attention';
    }
  } catch {
    // Could not reach sitemap endpoint — leave pending.
    notes.push('Could not check sitemap');
  }

  // Meta titles/descriptions + Open Graph
  if (html) {
    const title = extractTitle(html);
    const description = extractMeta(html, 'description');

    if (title && description) {
      markItem(items, 'meta', 'pass', `“${title.substring(0, 50)}${title.length > 50 ? '…' : ''}”`);
      notes.push(`Title: "${title.substring(0, 60)}${title.length > 60 ? '...' : ''}"`);
    } else {
      const missing: string[] = [];
      if (!title) missing.push('title');
      if (!description) missing.push('meta description');
      markItem(items, 'meta', 'fail', `missing ${missing.join(' & ')}`);
      notes.push(`Missing: ${missing.join(', ')}`);
      recommendations.push(`Add a ${missing.join(' and ')} to the homepage for better search results.`);
      if (status === 'healthy') status = 'attention';
    }

    const ogTitle = extractMeta(html, 'og:title');
    const ogDesc = extractMeta(html, 'og:description');
    const ogImage = extractMeta(html, 'og:image');

    if (ogTitle && ogDesc && ogImage) {
      markItem(items, 'og', 'pass', 'title, description, image');
    } else {
      const missingOg: string[] = [];
      if (!ogTitle) missingOg.push('og:title');
      if (!ogDesc) missingOg.push('og:description');
      if (!ogImage) missingOg.push('og:image');
      markItem(items, 'og', 'fail', `missing ${missingOg.join(', ')}`);
      notes.push(`Missing OG tags: ${missingOg.join(', ')}`);
      recommendations.push('Add Open Graph tags so shared links show a proper title, description, and image.');
      if (status === 'healthy') status = 'attention';
    }

    // Broken links (limited to 20 links, 5s timeout each)
    const links = extractLinks(html, websiteUrl).slice(0, 20);

    const verdicts = await Promise.all(
      links.map(async (link): Promise<LinkVerdict> => {
        try {
          const res = await fetch(link, {
            method: 'HEAD',
            signal: AbortSignal.timeout(5000),
            redirect: 'follow',
            headers: { 'User-Agent': LINK_CHECK_UA },
          });
          return classifyLink(res.status);
        } catch {
          return classifyLink(0);
        }
      })
    );

    const brokenCount = verdicts.filter((v) => v === 'broken').length;
    const unverifiedCount = verdicts.filter((v) => v === 'unverified').length;

    if (brokenCount === 0) {
      const suffix =
        unverifiedCount > 0
          ? ` (${unverifiedCount} could not be verified — likely bot-blocked or slow)`
          : '';
      markItem(items, 'brokenLinks', 'pass', `${links.length} checked, none broken`);
      notes.push(`Checked ${links.length} links, no broken links found${suffix}`);
    } else {
      markItem(items, 'brokenLinks', 'fail', `${brokenCount} broken of ${links.length}`);
      notes.push(`Found ${brokenCount} broken link${brokenCount > 1 ? 's' : ''} out of ${links.length} checked`);
      recommendations.push(`Fix ${brokenCount} broken link${brokenCount > 1 ? 's' : ''} found on the homepage.`);
      if (status === 'healthy') status = 'attention';
    }
  } else {
    // No homepage HTML — meta/og/brokenLinks stay pending; flag uncertainty.
    notes.push('Could not load homepage HTML for meta/link analysis');
    if (status === 'healthy') status = 'unknown';
  }

  return { items, status, notes: notes.join('. '), recommendations };
}
