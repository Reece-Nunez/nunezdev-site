import { supabaseAdmin } from './supabaseAdmin';
import { Resend } from 'resend';
import { enrollLeadInSmsSequence, autoEnrollSkipReason } from './leadSmsSequence';

const resend = new Resend(process.env.RESEND_API_KEY);

interface Lead {
  id: string;
  email: string;
  name: string;
  phone?: string;
  company?: string;
  source: 'contact_form' | 'appointment' | 'manual';
  tags: string[];
  status: 'new' | 'contacted' | 'nurturing' | 'qualified' | 'converted' | 'lost';
  last_contact: string;
  next_followup: string;
  created_at: string;
  // Qualifying fields captured by the public lead forms.
  message?: string;
  project_type?: string;
  budget?: string;
  timeline?: string;
  lead_source?: string;
  client_id?: string | null;
}

interface EmailSequence {
  id: string;
  name: string;
  trigger: 'lead_created' | 'appointment_completed' | 'proposal_sent';
  emails: {
    delay_days: number;
    subject: string;
    template: string;
    conditions?: string[];
  }[];
}

export class LeadNurtureService {
  private supabase = supabaseAdmin();

  // Automatically tag and classify leads
  async classifyLead(message: string, source: string): Promise<string[]> {
    const tags: string[] = [];

    const keywords = {
      'web-design': ['website', 'web design', 'site', 'redesign', 'landing page'],
      'seo': ['seo', 'search engine', 'google ranking', 'visibility', 'traffic'],
      'maintenance': ['maintenance', 'updates', 'support', 'hosting', 'backup'],
      'ecommerce': ['shop', 'store', 'ecommerce', 'online sales', 'cart'],
      'automation': ['automation', 'workflow', 'crm', 'integration'],
      'startup': ['startup', 'new business', 'launching', 'mvp'],
      'enterprise': ['enterprise', 'large', 'corporation', '100+', 'team']
    };

    const lowerMessage = message.toLowerCase();

    for (const [tag, words] of Object.entries(keywords)) {
      if (words.some(word => lowerMessage.includes(word))) {
        tags.push(tag);
      }
    }

    // Add source tag
    tags.push(source);

    return tags.length > 0 ? tags : ['general'];
  }

  // Create lead from appointment booking
  async createLeadFromAppointment(appointmentData: any): Promise<string> {
    const tags = await this.classifyLead(
      appointmentData.project_details || '',
      'appointment'
    );

    const { data: lead, error } = await this.supabase
      .from('leads')
      .insert({
        email: appointmentData.client_email,
        name: appointmentData.client_name,
        phone: appointmentData.client_phone,
        company: appointmentData.company_name,
        source: 'appointment',
        tags,
        status: 'qualified', // Appointment bookings are pre-qualified
        last_contact: new Date().toISOString(),
        next_followup: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 1 day
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating lead:', error);
      throw error;
    }

    // Trigger welcome sequence
    await this.triggerEmailSequence(lead.id, 'appointment_completed');

    // Auto-enroll into the SMS cadence too. Appointment leads are inserted as
    // 'qualified', which the cadence treats as a terminal (stop) status, so this
    // is a deliberate no-op today — wired for consistency and to cover any future
    // appointment path that lands a lead in a non-terminal status.
    await this.enrollInSmsSequence(lead.id, tags);

    return lead.id;
  }

  // Create lead from contact form
  async createLeadFromContact(contactData: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    message: string;
    projectType?: string;
    budget?: string;
    timeline?: string;
    leadSource?: string;
    smsConsent?: boolean;
    smsMarketingConsent?: boolean;
    smsConsentIp?: string;
    // Quarantine flag from the geo screen (see lib/leadGeo). When set, the lead
    // is still stored for review but tagged 'offshore' and kept out of the
    // nurture sequence — the caller also skips notifications + the Ads event.
    lowQuality?: boolean;
  }): Promise<string> {
    const tags = await this.classifyLead(contactData.message, 'contact_form');
    if (contactData.lowQuality) tags.push('offshore');

    const { data: lead, error } = await this.supabase
      .from('leads')
      .insert({
        email: contactData.email,
        name: contactData.name,
        phone: contactData.phone,
        company: contactData.company,
        source: 'contact_form',
        tags,
        status: 'new',
        message: contactData.message,
        project_type: contactData.projectType,
        budget: contactData.budget,
        timeline: contactData.timeline,
        lead_source: contactData.leadSource,
        sms_consent: contactData.smsConsent ?? false,
        sms_consent_at: contactData.smsConsent ? new Date().toISOString() : null,
        sms_consent_ip: contactData.smsConsent ? contactData.smsConsentIp ?? null : null,
        sms_consent_source: contactData.smsConsent ? contactData.leadSource ?? null : null,
        sms_marketing_consent: contactData.smsMarketingConsent ?? false,
        sms_marketing_consent_at: contactData.smsMarketingConsent ? new Date().toISOString() : null,
        sms_marketing_consent_ip: contactData.smsMarketingConsent ? contactData.smsConsentIp ?? null : null,
        sms_marketing_consent_source: contactData.smsMarketingConsent ? contactData.leadSource ?? null : null,
        last_contact: new Date().toISOString(),
        next_followup: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 hours
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating lead:', error);
      throw error;
    }

    // Trigger nurture sequence — but never for quarantined offshore leads: we
    // don't want an automated email drip chasing a junk inquiry.
    if (!contactData.lowQuality) {
      await this.triggerEmailSequence(lead.id, 'lead_created');
    }

    // Auto-enroll into the SMS follow-up cadence (replaces the manual "Start
    // follow-ups" click as the default). The offshore gate lives in
    // enrollInSmsSequence via autoEnrollSkipReason.
    await this.enrollInSmsSequence(lead.id, tags, contactData.lowQuality);

    return lead.id;
  }

  /**
   * Auto-enroll a freshly created lead into the SMS follow-up cadence.
   * Never throws — a lead insert must not fail because SMS scheduling hiccuped,
   * and skipping is normal (offshore, no phone, opted out, terminal status).
   * The heavy guards live in enrollLeadInSmsSequence; the offshore gate is the
   * one we enforce here, before touching the DB.
   */
  private async enrollInSmsSequence(
    leadId: string,
    tags: string[],
    lowQuality?: boolean,
  ): Promise<void> {
    const skip = autoEnrollSkipReason({ tags, lowQuality });
    if (skip) {
      console.log(`[leadNurture] SMS auto-enroll skipped for ${leadId}: ${skip}`);
      return;
    }
    try {
      const result = await enrollLeadInSmsSequence(leadId);
      // 'already_enrolled' is an expected no-op; anything else non-zero-with-
      // reason is worth a breadcrumb (e.g. no_phone) but not an error.
      if (result.scheduled === 0 && result.reason && result.reason !== 'already_enrolled') {
        console.log(`[leadNurture] SMS auto-enroll no-op for ${leadId}: ${result.reason}`);
      }
    } catch (err) {
      console.error(`[leadNurture] SMS auto-enroll failed for ${leadId}:`, err);
    }
  }

  // Trigger email sequence
  async triggerEmailSequence(leadId: string, trigger: EmailSequence['trigger']): Promise<void> {
    const sequences = await this.getEmailSequences(trigger);

    for (const sequence of sequences) {
      for (const email of sequence.emails) {
        await this.scheduleEmail(leadId, email, email.delay_days);
      }
    }
  }

  // Schedule individual email
  private async scheduleEmail(
    leadId: string,
    emailConfig: EmailSequence['emails'][0],
    delayDays: number
  ): Promise<void> {
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + delayDays);

    await this.supabase
      .from('scheduled_emails')
      .insert({
        lead_id: leadId,
        subject: emailConfig.subject,
        template: emailConfig.template,
        scheduled_for: scheduledFor.toISOString(),
        status: 'pending'
      });
  }

  // Get email sequences by trigger
  private async getEmailSequences(trigger: string): Promise<EmailSequence[]> {
    // For now, return hardcoded sequences
    // Later you can move these to database
    const sequences: EmailSequence[] = [
      {
        id: 'lead_nurture_sequence',
        name: 'Lead Nurture Sequence',
        trigger: 'lead_created',
        emails: [
          {
            delay_days: 0,
            subject: "Thanks for reaching out! Let's discuss your project",
            template: 'lead_welcome'
          },
          {
            delay_days: 3,
            subject: "3 questions that will save you thousands on your website",
            template: 'lead_education_1'
          },
          {
            delay_days: 7,
            subject: "A quick example of what a focused website can do",
            template: 'lead_case_study'
          },
          {
            delay_days: 14,
            subject: "Ready to start your project? Let's schedule a call",
            template: 'lead_call_to_action'
          }
        ]
      },
      {
        id: 'appointment_followup',
        name: 'Post-Appointment Follow-up',
        trigger: 'appointment_completed',
        emails: [
          {
            delay_days: 1,
            subject: "Thanks for our conversation - next steps inside",
            template: 'appointment_followup'
          },
          {
            delay_days: 7,
            subject: "Your custom proposal is ready",
            template: 'proposal_ready'
          }
        ]
      }
    ];

    return sequences.filter(seq => seq.trigger === trigger);
  }

  // Process scheduled emails (called by cron job)
  async processScheduledEmails(): Promise<void> {
    const { data: scheduledEmails } = await this.supabase
      .from('scheduled_emails')
      .select(`
        *,
        leads (*)
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .limit(10);

    if (!scheduledEmails) return;

    // Don't blast emails that are way overdue. If the cron was off for a while
    // (or is first enabled against an old queue), a 3-week-late "welcome" email
    // is worse than none. Anything more than 3 days past its slot is skipped.
    const staleCutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    for (const scheduledEmail of scheduledEmails) {
      try {
        if (scheduledEmail.scheduled_for < staleCutoff) {
          await this.supabase
            .from('scheduled_emails')
            .update({ status: 'failed', error_message: 'skipped: scheduled too far in the past' })
            .eq('id', scheduledEmail.id);
          continue;
        }

        await this.sendScheduledEmail(scheduledEmail);

        // Mark as sent
        await this.supabase
          .from('scheduled_emails')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', scheduledEmail.id);

      } catch (error) {
        console.error('Error sending scheduled email:', (error as any).message);

        // Mark as failed
        await this.supabase
          .from('scheduled_emails')
          .update({
            status: 'failed',
            error_message: (error as any).message
          })
          .eq('id', scheduledEmail.id);
      }
    }
  }

  private async sendScheduledEmail(scheduledEmail: any): Promise<void> {
    const lead = scheduledEmail.leads;
    const emailContent = this.getEmailTemplate(scheduledEmail.template, lead);

    await resend.emails.send({
      from: 'Reece at NunezDev <reece@nunezdev.com>',
      to: [lead.email],
      subject: scheduledEmail.subject.replace('[NAME]', lead.name),
      html: emailContent
    });

    // Update lead's last contact
    await this.supabase
      .from('leads')
      .update({ last_contact: new Date().toISOString() })
      .eq('id', lead.id);
  }

  private getEmailTemplate(templateName: string, lead: any): string {
    const templates = {
      lead_welcome: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hi ${lead.name}!</h2>
          <p>Thanks for reaching out about your project. I'm excited to learn more about your business goals.</p>
          <p>I've helped dozens of ${lead.tags?.includes('startup') ? 'startups' : 'businesses'} like yours create professional websites that actually drive results.</p>
          <p>I'll be following up with some helpful resources over the next few days, but if you want to jump right into discussing your project, feel free to <a href="https://nunezdev.com/book">schedule a free consultation</a>.</p>
          <p>Best regards,<br>Reece Nunez<br>NunezDev</p>
        </div>
      `,
      lead_education_1: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>3 Questions That Will Save You Thousands</h2>
          <p>Hi ${lead.name},</p>
          <p>Before you invest in a new website, ask yourself these 3 critical questions:</p>
          <ol>
            <li><strong>Who is your exact target customer?</strong> (Not "everyone")</li>
            <li><strong>What specific action do you want visitors to take?</strong> (Buy, call, subscribe?)</li>
            <li><strong>How will you measure success?</strong> (Traffic, leads, sales?)</li>
          </ol>
          <p>Most businesses skip this step and end up with a pretty website that doesn't generate results.</p>
          <p>Want help answering these questions for your business? <a href="https://nunezdev.com/book">Let's chat</a>.</p>
          <p>Reece</p>
        </div>
      `,
      appointment_followup: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Great meeting you, ${lead.name}!</h2>
          <p>Thanks for taking the time to discuss your ${lead.tags?.includes('web-design') ? 'website' : 'project'} with me today.</p>
          <p>Here's what happens next:</p>
          <ul>
            <li>I'll put together a custom proposal based on our conversation</li>
            <li>You'll receive it within 2-3 business days</li>
            <li>We'll schedule a follow-up call to review everything</li>
          </ul>
          <p>If you have any questions in the meantime, just reply to this email.</p>
          <p>Looking forward to working together!</p>
          <p>Reece</p>
        </div>
      `,
      lead_case_study: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hi ${lead.name},</h2>
          <p>Quick one. A lot of the businesses I work with come to me with a site that looks fine but does not bring in any actual leads.</p>
          <p>One recent client was getting plenty of visitors but almost no calls. We rebuilt the site around one clear action, cleaned up how it loads on phones, and set up local SEO so the right people could find it. Within a couple of months the calls and form submissions went up noticeably.</p>
          <p>Nothing flashy. Just a site built to do a job. If you want, I can take a look at yours and tell you honestly what I would change.</p>
          <p><a href="https://www.nunezdev.com/contact">Reach out here</a> or just reply to this email.</p>
          <p>Reece</p>
        </div>
      `,
      lead_call_to_action: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hi ${lead.name},</h2>
          <p>I wanted to check back in. If your project is still on your mind, I would love to help you get it moving.</p>
          <p>No pressure and no hard sell. We can hop on a quick call, you tell me what you are after, and I will give you honest thoughts plus a rough scope and price. If it is a fit, great. If not, you will still walk away with a clearer plan.</p>
          <p><a href="https://www.nunezdev.com/contact">Grab a time here</a> or reply and tell me what you are working on.</p>
          <p>Reece<br>NunezDev</p>
        </div>
      `,
      proposal_ready: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hi ${lead.name},</h2>
          <p>Your proposal is ready. I put together a scope and pricing based on what we talked about, with clear phases so you know exactly what you are getting and when.</p>
          <p>Take a look when you have a minute. If anything looks off or you want to adjust the scope, just reply and we will sort it out.</p>
          <p><a href="https://www.nunezdev.com/contact">Questions? Reach me here</a> or reply to this email.</p>
          <p>Reece<br>NunezDev</p>
        </div>
      `
    };

    return (templates as any)[templateName] || `<p>Hi ${lead.name}, thanks for your interest!</p>`;
  }
}

export const leadNurtureService = new LeadNurtureService();