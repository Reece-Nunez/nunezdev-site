import type { SectionStatus } from '@/lib/pdf-templates/client-report';
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
const LINK_CHECK_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

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
  // Items: [Search Console, Sitemap, Broken links, Meta titles/desc, OG tags]
  const items = [false, false, false, false, false];
  const notes: string[] = [];
  let status: SectionStatus = 'healthy';

  let html = '';

  // Fetch homepage for meta tag analysis
  try {
    const res = await fetch(websiteUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'NunezDev-ReportBot/1.0' },
    });
    if (res.ok) {
      html = await res.text();
    }
  } catch { /* handled below */ }

  // Check 2: Sitemap
  try {
    const sitemapUrl = `${websiteUrl.replace(/\/$/, '')}/sitemap.xml`;
    const res = await fetch(sitemapUrl, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const text = await res.text();
      if (text.includes('<urlset') || text.includes('<sitemapindex')) {
        items[1] = true;
        const urlCount = (text.match(/<url>/g) || []).length;
        notes.push(`Sitemap found with ${urlCount} URLs`);
      } else {
        notes.push('Sitemap exists but may not be valid XML');
        if (status === 'healthy') status = 'attention';
      }
    } else {
      notes.push('No sitemap.xml found');
      if (status === 'healthy') status = 'attention';
    }
  } catch {
    notes.push('Could not check sitemap');
  }

  // Check 4: Meta titles and descriptions
  if (html) {
    const title = extractTitle(html);
    const description = extractMeta(html, 'description');

    if (title && description) {
      items[3] = true;
      notes.push(`Title: "${title.substring(0, 60)}${title.length > 60 ? '...' : ''}"`);
    } else {
      const missing: string[] = [];
      if (!title) missing.push('title');
      if (!description) missing.push('meta description');
      notes.push(`Missing: ${missing.join(', ')}`);
      if (status === 'healthy') status = 'attention';
    }

    // Check 5: Open Graph tags
    const ogTitle = extractMeta(html, 'og:title');
    const ogDesc = extractMeta(html, 'og:description');
    const ogImage = extractMeta(html, 'og:image');

    if (ogTitle && ogDesc && ogImage) {
      items[4] = true;
    } else {
      const missingOg: string[] = [];
      if (!ogTitle) missingOg.push('og:title');
      if (!ogDesc) missingOg.push('og:description');
      if (!ogImage) missingOg.push('og:image');
      notes.push(`Missing OG tags: ${missingOg.join(', ')}`);
      if (status === 'healthy') status = 'attention';
    }
  }

  // Check 3: Broken links (limited to 20 links, 5s timeout each)
  if (html) {
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
          // Network error / timeout — unconfirmed, not necessarily dead.
          return classifyLink(0);
        }
      })
    );

    const brokenCount = verdicts.filter((v) => v === 'broken').length;
    const unverifiedCount = verdicts.filter((v) => v === 'unverified').length;

    if (brokenCount === 0) {
      items[2] = true;
      // Unverified links (bot-blocked socials, slow hosts) are surfaced for
      // transparency but never flip the section to "attention".
      const suffix =
        unverifiedCount > 0
          ? ` (${unverifiedCount} could not be verified — likely bot-blocked or slow, not counted as broken)`
          : '';
      notes.push(`Checked ${links.length} links, no broken links found${suffix}`);
    } else {
      notes.push(`Found ${brokenCount} broken link${brokenCount > 1 ? 's' : ''} out of ${links.length} checked`);
      if (status === 'healthy') status = 'attention';
    }
  }

  return { items, status, notes: notes.join('. ') };
}
