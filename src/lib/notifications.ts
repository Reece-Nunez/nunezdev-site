import { Resend } from 'resend';
import { supabaseAdmin } from './supabaseAdmin';

// Initialize Resend (you'll need to add RESEND_API_KEY to your environment variables)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

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
  | 'payment_reminder';

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

// Email templates
const getBusinessEmailTemplate = (type: BusinessNotificationType, data: BusinessNotificationData) => {
  const amount = data.amount_cents ? `$${(data.amount_cents / 100).toFixed(2)}` : '';
  
  switch (type) {
    case 'payment_received':
      return {
        subject: `💰 Payment Received - ${amount} from ${data.client_name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">Payment Received!</h2>
            <p>Great news! You've received a payment:</p>
            
            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>💰 Amount:</strong> ${amount}</p>
              <p><strong>👤 Client:</strong> ${data.client_name}</p>
              <p><strong>📄 Invoice:</strong> ${data.invoice_number}</p>
              ${data.installment_label ? `<p><strong>📋 Installment:</strong> ${data.installment_label}</p>` : ''}
              <p><strong>💳 Payment Method:</strong> ${data.payment_method || 'Credit Card'}</p>
              <p><strong>📅 Date:</strong> ${new Date().toLocaleDateString('en-US', { 
                year: 'numeric', month: 'long', day: 'numeric', 
                hour: 'numeric', minute: '2-digit' 
              })}</p>
            </div>
            
            <p><a href="${process.env.NEXT_PUBLIC_BASE_URL}/invoices/${data.invoice_id}" 
                  style="background: #3b82f6; color: white; padding: 12px 24px; 
                         text-decoration: none; border-radius: 6px; display: inline-block;">
              View Invoice Details
            </a></p>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              This is an automated notification from your invoice management system.
            </p>
          </div>
        `
      };
      
    case 'contract_signed':
      return {
        subject: `✍️ Contract Signed - ${data.client_name} (${data.invoice_number})`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">Contract Signed!</h2>
            <p><strong>${data.client_name}</strong> has digitally signed the contract for invoice <strong>${data.invoice_number}</strong>.</p>
            
            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>👤 Client:</strong> ${data.client_name}</p>
              <p><strong>📄 Invoice:</strong> ${data.invoice_number}</p>
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
        subject: `👀 Invoice Viewed - ${data.client_name} (${data.invoice_number})`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3b82f6;">Invoice Viewed</h2>
            <p><strong>${data.client_name}</strong> has viewed invoice <strong>${data.invoice_number}</strong>.</p>
            
            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>👤 Client:</strong> ${data.client_name}</p>
              <p><strong>📄 Invoice:</strong> ${data.invoice_number}</p>
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
        subject: `⚠️ Payment Overdue - ${data.client_name} (${data.invoice_number})`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ef4444;">Payment Overdue</h2>
            <p>A payment from <strong>${data.client_name}</strong> is now overdue.</p>
            
            <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
              <p><strong>👤 Client:</strong> ${data.client_name}</p>
              <p><strong>📄 Invoice:</strong> ${data.invoice_number}</p>
              ${data.installment_label ? `<p><strong>📋 Payment:</strong> ${data.installment_label}</p>` : ''}
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
        subject: `Notification - ${data.invoice_number}`,
        html: `<p>You have a new notification regarding invoice ${data.invoice_number}.</p>`
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
        subject: `Payment Due - ${data.installment_label} (${amount})`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3b82f6;">Payment Due Reminder</h2>
            <p>Hi ${data.client_name},</p>
            <p>This is a friendly reminder that you have a payment due.</p>
            
            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>📄 Invoice:</strong> ${data.invoice_number}</p>
              <p><strong>📋 Payment:</strong> ${data.installment_label}</p>
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
        subject: `⚠️ Payment Overdue - ${data.installment_label} (${amount})`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ef4444;">Payment Overdue Notice</h2>
            <p>Hi ${data.client_name},</p>
            <p>We notice that a payment for your project is now overdue. We wanted to bring this to your attention.</p>
            
            <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
              <p><strong>📄 Invoice:</strong> ${data.invoice_number}</p>
              <p><strong>📋 Payment:</strong> ${data.installment_label}</p>
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
        subject: `Payment Notification - ${data.invoice_number}`,
        html: `<p>You have a payment notification for invoice ${data.invoice_number}.</p>`
      };
  }
};

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