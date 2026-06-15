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

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
