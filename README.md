This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Two-way inbox (email + SMS)

`/dashboard/inbox` lets the owner send and receive email (Resend) and SMS
(Twilio) as threaded conversations, instead of going through Gmail.

- **Outbound** — compose/reply from the inbox; `POST /api/inbox/send` routes to
  Resend or Twilio and logs every message into the `conversations`/`messages`
  tables. Email supports image/PDF **attachments** (uploaded to S3 via a
  presigned PUT in `POST /api/inbox/upload`).
- **Inbound SMS** — the existing Twilio webhook (`/api/twilio/sms-incoming`)
  threads conversational replies into the inbox.
- **Inbound email** — `POST /api/inbox/resend-inbound` receives client replies
  via Resend Inbound and threads them. Outbound email sets
  `Reply-To: <conversation-id>@reply.nunezdev.com` so replies route back.

### Inbox env vars

| Var | Purpose |
|-----|---------|
| `RESEND_API_KEY` | Resend send + inbound-email retrieval |
| `RESEND_WEBHOOK_SECRET` | Verifies the Resend inbound webhook (Svix), `whsec_…` |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` (or `TWILIO_API_KEY_SID` + `_SECRET`) | Twilio auth |
| `TWILIO_PHONE_NUMBER` | Outbound SMS "from" number (E.164) |
| `S3_*` (`S3_REGION`, `S3_BUCKET_NAME`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`) | Attachment storage |
| `INBOX_REPLY_DOMAIN` | Optional; defaults to `reply.nunezdev.com` |

### Inbound email setup (one-time, in Resend + DNS)

1. Resend → Domains → add custom **receiving** domain `reply.nunezdev.com`.
2. Add the **MX** record Resend shows to the `nunezdev.com` Route 53 hosted
   zone, record name `reply`, priority `10` (must be the lowest MX on that
   name). The root `nunezdev.com` MX (Gmail) is untouched.
3. Resend → Webhooks → add an `email.received` webhook pointing at
   `https://www.nunezdev.com/api/inbox/resend-inbound`.
4. Set `RESEND_WEBHOOK_SECRET` (the webhook's signing secret) in Vercel.

Note: replies sent to the **From** address (`reece@nunezdev.com`) still go to
Gmail — only `Reply-To` replies (what mail clients use) come into the inbox.

## Google Ads integration

Pulls campaign + keyword performance from the Google Ads API into Supabase and
renders it at **`/dashboard/leadgen/ads`** (linked as **Ads** from the
Prospecting header). Data is cached in two tables and refreshed nightly, so the
page never calls Google on load.

- **Read path** — `getAdsOverview()` in [`src/lib/googleAdsRead.ts`](src/lib/googleAdsRead.ts)
  reads the snapshot tables and aggregates them with the pure helpers in
  `googleAdsTransform.ts` (unit-tested in `googleAdsTransform.test.ts`).
- **Write path** — `syncGoogleAds()` in [`src/lib/googleAdsSync.ts`](src/lib/googleAdsSync.ts),
  driven by the nightly cron `/api/cron/leadgen-google-ads-sync` (`0 8 * * *`,
  Bearer `CRON_SECRET`) and the owner-gated `/api/dashboard/google-ads/refresh`
  (the **Refresh** button). Both upsert idempotently over a trailing 30-day
  window, so late-attributing conversions get corrected each run.

### Database

Run the migration once against Supabase:

```
database/migrations/create_google_ads_metrics.sql
```

Creates `google_ads_campaign_metrics` + `google_ads_keyword_metrics`
(RLS fail-closed, service-role only).

### Credentials (one-time, from scratch)

The Ads API authenticates as a *user* with a developer token — not the
Workspace service account used elsewhere. Get each value, then set the
`GOOGLE_ADS_*` vars (see `.env.example`) in Vercel:

1. **Developer token** — Google Ads UI → **Tools & Settings → API Center**.
   The API Center only appears under a **Manager (MCC)** account; if you only
   have a regular Ads account, create a free Manager account and link your
   account under it. New tokens start at *Test* access (test accounts only) —
   apply for **Basic** access (short form, usually approved in ~1 business day)
   to query your live account. Querying your own accounts is free.
2. **OAuth client** — [Google Cloud console](https://console.cloud.google.com)
   → create/select a project → **Enable** the *Google Ads API* → **OAuth
   consent screen** (add yourself as a test user) → **Credentials → Create
   OAuth client ID → Desktop app**. Copy the client id + secret.
3. **Refresh token** — put the client id/secret into `.env.local`, then for a
   **Web** OAuth client add the redirect URI `http://localhost:4280/oauth2callback`
   to it and Save (Desktop clients skip this — localhost is auto-allowed). Run:

   ```
   node scripts/google-ads-oauth.mjs
   ```

   It loads `.env.local` automatically, opens your browser for consent, captures
   the code on a throwaway localhost server, and prints
   `GOOGLE_ADS_REFRESH_TOKEN=...`. (Prefer no script? Google's
   [OAuth Playground](https://developers.google.com/oauthplayground) with the
   `.../auth/adwords` scope and "Use your own OAuth credentials" works too.)
4. **Customer id** — your Ads account number (top-right of the Ads UI,
   `123-456-7890`) as digits only → `GOOGLE_ADS_CUSTOMER_ID`. If you query
   through a Manager account, also set `GOOGLE_ADS_LOGIN_CUSTOMER_ID` to the
   manager's id.

Until all five are set the dashboard shows a "not connected" state and the cron
no-ops — safe to deploy before the dev-token approval lands.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
