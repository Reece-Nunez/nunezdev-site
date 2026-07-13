/**
 * Inbound MMS media handling.
 *
 * Twilio delivers inbound media as `NumMedia` + `MediaUrl{i}` / `MediaContentType{i}`
 * form fields on the webhook. Those URLs live on api.twilio.com, require HTTP
 * Basic auth (Account SID + Auth Token) to fetch, and Twilio deletes the media
 * after a retention window. So we can't just store the Twilio URL and render it
 * later — we fetch each item and re-host it in our own S3 bucket, then store the
 * resulting `key`. That reuses the exact presigned-view render path the inbox
 * already uses for outbound attachments, and the image survives Twilio's cleanup.
 */
import { putS3Object } from './s3';

export interface InboundMediaRef {
  url: string;
  contentType: string;
}

export interface StoredMedia {
  key: string;
  filename: string;
  contentType: string;
  size: number;
}

// Twilio caps inbound MMS at 10 media per message; guard anyway so a malformed
// NumMedia can't spin us into a huge loop.
const MAX_INBOUND_MEDIA = 10;

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/**
 * Pure extraction of media refs from a Twilio webhook param bag. Kept separate
 * from the network/S3 work so the parsing rules (count clamp, missing URL skip)
 * are unit-testable without mocking fetch or S3.
 */
export function parseInboundMediaRefs(params: Record<string, string>): InboundMediaRef[] {
  const declared = parseInt(params.NumMedia ?? '0', 10);
  const count = Number.isFinite(declared) ? Math.min(Math.max(declared, 0), MAX_INBOUND_MEDIA) : 0;
  const refs: InboundMediaRef[] = [];
  for (let i = 0; i < count; i++) {
    const url = params[`MediaUrl${i}`];
    if (!url) continue; // gap in the sequence — skip rather than store an empty ref
    refs.push({
      url,
      contentType: params[`MediaContentType${i}`] || 'application/octet-stream',
    });
  }
  return refs;
}

/** Map a MIME type to a file extension for a synthesized filename (Twilio gives
 *  inbound MMS media no filename). Falls back to the subtype, then "bin". */
export function extForContentType(contentType: string): string {
  if (EXT_BY_TYPE[contentType]) return EXT_BY_TYPE[contentType];
  const subtype = (contentType.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '');
  return subtype || 'bin';
}

/**
 * Fetch every inbound media item from Twilio and re-host it in S3, returning the
 * stored refs for recordMessage. Best-effort per item: a single failed fetch is
 * logged and skipped so the rest of the message (text + other images) still
 * threads. Returns [] when there's no media or Twilio creds are absent.
 */
export async function ingestInboundMedia(
  params: Record<string, string>,
  messageSid: string | undefined,
): Promise<StoredMedia[]> {
  const refs = parseInboundMediaRefs(params);
  if (refs.length === 0) return [];

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    console.error('[twilioMedia] cannot fetch inbound media — Twilio creds missing');
    return [];
  }
  // Twilio media URLs use HTTP Basic auth; the api.twilio.com endpoint then
  // 302-redirects to a pre-signed media host. fetch drops the Authorization
  // header on the cross-origin redirect (per spec), which is fine — the target
  // URL is already signed.
  const auth = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  // Deterministic key prefix keyed on the MessageSid so webhook retries overwrite
  // the same objects instead of piling up duplicates.
  const sidPart = (messageSid || 'mms').replace(/[^A-Za-z0-9]/g, '');

  const stored: (StoredMedia | undefined)[] = await Promise.all(
    refs.map(async (ref, i): Promise<StoredMedia | undefined> => {
      try {
        const res = await fetch(ref.url, { headers: { Authorization: auth }, redirect: 'follow' });
        if (!res.ok) {
          console.error('[twilioMedia] fetch failed', res.status, ref.url);
          return undefined;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        const filename = `image-${i + 1}.${extForContentType(ref.contentType)}`;
        const key = `inbound-mms/${sidPart}/${i}_${filename}`;
        await putS3Object(key, buf, ref.contentType);
        return { key, filename, contentType: ref.contentType, size: buf.byteLength };
      } catch (err) {
        console.error('[twilioMedia] ingest failed for', ref.url, err);
        return undefined;
      }
    }),
  );

  return stored.filter((m): m is StoredMedia => m !== undefined);
}
