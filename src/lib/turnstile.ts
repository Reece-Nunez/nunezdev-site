// Server-side Cloudflare Turnstile verification.
//
// Behavior:
// - If TURNSTILE_SECRET_KEY env var is unset, verification is SKIPPED (returns true).
//   This lets the app run locally / in dev without setting up Turnstile.
//   In production set both NEXT_PUBLIC_TURNSTILE_SITE_KEY (client) and
//   TURNSTILE_SECRET_KEY (server) — see .env.example.
// - If the env var IS set, a missing/invalid token returns false (caller
//   should respond 400 / "spam protection failed").
//
// Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // Not configured — allow the request through. Logs once so dev sees it.
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[turnstile] TURNSTILE_SECRET_KEY is not set in production — spam protection is disabled."
      );
    }
    return { ok: true };
  }

  if (!token) return { ok: false, reason: "missing-token" };

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);

    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      }
    );

    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success) return { ok: true };

    const codes = data["error-codes"]?.join(",") ?? "unknown";
    return { ok: false, reason: `turnstile-${codes}` };
  } catch (err) {
    return {
      ok: false,
      reason: `turnstile-network-${err instanceof Error ? err.message : "unknown"}`,
    };
  }
}
