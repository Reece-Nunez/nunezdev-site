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
    let brokenCount = 0;
    const brokenUrls: string[] = [];

    const results = await Promise.allSettled(
      links.map(async (link) => {
        try {
          const res = await fetch(link, {
            method: 'HEAD',
            signal: AbortSignal.timeout(5000),
            redirect: 'follow',
          });
          if (!res.ok && res.status !== 405) {
            return { broken: true, url: link, status: res.status };
          }
          return { broken: false, url: link };
        } catch {
          return { broken: true, url: link, status: 0 };
        }
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.broken) {
        brokenCount++;
        brokenUrls.push(r.value.url);
      }
    }

    if (brokenCount === 0) {
      items[2] = true;
      notes.push(`Checked ${links.length} links, no broken links found`);
    } else {
      notes.push(`Found ${brokenCount} broken link${brokenCount > 1 ? 's' : ''} out of ${links.length} checked`);
      if (status === 'healthy') status = 'attention';
    }
  }

  return { items, status, notes: notes.join('. ') };
}
