import { supabaseAdmin } from './supabaseAdmin';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface RecurringInvoice {
  id: string;
  title: string;
  description: string;
  amount_cents: number;
  next_invoice_date: string;
  reminder_days_before: number;
  send_reminder: boolean;
  clients: {
    name: string;
    email: string;
    company?: string;
  };
}

export class InvoiceReminderService {
  private supabase = supabaseAdmin();

  // Process reminders for upcoming invoices
  async processUpcomingInvoiceReminders(): Promise<void> {
    try {
      console.log('Processing upcoming invoice reminders...');

      // Get active recurring invoices that have reminders enabled
      const { data: recurringInvoices, error } = await this.supabase
        .from('recurring_invoices')
        .select(`
          id,
          title,
          description,
          amount_cents,
          next_invoice_date,
          reminder_days_before,
          send_reminder,
          clients (
            name,
            email,
            company
          )
        `)
        .eq('status', 'active')
        .eq('send_reminder', true)
        .order('next_invoice_date', { ascending: true });

      if (error) {
        console.error('Error fetching recurring invoices for reminders:', error);
        return;
      }

      if (!recurringInvoices || recurringInvoices.length === 0) {
        console.log('No recurring invoices with reminders enabled found');
        return;
      }

      let remindersSent = 0;

      for (const invoice of recurringInvoices) {
        const shouldSendReminder = this.shouldSendReminder(
          invoice as RecurringInvoice
        );

        if (shouldSendReminder) {
          await this.sendUpcomingInvoiceReminder(invoice as RecurringInvoice);
          remindersSent++;
        }
      }

      console.log(`Sent ${remindersSent} upcoming invoice reminders`);

    } catch (error) {
      console.error('Error processing upcoming invoice reminders:', error);
    }
  }

  private shouldSendReminder(invoice: RecurringInvoice): boolean {
    const today = new Date();
    const nextInvoiceDate = new Date(invoice.next_invoice_date);
    const daysDifference = Math.ceil((nextInvoiceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Send reminder if we're exactly the right number of days before
    return daysDifference === invoice.reminder_days_before;
  }

  private async sendUpcomingInvoiceReminder(invoice: RecurringInvoice): Promise<void> {
    try {
      // Check if we've already sent a reminder for this invoice and date
      const { data: existingReminder } = await this.supabase
        .from('invoice_reminders')
        .select('*')
        .eq('recurring_invoice_id', invoice.id)
        .eq('reminder_date', new Date().toISOString().split('T')[0])
        .single();

      if (existingReminder) {
        console.log(`Reminder already sent for invoice ${invoice.id} today`);
        return;
      }

      const client = invoice.clients;
      const amount = (invoice.amount_cents / 100).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD'
      });

      const nextInvoiceDate = new Date(invoice.next_invoice_date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const subject = `Upcoming Invoice: ${invoice.title} - ${amount}`;
      const emailContent = this.getReminderEmailTemplate({
        clientName: client.name,
        invoiceTitle: invoice.title,
        amount,
        nextInvoiceDate,
        description: invoice.description,
        reminderDays: invoice.reminder_days_before
      });

      await resend.emails.send({
        from: 'Reece at NunezDev <reece@nunezdev.com>',
        to: [client.email],
        subject,
        html: emailContent
      });

      // Record that we sent this reminder
      await this.supabase
        .from('invoice_reminders')
        .insert({
          recurring_invoice_id: invoice.id,
          reminder_date: new Date().toISOString().split('T')[0],
          sent_at: new Date().toISOString()
        });

      console.log(`Sent upcoming invoice reminder for ${invoice.title} to ${client.email}`);

    } catch (error) {
      console.error(`Error sending reminder for invoice ${invoice.id}:`, error);
    }
  }

  private getReminderEmailTemplate(data: {
    clientName: string;
    invoiceTitle: string;
    amount: string;
    nextInvoiceDate: string;
    description: string;
    reminderDays: number;
  }): string {
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Hi ${data.clientName},</h2>

        <p>I hope you're doing well! This is a friendly heads-up that your next invoice will be sent in ${data.reminderDays} day${data.reminderDays > 1 ? 's' : ''}.</p>

        <div style="background-color: #f8f9fa; border-radius: 6px; padding: 20px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0; color: #495057;">Upcoming Invoice Details:</h3>
          <p style="margin: 5px 0;"><strong>Service:</strong> ${data.invoiceTitle}</p>
          <p style="margin: 5px 0;"><strong>Amount:</strong> ${data.amount}</p>
          <p style="margin: 5px 0;"><strong>Invoice Date:</strong> ${data.nextInvoiceDate}</p>
          ${data.description ? `<p style="margin: 5px 0;"><strong>Description:</strong> ${data.description}</p>` : ''}
        </div>

        <p>The invoice will be sent automatically via Stripe, and you'll receive an email with a secure payment link.</p>

        <p>If you have any questions about your upcoming invoice or need to discuss payment arrangements, please don't hesitate to reach out.</p>

        <p>Thanks for your continued business!</p>

        <p>Best regards,<br>
        Reece Nunez<br>
        NunezDev<br>
        <a href="mailto:reece@nunezdev.com">reece@nunezdev.com</a></p>
      </div>
    `;
  }
}

export const invoiceReminderService = new InvoiceReminderService();