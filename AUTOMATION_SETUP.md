# NunezDev Automation System Setup Guide

## 🎯 Overview

This system provides automated workflows for your business without requiring third-party tools like Zapier or Notion. Everything is built into your Next.js application.

## 🚀 Implemented Automations

### 1. Lead Nurturing System
**Location**: `/src/lib/leadNurturing.ts`

**What it does**:
- Automatically captures leads from appointment bookings and contact forms
- Classifies leads by project type (web-design, SEO, maintenance, etc.)
- Sends automated email sequences based on lead source
- Tracks engagement and schedules follow-ups

**Email Sequences**:
- **Contact Form**: Welcome → Education → Case Study → Call to Action (0, 3, 7, 14 days)
- **Appointment**: Thank you → Next Steps → Proposal Ready (1, 7 days)

### 2. Invoice Follow-up System
**Location**: `/src/lib/invoiceFollowup.ts`

**What it does**:
- Monitors overdue invoices automatically
- Sends escalating reminder emails (gentle → firm → final → account hold)
- Tracks payment status and stops reminders when paid
- Alerts you for final notices requiring personal attention

**Follow-up Schedule**:
- **Day 1**: Gentle reminder
- **Day 7**: Second notice
- **Day 14**: Final notice
- **Day 30**: Account hold warning

### 3. Client Onboarding System
**Location**: `/src/lib/clientOnboarding.ts`

**What it does**:
- Creates custom onboarding checklists when clients sign contracts
- Sends welcome emails with action items for clients
- Tracks project progress and sends milestone updates
- Manages task dependencies and automates next-step notifications

**Templates**:
- **Website Design**: 15-step comprehensive onboarding
- **Maintenance Plans**: 5-step streamlined setup

## 🛠 Setup Instructions

### Step 1: Database Setup

Run the migration files to create the required tables:

```sql
-- Run these in your Supabase SQL editor
-- 1. Lead nurturing tables
\i database/migrations/create_lead_nurturing_tables.sql

-- 2. Invoice follow-up table
\i database/migrations/create_invoice_followup_table.sql

-- 3. Onboarding tables
\i database/migrations/create_onboarding_tables.sql
```

### Step 2: Environment Variables

Add to your `.env.local`:

```bash
# Existing variables (keep these)
RESEND_API_KEY=your_resend_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# New automation variables
CRON_SECRET=your_random_secret_for_cron_auth
```

### Step 3: Cron Job Setup

Set up cron jobs to run the automated processes. You have several options:

#### Option A: Vercel Cron Jobs (Recommended)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/process-email-sequences",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/process-invoice-followups",
      "schedule": "0 8 * * *"
    }
  ]
}
```

#### Option B: External Cron Service (cron-job.org, EasyCron, etc.)

Create scheduled requests to:
- `POST https://yoursite.com/api/cron/process-email-sequences`
- `POST https://yoursite.com/api/cron/process-invoice-followups`

Add header: `Authorization: Bearer your_cron_secret`

#### Option C: GitHub Actions (Free)

Create `.github/workflows/automation.yml`:

```yaml
name: Run Automations
on:
  schedule:
    - cron: '0 9 * * *'  # 9 AM daily
    - cron: '0 8 * * *'  # 8 AM daily
  workflow_dispatch:

jobs:
  run-automations:
    runs-on: ubuntu-latest
    steps:
      - name: Email Sequences
        run: |
          curl -X POST "${{ secrets.SITE_URL }}/api/cron/process-email-sequences" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"

      - name: Invoice Follow-ups
        run: |
          curl -X POST "${{ secrets.SITE_URL }}/api/cron/process-invoice-followups" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

### Step 4: Integration Points

#### Existing Appointment System
✅ **Already integrated** - Leads are automatically created when appointments are booked.

#### Contact Form Integration
Add to your existing contact form handler:

```typescript
import { leadNurtureService } from '@/lib/leadNurturing';

// After processing contact form
await leadNurtureService.createLeadFromContact({
  name: formData.name,
  email: formData.email,
  phone: formData.phone,
  company: formData.company,
  message: formData.message
});
```

#### Contract Signing Integration
Add to your contract signing webhook:

```typescript
import { clientOnboardingService } from '@/lib/clientOnboarding';

// When contract is signed
await clientOnboardingService.createOnboardingProject(
  clientId,
  'web-design', // or 'maintenance'
  customRequirements
);
```

## 🧪 Testing

### Test Email Sequences
```bash
curl -X GET "http://localhost:3000/api/cron/process-email-sequences"
```

### Test Invoice Follow-ups
```bash
curl -X GET "http://localhost:3000/api/cron/process-invoice-followups"
```

### Test Lead Creation
```bash
curl -X POST "http://localhost:3000/api/contact" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","message":"I need a website"}'
```

## 📊 Admin Endpoints

### View Leads
```
GET /api/admin/leads?status=new&source=contact_form&limit=50
```

### View Onboarding Projects
```
GET /api/onboarding?projectId=uuid
```

### Send Manual Follow-up
```
POST /api/admin/invoice-followup
{
  "invoiceId": "uuid",
  "message": "Custom message"
}
```

## 🔄 Next Steps for Full Automation

### Phase 2: Add These Later with Zapier
- **Social media posting**: Auto-post case studies to LinkedIn
- **CRM integrations**: Sync with HubSpot/Salesforce
- **Calendar integrations**: Auto-create project milestones
- **Slack notifications**: Alert team of new leads/overdue invoices

### Phase 3: Advanced Features
- **AI lead scoring**: Prioritize leads automatically
- **Dynamic email content**: Personalize based on industry
- **A/B test sequences**: Optimize email performance
- **SMS notifications**: Critical invoice reminders

## 🛡 Monitoring

### Logs to Watch
- Lead creation: Check `leadNurtureService` logs
- Email delivery: Monitor Resend dashboard
- Invoice processing: Review `invoiceFollowupService` output

### Key Metrics
- Lead conversion rate by source
- Email open/click rates
- Invoice payment time after reminders
- Onboarding completion time

## 🚨 Troubleshooting

### Common Issues
1. **Emails not sending**: Check Resend API key and domain verification
2. **Cron jobs not running**: Verify cron secret and endpoint URLs
3. **Database errors**: Ensure all migration scripts ran successfully
4. **TypeScript errors**: Run `npm run build` to check for issues

### Debug Mode
Set `NODE_ENV=development` to see detailed logging in API endpoints.

## 💰 Cost Comparison

**Built-in System (Current)**:
- Database: Free (Supabase free tier)
- Emails: $20/month (Resend)
- Cron: Free (Vercel/GitHub Actions)
- **Total**: ~$20/month

**Third-party Alternative**:
- Zapier Pro: $20/month
- Notion: $10/month
- Additional email service: $15/month
- **Total**: ~$45/month

**Savings**: $25/month ($300/year) + full control over your data

---

## ✨ Ready to Launch!

Your automation system is now set up and ready to:
1. **Capture and nurture leads** automatically
2. **Follow up on overdue invoices** without manual work
3. **Onboard new clients** with professional workflows
4. **Save you hours** each week on repetitive tasks

The system will grow with your business and can be customized as needed!