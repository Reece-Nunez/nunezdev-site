import { Resend } from 'resend';
import { supabaseAdmin } from './supabaseAdmin';

// Initialize Resend (you'll need to add RESEND_API_KEY to your environment variables)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// HTML escape utility to prevent XSS in email templates
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Notification types for business owner
export type BusinessNotificationType = 
  | 'contract_signed' 
  | 'payment_received' 
  | 'invoice_viewed' 
  | 'payment_failed' 
  | 'payment_overdue' 
  | 'all_payments_completed';

// Notification types for clients
export type ClientNotificationType =
  | 'payment_due'
  | 'payment_overdue'
  | 'payment_reminder'
  | 'payment_confirmation';

interface BusinessNotificationData {
  invoice_id: string;
  client_name: string;
  invoice_number: string;
  amount_cents?: number;
  installment_label?: string;
  payment_method?: string;
  activity_data?: any;
}

interface ClientNotificationData {
  invoice_id: string;
  invoice_number: string;
  client_name: string;
  client_email: string;
  installment_id?: string;
  installment_label: string;
  amount_cents: number;
  due_date: string;
  payment_link_url: string;
  grace_period_days?: number;
  days_overdue?: number;
}

export interface PaymentReceiptData {
  invoice_id: string;
  invoice_number: string;
  client_name: string;
  client_email: string;
  amount_cents: number;
  total_paid_cents?: number;
  invoice_total_cents?: number;
  remaining_balance_cents?: number;
  payment_method: string;
  payment_date: string;
  installment_label?: string;
  transaction_id?: string;
}

// Email templates
const getBusinessEmailTemplate = (type: BusinessNotificationType, data: BusinessNotificationData) => {
  const amount = data.amount_cents ? `$${(data.amount_cents / 100).toFixed(2)}` : '';
  
  switch (type) {
    case 'payment_received':
      return {
        subject: `Payment Received - ${amount} from ${escapeHtml(data.client_name)}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
          <body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f7;">
              <tr>
                <td align="center" style="padding: 40px 20px;">
                  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">

                    <!-- Header with green accent -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 32px 40px; text-align: center;">
                        <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0;">Payment Received</h1>
                        <p style="color: rgba(255,255,255,0.85); font-size: 14px; margin: 8px 0 0;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                      </td>
                    </tr>

                    <!-- Amount -->
                    <tr>
                      <td style="padding: 28px 40px 8px; text-align: center;">
                        <p style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Amount</p>
                        <p style="color: #059669; font-size: 36px; font-weight: 700; margin: 0;">${amount}</p>
                      </td>
                    </tr>

                    <!-- Details -->
                    <tr>
                      <td style="padding: 20px 40px 28px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
                          <tr><td style="padding: 16px 20px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Client</td>
                                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 600;">${escapeHtml(data.client_name)}</td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Invoice</td>
                                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 500;">${escapeHtml(data.invoice_number)}</td>
                              </tr>
                              ${data.installment_label ? `
                              <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Installment</td>
                                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 500;">${escapeHtml(data.installment_label)}</td>
                              </tr>
                              ` : ''}
                              <tr>
                                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Method</td>
                                <td style="padding: 8px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 500;">${escapeHtml(data.payment_method || 'Credit Card')}</td>
                              </tr>
                            </table>
                          </td></tr>
                        </table>
                      </td>
                    </tr>

                    <!-- CTA -->
                    <tr>
                      <td style="padding: 0 40px 32px; text-align: center;">
                        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/invoices/${data.invoice_id}"
                           style="display: inline-block; background: #5b7c99; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
                          View Invoice
                        </a>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="padding: 16px 40px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                        <p style="color: #94a3b8; font-size: 12px; margin: 0;">NunezDev Invoice Management</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `
      };
      
    case 'contract_signed':
      return {
        subject: `✍️ Contract Signed - ${escapeHtml(data.client_name)} (${escapeHtml(data.invoice_number)})`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">Contract Signed!</h2>
            <p><strong>${escapeHtml(data.client_name)}</strong> has digitally signed the contract for invoice <strong>${escapeHtml(data.invoice_number)}</strong>.</p>

            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>👤 Client:</strong> ${escapeHtml(data.client_name)}</p>
              <p><strong>📄 Invoice:</strong> ${escapeHtml(data.invoice_number)}</p>
              <p><strong>📅 Signed:</strong> ${new Date().toLocaleDateString('en-US', { 
                year: 'numeric', month: 'long', day: 'numeric', 
                hour: 'numeric', minute: '2-digit' 
              })}</p>
            </div>
            
            <p>The project can now proceed to the next phase.</p>
            
            <p><a href="${process.env.NEXT_PUBLIC_BASE_URL}/invoices/${data.invoice_id}" 
                  style="background: #3b82f6; color: white; padding: 12px 24px; 
                         text-decoration: none; border-radius: 6px; display: inline-block;">
              View Signed Contract
            </a></p>
          </div>
        `
      };
      
    case 'invoice_viewed':
      return {
        subject: `👀 Invoice Viewed - ${escapeHtml(data.client_name)} (${escapeHtml(data.invoice_number)})`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3b82f6;">Invoice Viewed</h2>
            <p><strong>${escapeHtml(data.client_name)}</strong> has viewed invoice <strong>${escapeHtml(data.invoice_number)}</strong>.</p>

            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>👤 Client:</strong> ${escapeHtml(data.client_name)}</p>
              <p><strong>📄 Invoice:</strong> ${escapeHtml(data.invoice_number)}</p>
              <p><strong>📅 Viewed:</strong> ${new Date().toLocaleDateString('en-US', { 
                year: 'numeric', month: 'long', day: 'numeric', 
                hour: 'numeric', minute: '2-digit' 
              })}</p>
            </div>
            
            <p>This is a good time to follow up if needed.</p>
          </div>
        `
      };
      
    case 'payment_overdue':
      return {
        subject: `⚠️ Payment Overdue - ${escapeHtml(data.client_name)} (${escapeHtml(data.invoice_number)})`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ef4444;">Payment Overdue</h2>
            <p>A payment from <strong>${escapeHtml(data.client_name)}</strong> is now overdue.</p>

            <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
              <p><strong>👤 Client:</strong> ${escapeHtml(data.client_name)}</p>
              <p><strong>📄 Invoice:</strong> ${escapeHtml(data.invoice_number)}</p>
              ${data.installment_label ? `<p><strong>📋 Payment:</strong> ${escapeHtml(data.installment_label)}</p>` : ''}
              <p><strong>💰 Amount:</strong> ${amount}</p>
            </div>
            
            <p>Consider reaching out to the client for payment collection.</p>
            
            <p><a href="${process.env.NEXT_PUBLIC_BASE_URL}/invoices/${data.invoice_id}" 
                  style="background: #ef4444; color: white; padding: 12px 24px; 
                         text-decoration: none; border-radius: 6px; display: inline-block;">
              View Invoice Details
            </a></p>
          </div>
        `
      };
      
    default:
      return {
        subject: `Notification - ${escapeHtml(data.invoice_number)}`,
        html: `<p>You have a new notification regarding invoice ${escapeHtml(data.invoice_number)}.</p>`
      };
  }
};

const getClientEmailTemplate = (type: ClientNotificationType, data: ClientNotificationData) => {
  const amount = `$${(data.amount_cents / 100).toFixed(2)}`;
  const dueDate = new Date(data.due_date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  
  switch (type) {
    case 'payment_due':
      return {
        subject: `Payment Due - ${escapeHtml(data.installment_label)} (${amount})`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3b82f6;">Payment Due Reminder</h2>
            <p>Hi ${escapeHtml(data.client_name)},</p>
            <p>This is a friendly reminder that you have a payment due.</p>

            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>📄 Invoice:</strong> ${escapeHtml(data.invoice_number)}</p>
              <p><strong>📋 Payment:</strong> ${escapeHtml(data.installment_label)}</p>
              <p><strong>💰 Amount Due:</strong> ${amount}</p>
              <p><strong>📅 Due Date:</strong> ${dueDate}</p>
              ${data.grace_period_days ? `<p><strong>⏰ Grace Period:</strong> ${data.grace_period_days} days after due date</p>` : ''}
            </div>
            
            <p>You can pay securely online by clicking the button below:</p>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="${data.payment_link_url}" 
                 style="background: #10b981; color: white; padding: 16px 32px; 
                        text-decoration: none; border-radius: 8px; display: inline-block; 
                        font-weight: bold; font-size: 16px;">
                Pay ${amount} Now
              </a>
            </p>
            
            <p>If you have any questions or need to discuss payment arrangements, please don't hesitate to reach out.</p>
            
            <p>Best regards,<br>
            Reece Nunez<br>
            NunezDev</p>
            
            <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
              This is an automated reminder. Please contact us if you believe this email was sent in error.
            </p>
          </div>
        `
      };
      
    case 'payment_overdue':
      return {
        subject: `⚠️ Payment Overdue - ${escapeHtml(data.installment_label)} (${amount})`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ef4444;">Payment Overdue Notice</h2>
            <p>Hi ${escapeHtml(data.client_name)},</p>
            <p>We notice that a payment for your project is now overdue. We wanted to bring this to your attention.</p>
            
            <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
              <p><strong>📄 Invoice:</strong> ${escapeHtml(data.invoice_number)}</p>
              <p><strong>📋 Payment:</strong> ${escapeHtml(data.installment_label)}</p>
              <p><strong>💰 Amount Due:</strong> ${amount}</p>
              <p><strong>📅 Original Due Date:</strong> ${dueDate}</p>
              ${data.days_overdue ? `<p><strong>⏰ Days Overdue:</strong> ${data.days_overdue} days</p>` : ''}
            </div>
            
            <p><strong>Please submit your payment as soon as possible to avoid any service interruptions.</strong></p>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="${data.payment_link_url}" 
                 style="background: #ef4444; color: white; padding: 16px 32px; 
                        text-decoration: none; border-radius: 8px; display: inline-block; 
                        font-weight: bold; font-size: 16px;">
                Pay ${amount} Now
              </a>
            </p>
            
            <p>If you're experiencing any issues with payment or need to discuss alternative arrangements, please contact us immediately. We're here to help find a solution that works for both of us.</p>
            
            <p>Best regards,<br>
            Reece Nunez<br>
            NunezDev<br>
            <a href="mailto:reece@nunezdev.com">reece@nunezdev.com</a></p>
          </div>
        `
      };
      
    default:
      return {
        subject: `Payment Notification - ${escapeHtml(data.invoice_number)}`,
        html: `<p>You have a payment notification for invoice ${escapeHtml(data.invoice_number)}.</p>`
      };
  }
};

// Professional payment receipt email template
function getPaymentReceiptTemplate(data: PaymentReceiptData) {
  const amount = `$${(data.amount_cents / 100).toFixed(2)}`;
  const invoiceTotal = data.invoice_total_cents ? `$${(data.invoice_total_cents / 100).toFixed(2)}` : null;
  const totalPaid = data.total_paid_cents ? `$${(data.total_paid_cents / 100).toFixed(2)}` : null;
  const remaining = data.remaining_balance_cents ? `$${(data.remaining_balance_cents / 100).toFixed(2)}` : '$0.00';
  const isPaidInFull = data.remaining_balance_cents !== undefined
    && data.remaining_balance_cents !== null
    && data.remaining_balance_cents <= 0;
  const paymentDate = new Date(data.payment_date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  const paymentTime = new Date(data.payment_date).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit'
  });

  const paymentMethodLabel: Record<string, string> = {
    card: 'Credit/Debit Card',
    credit_card: 'Credit Card',
    debit_card: 'Debit Card',
    bank_transfer: 'Bank Transfer',
    ach: 'ACH Transfer',
    wire: 'Wire Transfer',
    cash: 'Cash',
    check: 'Check',
    zelle: 'Zelle',
    venmo: 'Venmo',
    paypal: 'PayPal',
    manual: 'Manual Payment',
    other: 'Other',
  };
  const methodDisplay = paymentMethodLabel[data.payment_method] || escapeHtml(data.payment_method);

  return {
    subject: isPaidInFull
      ? `Payment Receipt - Invoice ${escapeHtml(data.invoice_number)} Paid in Full`
      : `Payment Receipt - ${amount} for Invoice ${escapeHtml(data.invoice_number)}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Receipt</title>
        <!--[if mso]>
        <noscript>
          <xml>
            <o:OfficeDocumentSettings>
              <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
          </xml>
        </noscript>
        <![endif]-->
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f7;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #5b7c99 0%, #3d5a80 100%); padding: 40px 40px 32px; text-align: center;">
                    <img src="https://nunezdev.com/logo.png" alt="NunezDev" width="50" height="50" style="display: inline-block; margin-bottom: 12px; border-radius: 8px;">
                    <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0 0 8px;">Payment Receipt</h1>
                    <p style="color: rgba(255,255,255,0.85); font-size: 14px; margin: 0;">${paymentDate} at ${paymentTime}</p>
                  </td>
                </tr>

                ${isPaidInFull ? `
                <!-- Paid in Full Badge -->
                <tr>
                  <td style="padding: 24px 40px 0; text-align: center;">
                    <div style="display: inline-block; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 50px; padding: 8px 24px;">
                      <span style="color: #059669; font-size: 14px; font-weight: 600; letter-spacing: 0.5px;">PAID IN FULL</span>
                    </div>
                  </td>
                </tr>
                ` : ''}

                <!-- Greeting -->
                <tr>
                  <td style="padding: 28px 40px 0;">
                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0;">Hi ${escapeHtml(data.client_name)},</p>
                    <p style="color: #555555; font-size: 15px; line-height: 1.6; margin: 8px 0 0;">
                      ${isPaidInFull
                        ? 'Thank you for your payment. This invoice has been paid in full. Here is your receipt for your records.'
                        : 'Thank you for your payment. Here is your receipt for your records.'}
                    </p>
                  </td>
                </tr>

                <!-- Payment Amount Card -->
                <tr>
                  <td style="padding: 24px 40px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
                      <tr>
                        <td style="padding: 28px 24px; text-align: center;">
                          <p style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Amount Paid</p>
                          <p style="color: #1e293b; font-size: 36px; font-weight: 700; margin: 0; line-height: 1.1;">${amount}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Transaction Details -->
                <tr>
                  <td style="padding: 0 40px 8px;">
                    <p style="color: #1e293b; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 16px; padding-bottom: 12px; border-bottom: 2px solid #e2e8f0;">Transaction Details</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 10px 0; color: #64748b; font-size: 14px; border-bottom: 1px solid #f1f5f9;">Invoice</td>
                        <td style="padding: 10px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 500; border-bottom: 1px solid #f1f5f9;">${escapeHtml(data.invoice_number)}</td>
                      </tr>
                      ${data.installment_label ? `
                      <tr>
                        <td style="padding: 10px 0; color: #64748b; font-size: 14px; border-bottom: 1px solid #f1f5f9;">Payment For</td>
                        <td style="padding: 10px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 500; border-bottom: 1px solid #f1f5f9;">${escapeHtml(data.installment_label)}</td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="padding: 10px 0; color: #64748b; font-size: 14px; border-bottom: 1px solid #f1f5f9;">Payment Method</td>
                        <td style="padding: 10px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 500; border-bottom: 1px solid #f1f5f9;">${methodDisplay}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #64748b; font-size: 14px; border-bottom: 1px solid #f1f5f9;">Date</td>
                        <td style="padding: 10px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 500; border-bottom: 1px solid #f1f5f9;">${paymentDate}</td>
                      </tr>
                      ${data.transaction_id ? `
                      <tr>
                        <td style="padding: 10px 0; color: #64748b; font-size: 14px; border-bottom: 1px solid #f1f5f9;">Transaction ID</td>
                        <td style="padding: 10px 0; color: #1e293b; font-size: 13px; text-align: right; font-weight: 500; font-family: 'SF Mono', Monaco, monospace; border-bottom: 1px solid #f1f5f9;">${escapeHtml(data.transaction_id.slice(0, 24))}${data.transaction_id.length > 24 ? '...' : ''}</td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>

                ${invoiceTotal ? `
                <!-- Invoice Summary -->
                <tr>
                  <td style="padding: 20px 40px 8px;">
                    <p style="color: #1e293b; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 16px; padding-bottom: 12px; border-bottom: 2px solid #e2e8f0;">Invoice Summary</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 10px 0; color: #64748b; font-size: 14px; border-bottom: 1px solid #f1f5f9;">Invoice Total</td>
                        <td style="padding: 10px 0; color: #1e293b; font-size: 14px; text-align: right; font-weight: 500; border-bottom: 1px solid #f1f5f9;">${invoiceTotal}</td>
                      </tr>
                      ${totalPaid ? `
                      <tr>
                        <td style="padding: 10px 0; color: #64748b; font-size: 14px; border-bottom: 1px solid #f1f5f9;">Total Paid</td>
                        <td style="padding: 10px 0; color: #059669; font-size: 14px; text-align: right; font-weight: 600; border-bottom: 1px solid #f1f5f9;">${totalPaid}</td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="padding: 12px 0; color: #1e293b; font-size: 15px; font-weight: 600;">Remaining Balance</td>
                        <td style="padding: 12px 0; color: ${isPaidInFull ? '#059669' : '#dc2626'}; font-size: 15px; text-align: right; font-weight: 700;">${remaining}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ` : ''}

                <!-- CTA Button -->
                <tr>
                  <td style="padding: 24px 40px; text-align: center;">
                    <a href="${process.env.NEXT_PUBLIC_BASE_URL}/invoice/${data.invoice_id}"
                       style="display: inline-block; background: #5b7c99; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600; letter-spacing: 0.3px;">
                      View Invoice
                    </a>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding: 0 40px;">
                    <div style="border-top: 1px solid #e2e8f0;"></div>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 24px 40px 32px; text-align: center;">
                    <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0 0 4px;">
                      If you have any questions about this payment, please contact us at
                    </p>
                    <a href="mailto:reece@nunezdev.com" style="color: #5b7c99; font-size: 13px; text-decoration: none; font-weight: 500;">reece@nunezdev.com</a>
                    <p style="color: #94a3b8; font-size: 12px; margin: 16px 0 0;">
                      NunezDev &middot; Professional Web Development Services
                    </p>
                    <p style="color: #cbd5e1; font-size: 11px; margin: 8px 0 0;">
                      This is an automated receipt. Please keep it for your records.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  };
}

// Send notification to business owner
export async function sendBusinessNotification(
  type: BusinessNotificationType, 
  data: BusinessNotificationData
) {
  if (!resend) {
    console.log('[notifications] Resend not configured, skipping email notification');
    return;
  }

  try {
    // Check if notifications are enabled for this type
    const supabase = supabaseAdmin();
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('email_enabled')
      .eq('notification_type', type)
      .single();

    if (!prefs?.email_enabled) {
      console.log(`[notifications] Email notifications disabled for ${type}`);
      return;
    }

    const template = getBusinessEmailTemplate(type, data);
    
    await resend.emails.send({
      from: 'NunezDev Notifications <notifications@nunezdev.com>',
      to: ['reece@nunezdev.com'], // Your email
      subject: template.subject,
      html: template.html,
    });

    console.log(`[notifications] Business notification sent: ${type}`);
  } catch (error) {
    console.error('[notifications] Error sending business notification:', error);
  }
}

// Send notification to client
export async function sendClientNotification(
  type: ClientNotificationType,
  data: ClientNotificationData
) {
  if (!resend) {
    console.log('[notifications] Resend not configured, skipping client email');
    return;
  }

  try {
    const template = getClientEmailTemplate(type, data);
    
    await resend.emails.send({
      from: 'NunezDev <notifications@nunezdev.com>',
      to: [data.client_email],
      subject: template.subject,
      html: template.html,
    });

    console.log(`[notifications] Client notification sent: ${type} to ${data.client_email}`);
    
    // Log the notification activity
    const supabase = supabaseAdmin();
    await supabase
      .from('client_activity_log')
      .insert({
        invoice_id: data.invoice_id,
        client_id: data.client_email, // Using email as client identifier here
        activity_type: 'email_sent',
        activity_data: {
          notification_type: type,
          email_subject: template.subject
        }
      });
      
  } catch (error) {
    console.error('[notifications] Error sending client notification:', error);
  }
}

// Send payment receipt to client
export async function sendPaymentReceipt(data: PaymentReceiptData) {
  if (!resend) {
    console.log('[notifications] Resend not configured, skipping payment receipt');
    return;
  }

  try {
    const template = getPaymentReceiptTemplate(data);

    await resend.emails.send({
      from: 'NunezDev <receipts@nunezdev.com>',
      to: [data.client_email],
      replyTo: 'reece@nunezdev.com',
      subject: template.subject,
      html: template.html,
    });

    console.log(`[notifications] Payment receipt sent to ${data.client_email} for invoice ${data.invoice_number}`);

    // Log the receipt activity
    const supabase = supabaseAdmin();
    await supabase
      .from('client_activity_log')
      .insert({
        invoice_id: data.invoice_id,
        activity_type: 'receipt_sent',
        activity_data: {
          email: data.client_email,
          amount_cents: data.amount_cents,
          payment_method: data.payment_method,
          email_subject: template.subject
        }
      });
  } catch (error) {
    console.error('[notifications] Error sending payment receipt:', error);
  }
}

// Send upload notification to business owner
export async function sendUploadNotification(data: {
  clientName: string;
  projectName: string;
  fileName: string;
  fileSizeMb: string;
  fileType: string;
  projectId: string;
}) {
  if (!resend) {
    console.log('[notifications] Resend not configured, skipping upload notification');
    return;
  }

  try {
    // Check if notifications are enabled for this type
    const supabase = supabaseAdmin();
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('email_enabled')
      .eq('notification_type', 'file_uploaded')
      .single();

    if (!prefs?.email_enabled) {
      console.log('[notifications] Email notifications disabled for file_uploaded');
      return;
    }

    const timestamp = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });

    await resend.emails.send({
      from: 'NunezDev Notifications <notifications@nunezdev.com>',
      to: ['reece@nunezdev.com'],
      subject: `📁 New Upload - ${data.clientName} uploaded to ${data.projectName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #5b7c99;">New File Uploaded</h2>
          <p><strong>${data.clientName}</strong> uploaded a file to the client portal.</p>

          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>📁 File:</strong> ${data.fileName}</p>
            <p><strong>📦 Size:</strong> ${data.fileSizeMb} MB</p>
            <p><strong>📄 Type:</strong> ${data.fileType}</p>
            <p><strong>📂 Project:</strong> ${data.projectName}</p>
            <p><strong>👤 Client:</strong> ${data.clientName}</p>
            <p><strong>📅 Uploaded:</strong> ${timestamp}</p>
          </div>

          <p><a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/client-portal"
                style="background: #5b7c99; color: white; padding: 12px 24px;
                       text-decoration: none; border-radius: 6px; display: inline-block;">
            View in Dashboard
          </a></p>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            This is an automated notification from your client portal.
          </p>
        </div>
      `,
    });

    console.log(`[notifications] Upload notification sent for ${data.fileName}`);
  } catch (error) {
    console.error('[notifications] Error sending upload notification:', error);
  }
}

// SMS notification setup (for future implementation)
export async function sendSMSNotification(
  phoneNumber: string,
  message: string,
  type: 'payment_due' | 'payment_overdue' | 'payment_received'
) {
  // TODO: Implement with Twilio
  console.log(`[notifications] SMS would be sent to ${phoneNumber}: ${message}`);
  
  // Future implementation:
  // const twilio = new Twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  // await twilio.messages.create({
  //   body: message,
  //   from: process.env.TWILIO_PHONE_NUMBER,
  //   to: phoneNumber
  // });
}