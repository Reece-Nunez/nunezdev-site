import { Resend } from 'resend';

// Only initialize Resend if API key is available
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface SendInvoiceEmailParams {
  to: string;
  cc?: string[];
  clientName: string;
  invoiceNumber: string;
  invoiceUrl: string;
  amount: string;
  dueDate?: string;
  requiresSignature: boolean;
}

export async function sendInvoiceEmail({
  to,
  cc,
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
    if (cc && cc.length > 0) {
      console.log(`CC: ${cc.join(', ')}`);
    }
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
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        /* Base Styles */
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          max-width: 600px; 
          margin: 0 auto; 
          padding: 0;
          -webkit-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
        }
        
        .header { 
          background: #ffc312; 
          padding: 20px; 
          text-align: center; 
          color: #111; 
        }
        
        .content { 
          padding: 20px; 
        }
        
        .invoice-details { 
          background: #f8f9fa; 
          padding: 15px; 
          border-radius: 5px; 
          margin: 20px 0; 
          border: 1px solid #e9ecef;
        }
        
        .button { 
          display: inline-block; 
          padding: 16px 32px; 
          background: #5b7c99; 
          color: white !important; 
          text-decoration: none; 
          border-radius: 5px; 
          margin: 20px 0; 
          font-weight: 500;
          text-align: center;
          min-width: 200px;
          box-sizing: border-box;
        }
        
        .footer { 
          font-size: 12px; 
          color: #666; 
          margin-top: 30px; 
          padding-top: 20px;
          border-top: 1px solid #e9ecef;
        }
        
        .signature-warning { 
          background: #fff3cd; 
          border: 1px solid #ffeaa7; 
          padding: 15px; 
          border-radius: 5px; 
          margin: 15px 0; 
        }

        .logo { 
          width: 60px; 
          height: 60px; 
          margin-bottom: 10px; 
          max-width: 100%;
          height: auto;
        }

        /* Mobile Responsive Styles */
        @media only screen and (max-width: 600px) {
          body {
            width: 100% !important;
            min-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .header {
            padding: 15px 10px !important;
          }
          
          .content {
            padding: 15px 10px !important;
          }
          
          .invoice-details {
            margin: 15px 0 !important;
            padding: 12px !important;
          }
          
          .button {
            width: 100% !important;
            padding: 16px 20px !important;
            margin: 15px 0 !important;
            min-width: auto !important;
            display: block !important;
            text-align: center !important;
            box-sizing: border-box !important;
          }
          
          .signature-warning {
            margin: 10px 0 !important;
            padding: 12px !important;
          }
          
          h1 {
            font-size: 24px !important;
            margin: 10px 0 !important;
          }
          
          h2 {
            font-size: 20px !important;
            margin: 15px 0 10px 0 !important;
          }
          
          h3 {
            font-size: 18px !important;
            margin: 10px 0 !important;
          }
          
          p {
            font-size: 16px !important;
            margin: 10px 0 !important;
          }
          
          .footer {
            font-size: 11px !important;
            margin-top: 20px !important;
            padding-top: 15px !important;
          }

          .logo {
            width: 50px !important;
            height: 50px !important;
          }
        }

        /* Dark Mode Support */
        @media (prefers-color-scheme: dark) {
          .invoice-details {
            background: #2d3748 !important;
            color: #e2e8f0 !important;
            border-color: #4a5568 !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="https://nunezdev.com/logo.png" alt="NunezDev Logo" class="logo">
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
    const emailOptions: {
      from: string;
      to: string[];
      cc?: string[];
      subject: string;
      html: string;
    } = {
      from: 'NunezDev <invoices@nunezdev.com>',
      to: [to],
      subject,
      html,
    };

    // Add CC recipients if provided
    if (cc && cc.length > 0) {
      emailOptions.cc = cc;
    }

    const result = await resend.emails.send(emailOptions);

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
}