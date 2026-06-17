/**
 * One-time helper to mint a Google Ads API refresh token.
 *
 * The Ads API authenticates as a *user* (not a service account), so you need a
 * long-lived refresh token for the Google account that can see your Ads data.
 * Run this once; a browser opens, you grant access, and it prints the refresh
 * token to paste into GOOGLE_ADS_REFRESH_TOKEN.
 *
 * Uses the modern loopback (localhost) redirect flow — Google deprecated the
 * old out-of-band "paste the code" flow. The script starts a throwaway local
 * server, Google redirects back to it with the code, and we exchange it.
 *
 * Prereqs:
 *   1. A Google Cloud project with the Google Ads API enabled.
 *   2. An OAuth client (Web application OR Desktop app) — its id + secret in
 *      .env.local as GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET.
 *   3. For a *Web* client, add this exact redirect URI to it and Save:
 *         http://localhost:4280/oauth2callback
 *      (Desktop clients allow localhost automatically — no registration.)
 *
 * Run:
 *   node scripts/google-ads-oauth.mjs
 *
 * Port can be overridden with GOOGLE_ADS_OAUTH_PORT (must match the redirect
 * URI you registered). No new dependencies — googleapis + @next/env are
 * already installed.
 */
import { google } from "googleapis";
import http from "node:http";
import { spawn } from "node:child_process";

// Load .env.local (and .env) the same way Next.js does, so the client id/secret
// you already put in .env.local are picked up without exporting them.
try {
  // @next/env is CJS — its named exports live under `.default` when imported
  // from an ES module.
  const nextEnv = await import("@next/env");
  const loadEnvConfig = nextEnv.loadEnvConfig ?? nextEnv.default?.loadEnvConfig;
  loadEnvConfig?.(process.cwd());
} catch {
  // @next/env not resolvable — fall back to whatever is already in the shell env.
}

const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error(
    "Missing GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET.\n" +
      "Fill them into .env.local (this script reads it automatically), then re-run.",
  );
  process.exit(1);
}

const PORT = Number(process.env.GOOGLE_ADS_OAUTH_PORT) || 4280;
const REDIRECT = `http://localhost:${PORT}/oauth2callback`;
const SCOPES = ["https://www.googleapis.com/auth/adwords"];

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT);

const authUrl = oauth2.generateAuthUrl({
  access_type: "offline", // required to get a refresh_token
  prompt: "consent", // force a refresh_token even on re-auth
  scope: SCOPES,
});

function openBrowser(url) {
  try {
    if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true }).unref();
    } else if (process.platform === "darwin") {
      spawn("open", [url], { stdio: "ignore", detached: true }).unref();
    } else {
      spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
    }
  } catch {
    // best-effort — the URL is printed below regardless
  }
}

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.url.startsWith("/oauth2callback")) {
    res.writeHead(404);
    res.end();
    return;
  }

  const url = new URL(req.url, REDIRECT);
  const err = url.searchParams.get("error");
  const code = url.searchParams.get("code");

  if (err) {
    res.writeHead(400, { "content-type": "text/plain" });
    res.end(`Authorization failed: ${err}. You can close this tab.`);
    console.error(`\nAuthorization failed: ${err}`);
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400);
    res.end("No code in callback.");
    return;
  }

  try {
    const { tokens } = await oauth2.getToken(code);
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("Success! Refresh token retrieved. You can close this tab and return to the terminal.");

    if (!tokens.refresh_token) {
      console.error(
        "\nNo refresh_token returned. Revoke this app at " +
          "https://myaccount.google.com/permissions and re-run " +
          "(Google only returns a refresh_token on first consent).",
      );
      server.close();
      process.exit(1);
    }

    console.log("\n✅ Success. Add this to .env.local (and Vercel):\n");
    console.log(`GOOGLE_ADS_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    server.close();
    process.exit(0);
  } catch (e) {
    res.writeHead(500);
    res.end("Token exchange failed — check the terminal.");
    console.error("\nToken exchange failed:", e?.message ?? e);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`\nListening on ${REDIRECT}`);
  console.log("\nOpening your browser to grant access. If it doesn't open, visit:\n");
  console.log(authUrl + "\n");
  openBrowser(authUrl);
});
