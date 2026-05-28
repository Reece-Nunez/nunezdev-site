/**
 * Serves files from the pipeline's output/ directory for the UI to embed
 * in iframes (proposal PDFs, mockup HTML). Owner-gated and path-traversal
 * hardened — see the resolve step below.
 *
 * URL: /api/leadgen/file/<safe_dir_name>/<filename>
 *      e.g. /api/leadgen/file/Becker Painting _ Remodeling_22/proposal.pdf
 *
 * Phase 2 will replace this with a call to the deployed pipeline's blob
 * storage. For Phase 1 the Next.js process can directly read the local
 * filesystem because it's running on the same machine as the pipeline.
 */
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/authz";
import { LEADGEN_OUTPUT_DIR } from "@/lib/leadgen-paths";
import path from "node:path";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";

export const runtime = "nodejs";
// Force dynamic so we don't accidentally cache filesystem state.
export const dynamic = "force-dynamic";

const ALLOWED_EXTENSIONS: Record<string, string> = {
  ".pdf":  "application/pdf",
  ".html": "text/html; charset=utf-8",
  ".htm":  "text/html; charset=utf-8",
  ".txt":  "text/plain; charset=utf-8",
};

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

export async function GET(_req: Request, ctx: RouteContext) {
  // Owner auth — same gate as the dashboard pages.
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { path: segments } = await ctx.params;
  if (!segments || segments.length === 0) {
    return NextResponse.json({ error: "missing path" }, { status: 400 });
  }

  // ── Path-traversal hardening ─────────────────────────────────────
  // Resolve the requested file path inside LEADGEN_OUTPUT_DIR and refuse
  // any result that, after normalization, escapes that root. Catches
  // "../../etc/passwd", "C:\\Windows\\...", and similar attempts.
  const joined = path.join(LEADGEN_OUTPUT_DIR, ...segments);
  const resolvedTarget = path.resolve(joined);
  const resolvedRoot = path.resolve(LEADGEN_OUTPUT_DIR);
  const rootWithSep = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
  if (!resolvedTarget.startsWith(rootWithSep) && resolvedTarget !== resolvedRoot) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Mime guard — refuse extensions we don't intend to serve.
  const ext = path.extname(resolvedTarget).toLowerCase();
  const contentType = ALLOWED_EXTENSIONS[ext];
  if (!contentType) {
    return NextResponse.json({ error: "unsupported file type" }, { status: 415 });
  }

  // Existence check.
  let stat;
  try {
    stat = await fs.stat(resolvedTarget);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!stat.isFile()) {
    return NextResponse.json({ error: "not a file" }, { status: 404 });
  }

  // Stream the file. PDFs especially can be a few MB so we don't want
  // to slurp them into memory.
  const nodeStream = createReadStream(resolvedTarget);
  // Convert Node Readable -> Web ReadableStream for Next's Response.
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": stat.size.toString(),
      "Cache-Control": "private, max-age=60",
      // Keeping inline so the iframe renders the PDF rather than offering
      // a download. Mockup HTML similarly renders inside the iframe.
      "Content-Disposition": "inline",
    },
  });
}
