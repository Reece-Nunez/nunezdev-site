import { supabaseAdmin } from './supabaseAdmin';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface Lead {
  id: string;
  email: string;
  name: string;
  phone?: string;
  company?: string;
  source: 'contact_form' | 'appointment' | 'manual';
  tags: string[];
  status: 'new' | 'nurturing' | 'qualified' | 'converted' | 'lost';
  last_contact: string;
  next_followup: string;
  created_at: string;
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

    return lead.id;
  }

  // Create lead from contact form
  async createLeadFromContact(contactData: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    message: string;
  }): Promise<string> {
    const tags = await this.classifyLead(contactData.message, 'contact_form');

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
        last_contact: new Date().toISOString(),
        next_followup: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 hours
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating lead:', error);
      throw error;
    }

    // Trigger nurture sequence
    await this.triggerEmailSequence(lead.id, 'lead_created');

    return lead.id;
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
            subject: "Case study: How we helped [similar business] grow 40%",
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

    for (const scheduledEmail of scheduledEmails) {
      try {
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
        console.error('Error sending scheduled email:', error);

        // Mark as failed
        await this.supabase
          .from('scheduled_emails')
          .update({
            status: 'failed',
            error_message: error.message
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
      `
    };

    return templates[templateName] || `<p>Hi ${lead.name}, thanks for your interest!</p>`;
  }
}

export const leadNurtureService = new LeadNurtureService();