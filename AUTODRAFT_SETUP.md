# Auto-Draft Subscription Setup

What you need to do **once** in the Stripe Dashboard for the client-facing
auto-draft flow to work end-to-end with our branded emails.

---

## 1. Subscribe webhook to subscription events

**Stripe Dashboard → Developers → Webhooks → your `nunezdev.com/api/stripe/webhook` endpoint → "Events to send"**

Make sure these events are checked (some are likely already on):

**Subscription lifecycle (Phase 1 mirror)**
- [ ] `customer.subscription.created`
- [ ] `customer.subscription.updated`
- [ ] `customer.subscription.deleted`
- [ ] `customer.subscription.paused`
- [ ] `customer.subscription.resumed`

**Subscription schedule lifecycle (Phase 1.5 mirror)**
- [ ] `subscription_schedule.created`
- [ ] `subscription_schedule.updated`
- [ ] `subscription_schedule.released` ← critical for Blake's June 1 release
- [ ] `subscription_schedule.canceled`
- [ ] `subscription_schedule.completed`
- [ ] `subscription_schedule.expiring`

**Subscription invoices (Phase 5 branded receipts)**
- [ ] `invoice.paid`
- [ ] `invoice.payment_failed`
- [ ] `invoice.payment_succeeded` (deprecated but Stripe still sends it; safe to skip if you'd rather)

> **Sanity check:** after saving, send a test event from the dashboard ("Send test webhook") for each subscription event type and confirm it 200s.

---

## 2. Disable Stripe's customer emails (so clients don't get duplicates)

We send our own branded emails for every subscription event. If Stripe's defaults are also on, the client gets two of everything.

**Stripe Dashboard → Settings → Customer emails**

Toggle **OFF** these (we handle them):
- [ ] Successful payments
- [ ] Refunds *(optional — keep on if you want Stripe-branded refund receipts; we don't send those yet)*
- [ ] Invoices ← keep this OFF: we send our own
- [ ] Failed payments

Toggle **ON** (Stripe handles these well; we don't):
- [x] Card expiring soon *(Stripe will email the client when their card is about to expire)*

> Result: Stripe stops emailing the client for our subscription invoices, but still nudges them about expiring cards.

---

## 3. Confirm Smart Retries are enabled

**Stripe Dashboard → Settings → Billing → Revenue recovery → Retries**

- [ ] "Smart Retries" toggle is **on**
- Recommended config: **8 attempts within 2 weeks**
- "After the final payment attempt, what should happen?" → **Cancel subscription** (this triggers our `customer.subscription.deleted` → branded "canceled due to unpaid" email)

---

## 4. Configure Customer Portal

**Stripe Dashboard → Settings → Billing → Customer portal**

- [ ] Click **Activate test link** (if not already)
- Under **Functionality**:
  - [x] Allow customers to update payment methods *(the only one we strictly need)*
  - [x] Allow customers to view invoices
  - [ ] Allow customers to cancel subscriptions *(optional — turn on if you want client self-serve cancel)*
  - [ ] Allow customers to switch products *(skip — admin-only)*

Without this configured, the "Update payment method" link in our branded failed-payment emails won't work (`billing_portal_configuration_not_set` error).

---

## 5. Env var for the signed billing-portal links

The 14-day HMAC-signed portal permalinks (used in failed-payment emails) need a secret. The code falls back through these in order:

1. `BILLING_PORTAL_LINK_SECRET` (preferred; dedicated to this purpose)
2. `NEXTAUTH_SECRET` (existing app secret)
3. `CRON_SECRET` (existing cron secret)

If one of these is already set in Vercel, you're good. To use a dedicated secret:

```
# Vercel → Settings → Environment Variables → Add
BILLING_PORTAL_LINK_SECRET = <generate with: openssl rand -hex 32>
```

Then redeploy.

---

## Twilio SMS (Send via Text button on invoices + Combine modal)

Required env vars in Vercel:

**Option A — Auth Token (simpler):**
```
TWILIO_ACCOUNT_SID    = AC...
TWILIO_AUTH_TOKEN     = your_auth_token
TWILIO_PHONE_NUMBER   = +14055551234   (your Twilio "from" number, E.164)
```

**Option B — API Key (recommended for production, rotatable):**
```
TWILIO_ACCOUNT_SID      = AC...
TWILIO_API_KEY_SID      = SK...
TWILIO_API_KEY_SECRET   = your_api_key_secret
TWILIO_PHONE_NUMBER     = +14055551234
```

**Aliases (NunezDev short names — also work):**
```
TWILIO_SID             ≡ TWILIO_ACCOUNT_SID
TWILIO_CLIENT_SECRET   ≡ TWILIO_AUTH_TOKEN
```

If both auth styles are set, API Key is used.

### Built-in safety limits

- US numbers only (E.164 +1XXXXXXXXXX); other formats rejected.
- Message must include the invoice link (prevents misuse as a generic SMS gateway).
- Max 800 characters per message (5 Twilio segments).
- Max 5 sends per invoice per hour (prevents accidental loops).
- Max 50 SMS per org per 24h (catches runaway scripts / compromised sessions).
- 60-second dedupe per (invoice, phone) — accidental double-clicks don't double-send.
- Every send is recorded in `client_activity_log` with `activity_type='invoice_sms_sent'` for audit.

### Where to use it

Invoice detail page → "Send via Text" button next to "Resend Invoice". Pre-fills the
client's phone on file (if present) and a default message with the invoice link;
both editable before sending.

---

## 6. Product tags (for the CRM "+ New Subscription" picker)

Per `STRIPE_PRODUCT_TAG` env var (default: `nunezdev`). For each product you want to appear in the CRM subscription picker:

**Stripe Dashboard → Products → click product → Metadata → +Add**
- Key: `app`
- Value: `nunezdev`
- Save

---

## End-to-end test plan

After the above is configured:

### Test 1 — Client enrolls in auto-draft
1. Create a test client with a real email
2. Set up a monthly `recurring_invoice` for $1
3. Trigger the cron (`POST /api/recurring-invoices/process` with cron secret) → client gets the invoice email with "Set Up Auto-Pay" button
4. Click the button → Stripe Checkout opens with $1/month subscription
5. Enter test card `4242 4242 4242 4242` → complete
6. **Expected within ~5 seconds:**
   - Client receives "Auto-pay confirmed" branded email
   - Client receives "Payment received — $1.00" branded receipt
   - `client_subscriptions` table has the new sub
   - `recurring_invoices` row has `stripe_subscription_id` populated
   - Future cron runs skip this row

### Test 2 — Failed payment + recovery
1. Use Stripe test card `4000 0000 0000 0341` (charge succeeds, then fails on next attempt)
2. Wait for the next billing cycle (or fast-forward via Stripe Dashboard)
3. **Expected:**
   - Branded "Payment declined" email arrives with attempt count, next retry date, "Update payment method" button
   - Click button → 302 to a fresh Stripe Customer Portal session
   - Updating the card → Stripe retries successfully → branded receipt arrives

### Test 3 — Final cancellation after exhausted retries
1. Use `4000 0000 0000 9995` (always declines, even on retries)
2. Wait for Smart Retries to exhaust (or admin-cancel)
3. **Expected:**
   - Branded "Subscription canceled — couldn't process payment" email
   - `client_subscriptions.status` = `canceled`

### Test 4 — Idempotency
1. In Stripe Dashboard → Events → find an `invoice.paid` event → click "Resend webhook" three times
2. **Expected:** Client gets exactly ONE receipt email. `subscription_email_log` shows one row with `status='sent'`.

---

## Operational reference

| Question | Where to look |
|---|---|
| Who's enrolled in auto-draft? | `select * from client_subscriptions where status='active'` |
| Did the branded email actually send? | `select * from subscription_email_log order by sent_at desc limit 20` (look for `status='sent'` vs `'failed'`) |
| Subscription mirror state | `select * from client_subscriptions where stripe_subscription_id = 'sub_xxx'` |
| Pending schedules | `select * from client_subscription_schedules where status='not_started'` |
| MRR | `GET /api/dashboard/mrr` (returns normalized monthly cents) |

If something looks off, the webhook logs in Vercel (`/api/stripe/webhook`) are tagged `[stripe-webhook]` and `[subscription-email]`.
