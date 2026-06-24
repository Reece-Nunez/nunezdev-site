import { blankItems, markItem, type SectionStatus } from './sections';
import { classifyLink, LINK_CHECK_UA, type LinkVerdict } from './seo';
import type { AutomationSectionResult } from './types';

/**
 * Probe one image. Mirrors the link checker's conservative rule: only a
 * hard-dead response (404/410/5xx) counts as broken. Image CDNs commonly answer
 * a bot HEAD with 403/405 while serving the real image fine, so those — plus
 * timeouts — are "unverified", never broken. Falls back to GET when HEAD is
 * inconclusive (some hosts reject HEAD).
 */
async function probeImage(src: string): Promise<LinkVerdict> {
  const opts = (method: 'HEAD' | 'GET') => ({
    method,
    signal: AbortSignal.timeout(4000),
    redirect: 'follow' as const,
    headers: { 'User-Agent': LINK_CHECK_UA },
  });
  try {
    const head = await fetch(src, opts('HEAD'));
    const verdict = classifyLink(head.status);
    if (verdict === 'ok' || verdict === 'broken') return verdict;
    // HEAD was inconclusive (403/405/429) — try GET before judging.
    const get = await fetch(src, opts('GET'));
    return classifyLink(get.status);
  } catch {
    return classifyLink(0); // network error / timeout → unverified
  }
}

function extractImageSrcs(html: string, baseUrl: string): string[] {
  const imgRegex = /src=["']([^"']+)["']/gi;
  const srcs = new Set<string>();
  // Only look at <img> tags
  const imgTagRegex = /<img[^>]+>/gi;
  let imgMatch;
  while ((imgMatch = imgTagRegex.exec(html)) !== null) {
    let srcMatch;
    while ((srcMatch = imgRegex.exec(imgMatch[0])) !== null) {
      try {
        const url = new URL(srcMatch[1], baseUrl);
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          srcs.add(url.href);
        }
      } catch { /* skip data URIs and invalid */ }
    }
  }
  return Array.from(srcs);
}

export async function checkContent(websiteUrl: string): Promise<AutomationSectionResult> {
  const items = blankItems('content');
  const notes: string[] = [];
  const recommendations: string[] = [];
  let status: SectionStatus = 'healthy';

  try {
    const res = await fetch(websiteUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'NunezDev-ReportBot/1.0' },
    });

    if (!res.ok) {
      notes.push('Could not fetch homepage to check content');
      // Leave auto items pending — we genuinely could not verify them.
      return { items, status: 'unknown', notes: notes.join('. '), recommendations };
    }

    const html = await res.text();

    // Images loading
    const imageSrcs = extractImageSrcs(html, websiteUrl).slice(0, 30);
    if (imageSrcs.length > 0) {
      const verdicts = await Promise.all(imageSrcs.map(probeImage));
      const broken = verdicts.filter(v => v === 'broken').length;
      const unverified = verdicts.filter(v => v === 'unverified').length;

      if (broken === 0) {
        // Bot-blocked / slow images are surfaced for transparency but never
        // flip the section to "attention".
        const suffix = unverified > 0
          ? ` (${unverified} could not be verified — likely bot-blocked or slow)`
          : '';
        markItem(items, 'images', 'pass', `${imageSrcs.length} checked, none broken`);
        notes.push(`Checked ${imageSrcs.length} images, none broken${suffix}`);
      } else {
        markItem(items, 'images', 'fail', `${broken} of ${imageSrcs.length} broken`);
        notes.push(`${broken} broken image${broken > 1 ? 's' : ''} found out of ${imageSrcs.length}`);
        recommendations.push('Fix broken images on the homepage so all visual content loads.');
        status = 'attention';
      }
    } else {
      markItem(items, 'images', 'pass', 'no homepage images');
      notes.push('No images found on homepage');
    }

    // Placeholder / outdated content
    const placeholderPatterns = [
      /lorem ipsum/i,
      /placeholder text/i,
      /coming soon/i,
      /under construction/i,
      /TODO/,
      /FIXME/,
    ];

    const foundPlaceholders: string[] = [];
    for (const pattern of placeholderPatterns) {
      if (pattern.test(html)) {
        foundPlaceholders.push(pattern.source.replace(/\\i$/, ''));
      }
    }

    if (foundPlaceholders.length === 0) {
      markItem(items, 'placeholder', 'pass', 'none detected');
      notes.push('No placeholder or outdated content detected');
    } else {
      markItem(items, 'placeholder', 'fail', foundPlaceholders.join(', '));
      notes.push(`Potential placeholder content found: ${foundPlaceholders.join(', ')}`);
      recommendations.push('Review and replace placeholder/“coming soon” content found on the site.');
      if (status === 'healthy') status = 'attention';
    }
  } catch (e: any) {
    notes.push(`Could not check content: ${e.message}`);
    return { items, status: 'unknown', notes: notes.join('. '), recommendations };
  }

  return { items, status, notes: notes.join('. '), recommendations };
}
