import { supabaseAdmin } from './supabaseAdmin';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface Invoice {
  id: string;
  client_id: string;
  status: string;
  amount_cents: number;
  issued_at: string;
  due_at: string;
  stripe_invoice_id?: string;
  hosted_invoice_url?: string;
  access_token?: string;
  invoice_number?: string;
  clients: {
    name: string;
    email: string;
  };
  invoice_payments?: {
    amount_cents: number;
    paid_at: string;
  }[];
}

interface FollowUpRule {
  days_after_due: number;
  subject: string;
  template: string;
  urgency: 'gentle' | 'firm' | 'final';
}

export class InvoiceFollowupService {
  private supabase = supabaseAdmin();

  private followUpRules: FollowUpRule[] = [
    {
      days_after_due: 1,
      subject: 'Friendly reminder: Invoice [INVOICE_NUMBER] is past due',
      template: 'gentle_reminder',
      urgency: 'gentle'
    },
    {
      days_after_due: 7,
      subject: 'Second notice: Invoice [INVOICE_NUMBER] - Payment required',
      template: 'second_notice',
      urgency: 'firm'
    },
    {
      days_after_due: 14,
      subject: 'Final notice: Invoice [INVOICE_NUMBER] - Immediate action required',
      template: 'final_notice',
      urgency: 'final'
    },
    {
      days_after_due: 30,
      subject: 'Account hold: Invoice [INVOICE_NUMBER] - Service suspension notice',
      template: 'account_hold',
      urgency: 'final'
    }
  ];

  // Process overdue invoices and send follow-ups
  async processOverdueInvoices(): Promise<void> {
    try {
      console.log('Processing overdue invoices...');

      // Get overdue invoices that haven't been fully paid
      const { data: overdueInvoices, error } = await this.supabase
        .from('invoices')
        .select(`
          id, client_id, status, amount_cents, issued_at, due_at, stripe_invoice_id, hosted_invoice_url, access_token, invoice_number,
          clients(name, email),
          invoice_payments(amount_cents, paid_at)
        `)
        .eq('status', 'sent')
        .lt('due_at', new Date().toISOString())
        .order('due_at', { ascending: true });

      if (error) {
        console.error('Error fetching overdue invoices:', error);
        return;
      }

      if (!overdueInvoices || overdueInvoices.length === 0) {
        console.log('No overdue invoices found');
        return;
      }

      for (const invoice of overdueInvoices) {
        await this.processInvoiceFollowup(invoice as any);
      }

      console.log(`Processed ${overdueInvoices.length} overdue invoices`);

    } catch (error) {
      console.error('Error processing overdue invoices:', error);
    }
  }

  private async processInvoiceFollowup(invoice: Invoice): Promise<void> {
    try {
      // Calculate days overdue
      const dueDate = new Date(invoice.due_at);
      const today = new Date();
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      // Check if invoice is actually unpaid
      const totalPaid = invoice.invoice_payments?.reduce((sum, payment) => sum + payment.amount_cents, 0) || 0;
      const amountDue = invoice.amount_cents - totalPaid;

      if (amountDue <= 0) {
        // Invoice is paid, mark as paid if not already
        await this.markInvoiceAsPaid(invoice.id);
        return;
      }

      // Find applicable follow-up rules
      const applicableRules = this.followUpRules.filter(rule => daysOverdue >= rule.days_after_due);

      if (applicableRules.length === 0) {
        return; // Not overdue enough yet
      }

      // Get the most recent applicable rule
      const rule = applicableRules[applicableRules.length - 1];

      // Check if we've already sent this type of follow-up
      const { data: existingFollowup } = await this.supabase
        .from('invoice_followups')
        .select('*')
        .eq('invoice_id', invoice.id)
        .eq('followup_type', rule.urgency)
        .single();

      if (existingFollowup) {
        return; // Already sent this follow-up
      }

      // Send follow-up email
      await this.sendFollowupEmail(invoice, rule, daysOverdue, amountDue);

      // Record the follow-up
      await this.recordFollowup(invoice.id, rule, daysOverdue);

    } catch (error) {
      console.error(`Error processing follow-up for invoice ${invoice.id}:`, error);
    }
  }

  private async sendFollowupEmail(
    invoice: Invoice,
    rule: FollowUpRule,
    daysOverdue: number,
    amountDue: number
  ): Promise<void> {
    const invoiceNumber = invoice.invoice_number || invoice.stripe_invoice_id || `INV-${invoice.id.slice(-6).toUpperCase()}`;
    const client = (invoice as any).clients;
    const amountFormatted = (amountDue / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD'
    });

    // Use public invoice URL with access token instead of protected dashboard URL
    const paymentUrl = invoice.access_token
      ? `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com'}/invoice/${invoice.access_token}`
      : invoice.hosted_invoice_url;

    const subject = rule.subject.replace('[INVOICE_NUMBER]', invoiceNumber);
    const emailContent = this.getEmailTemplate(rule.template, {
      clientName: client.name,
      invoiceNumber,
      amountDue: amountFormatted,
      daysOverdue,
      dueDate: new Date(invoice.due_at).toLocaleDateString('en-US'),
      paymentUrl: paymentUrl,
      urgency: rule.urgency
    });

    await resend.emails.send({
      from: 'Reece at NunezDev <reece@nunezdev.com>',
      to: [client.email],
      subject,
      html: emailContent
    });

    // Send copy to yourself for final notices
    if (rule.urgency === 'final') {
      await resend.emails.send({
        from: 'NunezDev Billing System <reece@nunezdev.com>',
        to: ['reece@nunezdev.com'],
        subject: `URGENT: ${subject} (${daysOverdue} days overdue)`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #dc3545;">Invoice Follow-up Alert</h2>
            <p><strong>Client:</strong> ${client.name} (${client.email})</p>
            <p><strong>Invoice:</strong> ${invoiceNumber}</p>
            <p><strong>Amount Due:</strong> ${amountFormatted}</p>
            <p><strong>Days Overdue:</strong> ${daysOverdue}</p>
            <p><strong>Follow-up Type:</strong> ${rule.urgency}</p>
            <p style="color: #dc3545;">Consider personal outreach or account suspension.</p>
          </div>
        `
      });
    }

    console.log(`Sent ${rule.urgency} follow-up for invoice ${invoiceNumber} to ${client.email}`);
  }

  private async recordFollowup(
    invoiceId: string,
    rule: FollowUpRule,
    daysOverdue: number
  ): Promise<void> {
    await this.supabase
      .from('invoice_followups')
      .insert({
        invoice_id: invoiceId,
        followup_type: rule.urgency,
        days_overdue: daysOverdue,
        sent_at: new Date().toISOString()
      });
  }

  private async markInvoiceAsPaid(invoiceId: string): Promise<void> {
    await this.supabase
      .from('invoices')
      .update({ status: 'paid' })
      .eq('id', invoiceId);
  }

  private getEmailTemplate(templateName: string, data: any): string {
    const templates = {
      gentle_reminder: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Hi ${data.clientName},</h2>
          <p>I hope you're doing well! This is a friendly reminder that invoice ${data.invoiceNumber} for ${data.amountDue} was due on ${data.dueDate}.</p>
          <p>I know things can get busy, so I wanted to make sure this didn't slip through the cracks.</p>

          <div style="background-color: #f8f9fa; border-radius: 6px; padding: 20px; margin: 20px 0; text-align: center;">
            <p style="margin: 0 0 15px 0;"><strong>Amount Due: ${data.amountDue}</strong></p>
            ${data.paymentUrl ? `<a href="${data.paymentUrl}" style="display: inline-block; background-color: #ffc312; color: black; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Pay Invoice</a>` : ''}
          </div>

          <p>If you have any questions or need to discuss payment arrangements, please don't hesitate to reach out.</p>
          <p>Thanks for your business!</p>
          <p>Reece Nunez<br>NunezDev</p>
        </div>
      `,
      second_notice: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Payment Required: Invoice ${data.invoiceNumber}</h2>
          <p>Hi ${data.clientName},</p>
          <p>Invoice ${data.invoiceNumber} for ${data.amountDue} is now ${data.daysOverdue} days overdue (due date: ${data.dueDate}).</p>
          <p>To avoid any service interruptions, please submit payment as soon as possible.</p>

          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 20px; margin: 20px 0; text-align: center;">
            <p style="margin: 0 0 15px 0; color: #856404;"><strong>SECOND NOTICE</strong></p>
            <p style="margin: 0 0 15px 0;"><strong>Amount Due: ${data.amountDue}</strong></p>
            <p style="margin: 0 0 15px 0;">Days Overdue: ${data.daysOverdue}</p>
            ${data.paymentUrl ? `<a href="${data.paymentUrl}" style="display: inline-block; background-color: #ffc312; color: black; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Pay Now</a>` : ''}
          </div>

          <p>If you're experiencing any issues or need to arrange a payment plan, please contact me immediately at reece@nunezdev.com or reply to this email.</p>
          <p>Thank you for your prompt attention to this matter.</p>
          <p>Reece Nunez<br>NunezDev</p>
        </div>
      `,
      final_notice: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #dc3545;">FINAL NOTICE: Immediate Payment Required</h2>
          <p>Dear ${data.clientName},</p>
          <p>This is the final notice for invoice ${data.invoiceNumber}. Payment of ${data.amountDue} is now ${data.daysOverdue} days overdue.</p>
          <p><strong>Immediate action is required to avoid service suspension.</strong></p>

          <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; padding: 20px; margin: 20px 0; text-align: center;">
            <p style="margin: 0 0 15px 0; color: #721c24;"><strong>FINAL NOTICE</strong></p>
            <p style="margin: 0 0 15px 0;"><strong>Amount Due: ${data.amountDue}</strong></p>
            <p style="margin: 0 0 15px 0;">Days Overdue: ${data.daysOverdue}</p>
            <p style="margin: 0 0 15px 0; color: #721c24;">Services may be suspended in 48 hours</p>
            ${data.paymentUrl ? `<a href="${data.paymentUrl}" style="display: inline-block; background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Pay Immediately</a>` : ''}
          </div>

          <p>If payment is not received within 48 hours, we may need to:</p>
          <ul>
            <li>Suspend active services</li>
            <li>Turn the account over to collections</li>
            <li>Report the delinquency to credit agencies</li>
          </ul>

          <p>Please contact me immediately at reece@nunezdev.com to resolve this matter.</p>
          <p>Sincerely,<br>Reece Nunez<br>NunezDev</p>
        </div>
      `,
      account_hold: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #dc3545;">Account Hold Notice</h2>
          <p>Dear ${data.clientName},</p>
          <p>Your account has been placed on hold due to unpaid invoice ${data.invoiceNumber} (${data.amountDue}, ${data.daysOverdue} days overdue).</p>

          <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; padding: 20px; margin: 20px 0; text-align: center;">
            <p style="margin: 0 0 15px 0; color: #721c24;"><strong>ACCOUNT SUSPENDED</strong></p>
            <p style="margin: 0 0 15px 0;">All services have been suspended until payment is received</p>
            <p style="margin: 0 0 15px 0;"><strong>Amount Due: ${data.amountDue}</strong></p>
            ${data.paymentUrl ? `<a href="${data.paymentUrl}" style="display: inline-block; background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Pay Now to Restore Service</a>` : ''}
          </div>

          <p>To restore your services, please submit payment immediately. Once payment is received, services will be restored within 24 hours.</p>
          <p>For urgent matters, contact me directly at reece@nunezdev.com or (your phone number).</p>
          <p>Reece Nunez<br>NunezDev</p>
        </div>
      `
    };

    return (templates as any)[templateName] || `<p>Payment reminder for invoice ${data.invoiceNumber}</p>`;
  }

  // Manual follow-up for specific invoice
  async sendManualFollowup(invoiceId: string, message: string): Promise<void> {
    const { data: invoice } = await this.supabase
      .from('invoices')
      .select(`
        id, client_id, status, amount_cents, issued_at, due_at, stripe_invoice_id, hosted_invoice_url, access_token, invoice_number,
        clients(name, email),
        invoice_payments(amount_cents, paid_at)
      `)
      .eq('id', invoiceId)
      .single();

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const invoiceNumber = invoice.invoice_number || invoice.stripe_invoice_id || `INV-${invoice.id.slice(-6).toUpperCase()}`;
    const totalPaid = invoice.invoice_payments?.reduce((sum, payment) => sum + payment.amount_cents, 0) || 0;
    const amountDue = invoice.amount_cents - totalPaid;

    // Use public invoice URL with access token instead of protected dashboard URL
    const paymentUrl = invoice.access_token
      ? `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com'}/invoice/${invoice.access_token}`
      : invoice.hosted_invoice_url;

    await resend.emails.send({
      from: 'Reece at NunezDev <reece@nunezdev.com>',
      to: [(invoice as any).clients.email],
      subject: `Regarding Invoice ${invoiceNumber}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Hi ${(invoice as any).clients.name},</h2>
          <div style="white-space: pre-wrap;">${message}</div>

          <div style="background-color: #f8f9fa; border-radius: 6px; padding: 20px; margin: 20px 0;">
            <p><strong>Invoice:</strong> ${invoiceNumber}</p>
            <p><strong>Amount Due:</strong> ${(amountDue / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
            ${paymentUrl ? `<p><a href="${paymentUrl}" style="color: #ffc312;">View Invoice</a></p>` : ''}
          </div>

          <p>Best regards,<br>Reece Nunez<br>NunezDev</p>
        </div>
      `
    });

    // Record the manual follow-up
    await this.supabase
      .from('invoice_followups')
      .insert({
        invoice_id: invoiceId,
        followup_type: 'manual',
        days_overdue: Math.floor((new Date().getTime() - new Date(invoice.due_at).getTime()) / (1000 * 60 * 60 * 24)),
        sent_at: new Date().toISOString(),
        custom_message: message
      });
  }
}

export const invoiceFollowupService = new InvoiceFollowupService();