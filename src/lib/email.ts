import { Resend } from 'resend';

// Only initialize Resend if API key is available
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface SendInvoiceEmailParams {
  to: string;
  clientName: string;
  invoiceNumber: string;
  invoiceUrl: string;
  amount: string;
  dueDate?: string;
  requiresSignature: boolean;
}

export async function sendInvoiceEmail({
  to,
  clientName,
  invoiceNumber,
  invoiceUrl,
  amount,
  dueDate,
  requiresSignature
}: SendInvoiceEmailParams) {
  // If no Resend API key, just log the email content and return success
  if (!resend) {
    console.log('📧 EMAIL WOULD BE SENT:');
    console.log(`To: ${to}`);
    console.log(`Subject: Invoice ${invoiceNumber} from NunezDev`);
    console.log(`Invoice URL: ${invoiceUrl}`);
    console.log(`Amount: ${amount}`);
    console.log(`Due Date: ${dueDate || 'N/A'}`);
    console.log(`Requires Signature: ${requiresSignature ? 'Yes' : 'No'}`);
    console.log('---');
    return { success: true, messageId: 'no-email-service' };
  }

  const subject = `Invoice ${invoiceNumber} from NunezDev`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: #ffc312; padding: 20px; text-align: center; color: #111; }
        .content { padding: 20px; }
        .invoice-details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .button { 
          display: inline-block; 
          padding: 12px 24px; 
          background: #5b7c99; 
          color: white; 
          text-decoration: none; 
          border-radius: 5px; 
          margin: 20px 0; 
        }
        .footer { font-size: 12px; color: #666; margin-top: 30px; }
        .signature-warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 5px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="https://nunezdev.com/logo.png" alt="NunezDev Logo" style="width: 60px; height: 60px; margin-bottom: 10px;">
        <h1>NunezDev</h1>
        <p>Professional Web Development Services</p>
      </div>
      
      <div class="content">
        <h2>Hello ${clientName},</h2>
        
        <p>You've received a new invoice from NunezDev. Please review the details below:</p>
        
        <div class="invoice-details">
          <h3>Invoice Details</h3>
          <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
          <p><strong>Amount Due:</strong> ${amount}</p>
          ${dueDate ? `<p><strong>Due Date:</strong> ${dueDate}</p>` : ''}
        </div>
        
        ${requiresSignature ? `
        <div class="signature-warning">
          <p><strong>⚠️ Signature Required</strong></p>
          <p>This invoice requires your digital signature before payment. Please review and sign the invoice to proceed.</p>
        </div>
        ` : ''}
        
        <p>
          <a href="${invoiceUrl}" class="button">View Invoice</a>
        </p>
        
        <p>If you have any questions about this invoice, please don't hesitate to contact me.</p>
        
        <p>Best regards,<br>
        Reece Nunez<br>
        NunezDev<br>
        reece@nunezdev.com</p>
        
        <div class="footer">
          <p>This email was sent regarding invoice ${invoiceNumber}. Please do not share the invoice link with unauthorized parties.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const result = await resend.emails.send({
      from: 'NunezDev <invoices@nunezdev.com>',
      to: [to],
      subject,
      html,
    });

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
}