import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface SendPortalMagicLinkParams {
  to: string;
  clientName: string;
  magicLinkUrl: string;
}

export async function sendPortalMagicLink({
  to,
  clientName,
  magicLinkUrl,
}: SendPortalMagicLinkParams) {
  if (!resend) {
    console.log('📧 PORTAL MAGIC LINK EMAIL WOULD BE SENT:');
    console.log(`To: ${to}`);
    console.log(`Client: ${clientName}`);
    console.log(`Magic Link: ${magicLinkUrl}`);
    console.log('---');
    return { success: true, messageId: 'no-email-service' };
  }

  const subject = 'Your NunezDev Portal Access Link';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 0;
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
        }

        .footer {
          font-size: 12px;
          color: #666;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e9ecef;
        }

        .warning {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          padding: 12px;
          border-radius: 5px;
          margin: 15px 0;
          font-size: 14px;
        }

        .logo {
          width: 60px;
          height: 60px;
          margin-bottom: 10px;
        }

        @media only screen and (max-width: 600px) {
          .content { padding: 15px 10px; }
          .button { width: 100%; display: block; box-sizing: border-box; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="https://nunezdev.com/logo.png" alt="NunezDev Logo" class="logo">
        <h1>NunezDev</h1>
        <p>Client Portal</p>
      </div>

      <div class="content">
        <h2>Hello ${clientName},</h2>

        <p>You requested access to your NunezDev client portal. Click the button below to sign in:</p>

        <p style="text-align: center;">
          <a href="${magicLinkUrl}" class="button">Access Your Portal</a>
        </p>

        <div class="warning">
          <strong>This link expires in 15 minutes.</strong> If you didn't request this link, you can safely ignore this email.
        </div>

        <p>Once signed in, you'll be able to:</p>
        <ul>
          <li>View your active projects</li>
          <li>Upload images and files</li>
          <li>Track project progress</li>
        </ul>

        <p>Best regards,<br>
        Reece Nunez<br>
        NunezDev</p>

        <div class="footer">
          <p>This is an automated email. Please do not share this link with others.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const result = await resend.emails.send({
      from: 'NunezDev <portal@nunezdev.com>',
      to: [to],
      subject,
      html,
    });

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error('Portal email send error:', error);
    throw error;
  }
}
