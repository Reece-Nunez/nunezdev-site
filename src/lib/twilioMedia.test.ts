/**
 * Unit tests for the pure inbound-MMS parsing helpers. Run with:
 *
 *   npm test
 *
 * The fetch + S3 re-hosting in ingestInboundMedia is I/O and covered by the live
 * webhook; here we pin the param-parsing rules that decide WHICH media get
 * fetched, since a miscount would either drop a client's image or index past the
 * real media into empty slots.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseInboundMediaRefs, extForContentType } from "./twilioMedia";

describe("parseInboundMediaRefs", () => {
  it("extracts each MediaUrl/MediaContentType pair up to NumMedia", () => {
    const refs = parseInboundMediaRefs({
      NumMedia: "2",
      MediaUrl0: "https://api.twilio.com/.../Media/ME0",
      MediaContentType0: "image/jpeg",
      MediaUrl1: "https://api.twilio.com/.../Media/ME1",
      MediaContentType1: "image/png",
    });
    assert.deepEqual(refs, [
      { url: "https://api.twilio.com/.../Media/ME0", contentType: "image/jpeg" },
      { url: "https://api.twilio.com/.../Media/ME1", contentType: "image/png" },
    ]);
  });

  it("returns [] for a text-only inbound (NumMedia 0 or absent)", () => {
    assert.deepEqual(parseInboundMediaRefs({ NumMedia: "0" }), []);
    assert.deepEqual(parseInboundMediaRefs({}), []);
  });

  it("defaults a missing content type to application/octet-stream", () => {
    const refs = parseInboundMediaRefs({ NumMedia: "1", MediaUrl0: "https://x/y" });
    assert.equal(refs[0].contentType, "application/octet-stream");
  });

  it("skips a gap in the URL sequence instead of storing an empty ref", () => {
    const refs = parseInboundMediaRefs({
      NumMedia: "2",
      MediaUrl0: "https://x/0",
      MediaContentType0: "image/gif",
      // MediaUrl1 intentionally missing
      MediaContentType1: "image/png",
    });
    assert.deepEqual(refs, [{ url: "https://x/0", contentType: "image/gif" }]);
  });

  it("clamps a bogus NumMedia to the 10-media ceiling and ignores non-numeric", () => {
    const many: Record<string, string> = { NumMedia: "99" };
    for (let i = 0; i < 99; i++) many[`MediaUrl${i}`] = `https://x/${i}`;
    assert.equal(parseInboundMediaRefs(many).length, 10);
    assert.deepEqual(parseInboundMediaRefs({ NumMedia: "notanumber", MediaUrl0: "https://x/0" }), []);
  });
});

describe("extForContentType", () => {
  it("maps common image types to friendly extensions", () => {
    assert.equal(extForContentType("image/jpeg"), "jpg");
    assert.equal(extForContentType("image/png"), "png");
    assert.equal(extForContentType("image/gif"), "gif");
    assert.equal(extForContentType("image/webp"), "webp");
  });

  it("falls back to the subtype, then bin", () => {
    assert.equal(extForContentType("application/pdf"), "pdf");
    assert.equal(extForContentType("weird"), "bin");
  });
});
