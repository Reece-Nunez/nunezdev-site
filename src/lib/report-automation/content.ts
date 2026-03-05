import type { SectionStatus } from '@/lib/pdf-templates/client-report';
import type { AutomationSectionResult } from './types';

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
  // Items: [gallery images loading, outdated content, ask client about projects]
  const items = [false, false, false];
  const notes: string[] = [];
  let status: SectionStatus = 'healthy';

  try {
    const res = await fetch(websiteUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'NunezDev-ReportBot/1.0' },
    });

    if (!res.ok) {
      notes.push('Could not fetch homepage to check content');
      return { items, status: 'attention', notes: notes.join('. ') };
    }

    const html = await res.text();

    // Check 1: Image loading
    const imageSrcs = extractImageSrcs(html, websiteUrl).slice(0, 30);
    if (imageSrcs.length > 0) {
      let brokenImages = 0;
      const results = await Promise.allSettled(
        imageSrcs.map(async (src) => {
          const imgRes = await fetch(src, {
            method: 'HEAD',
            signal: AbortSignal.timeout(3000),
          });
          return imgRes.ok;
        })
      );

      for (const r of results) {
        if (r.status === 'rejected' || (r.status === 'fulfilled' && !r.value)) {
          brokenImages++;
        }
      }

      if (brokenImages === 0) {
        items[0] = true;
        notes.push(`All ${imageSrcs.length} images loading correctly`);
      } else {
        notes.push(`${brokenImages} broken image${brokenImages > 1 ? 's' : ''} found out of ${imageSrcs.length}`);
        status = 'attention';
      }
    } else {
      notes.push('No images found on homepage');
      items[0] = true;
    }

    // Check 2: Placeholder / outdated content
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
      items[1] = true;
      notes.push('No placeholder or outdated content detected');
    } else {
      notes.push(`Potential placeholder content found: ${foundPlaceholders.join(', ')}`);
      if (status === 'healthy') status = 'attention';
    }
  } catch (e: any) {
    notes.push(`Could not check content: ${e.message}`);
  }

  return { items, status, notes: notes.join('. ') };
}
