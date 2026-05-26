import { NextRequest, NextResponse } from 'next/server';
import { leadNurtureService } from '@/lib/leadNurturing';
import { verifyTurnstile } from '@/lib/turnstile';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const contactData = await request.json();

    const {
      name,
      email,
      phone,
      company,
      message,
      subject = 'New Contact Form Submission',
      turnstileToken,
      // Qualifying fields from the homepage / contact lead form. Optional so
      // older callers (audit magnet, legacy embeds) still work.
      projectType,
      budget,
      timeline,
      source,
      smsConsent,
    } = contactData;

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      );
    }

    // A2P 10DLC: a phone number cannot be stored for SMS use without an
    // explicit, actively-checked consent. If a caller submits a phone but
    // no consent flag, refuse the submission so we never accidentally
    // create an SMS-targetable lead without proof of opt-in.
    if (phone && !smsConsent) {
      return NextResponse.json(
        {
          error:
            'SMS consent is required when a phone number is provided. Please check the consent box or remove the phone number.',
        },
        { status: 400 }
      );
    }

    // Public contact endpoint — protect with Cloudflare Turnstile.
    // No-op when TURNSTILE_SECRET_KEY is unset (dev / external callers
    // that pre-date Turnstile still pass through gracefully).
    const remoteIp =
      request.headers.get('cf-connecting-ip') ??
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      undefined;
    const verdict = await verifyTurnstile(turnstileToken, remoteIp);
    if (!verdict.ok) {
      console.warn('[contact] turnstile failed:', verdict.reason);
      return NextResponse.json(
        { error: 'Spam protection failed. Please refresh and try again.' },
        { status: 400 }
      );
    }

    // Build an enriched message body so qualifying fields land in both the
    // lead-nurture record and the notification email without changing the
    // lead schema.
    const qualifyingLines = [
      projectType ? `Project type: ${projectType}` : null,
      budget ? `Budget: ${budget}` : null,
      timeline ? `Timeline: ${timeline}` : null,
      source ? `Source: ${source}` : null,
    ].filter(Boolean);
    const enrichedMessage = qualifyingLines.length
      ? `${qualifyingLines.join('\n')}\n\n${message}`
      : message;

    // Create lead in nurturing system. Capture the ID so the notification
    // email can deep-link straight to the lead in the admin dashboard.
    let leadId: string | null = null;
    try {
      leadId = await leadNurtureService.createLeadFromContact({
        name,
        email,
        phone,
        company,
        message,
        projectType,
        budget,
        timeline,
        leadSource: source,
        smsConsent: Boolean(smsConsent),
        smsConsentIp: remoteIp,
      });

      console.log('Lead created successfully:', leadId);
    } catch (leadError: any) {
      console.error('Error creating lead:', leadError);
      // Continue even if lead creation fails
    }

    // Send immediate notification to you
    try {
      const dashboardUrl = leadId
        ? `https://www.nunezdev.com/dashboard/leads/${leadId}`
        : 'https://www.nunezdev.com/dashboard/leads';

      await resend.emails.send({
        from: 'NunezDev Contact Form <reece@nunezdev.com>',
        to: ['reece@nunezdev.com'],
        subject: `New Lead: ${name}${company ? ` (${company})` : ''}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #ffc312; margin-bottom: 8px;">New Lead from ${source || 'the website'}</h1>
            <p style="color: #666; margin-top: 0; font-size: 14px;">Tap the button to open this lead in your dashboard.</p>

            <div style="margin: 24px 0;">
              <a href="${dashboardUrl}"
                 style="display: inline-block; background-color: #ffc312; color: #1a1a1a; font-weight: 600; text-decoration: none; padding: 12px 22px; border-radius: 6px; font-size: 15px;">
                View Lead in Dashboard &rarr;
              </a>
            </div>

            <div style="background-color: #f8f9fa; border-radius: 6px; padding: 20px; margin: 20px 0;">
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
              <p><strong>Phone:</strong> ${phone ? `<a href="tel:${phone}">${phone}</a>` : 'Not provided'}</p>
              <p><strong>Company:</strong> ${company || 'Not provided'}</p>
              <p><strong>Project type:</strong> ${projectType || 'Not provided'}</p>
              <p><strong>Budget:</strong> ${budget || 'Not provided'}</p>
              <p><strong>Timeline:</strong> ${timeline || 'Not provided'}</p>
              <p><strong>Source:</strong> ${source || 'Not provided'}</p>
              <p><strong>SMS consent:</strong> ${smsConsent ? `Yes (opted in at ${new Date().toISOString()})` : 'No'}</p>
            </div>

            <div style="margin: 20px 0;">
              <h3 style="color: #333;">Message:</h3>
              <p style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; white-space: pre-wrap;">${message}</p>
            </div>

            <p style="margin-top: 20px; font-size: 12px; color: #888;">
              Lead ID: ${leadId || 'not created'} &middot; Added to nurture pipeline automatically.
            </p>
          </div>
        `,
      });

      // Send confirmation to contact
      await resend.emails.send({
        from: 'Reece at NunezDev <reece@nunezdev.com>',
        to: [email],
        subject: 'Thanks for reaching out!',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #ffc312; margin: 0; font-size: 28px;">Thanks for reaching out!</h1>
                <p style="color: #666; margin: 10px 0 0 0;">I'll get back to you soon</p>
              </div>

              <div style="margin: 20px 0;">
                <p>Hi ${name},</p>
                <p>Thanks for contacting me about your project. I appreciate you taking the time to reach out.</p>
                <p>I'll review your message and get back to you within 24 hours with some initial thoughts and next steps.</p>
                <p>In the meantime, feel free to <a href="https://nunezdev.com/book" style="color: #ffc312; text-decoration: none;">schedule a free consultation</a> if you'd like to discuss your project right away.</p>
              </div>

              <div style="margin: 30px 0; padding: 20px; background-color: #e8f4f8; border-radius: 6px;">
                <h3 style="color: #333; margin: 0 0 15px 0;">What happens next?</h3>
                <ul style="color: #666; margin: 0; padding-left: 20px;">
                  <li style="margin: 5px 0;">I'll review your project requirements</li>
                  <li style="margin: 5px 0;">Send you some helpful resources</li>
                  <li style="margin: 5px 0;">Follow up with next steps within 24 hours</li>
                </ul>
              </div>

              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                <p style="color: #666; margin: 0;">Looking forward to working with you!</p>
                <p style="color: #ffc312; font-weight: bold; margin: 10px 0 0 0;">Reece Nunez</p>
                <p style="color: #999; margin: 5px 0 0 0; font-size: 14px;">NunezDev • reece@nunezdev.com</p>
              </div>
            </div>
          </div>
        `,
      });

    } catch (emailError: any) {
      console.error('Email error:', emailError);
      // Continue even if emails fail
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Contact form submitted successfully'
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Error processing contact form:', error);
    return NextResponse.json(
      { error: 'Failed to process contact form' },
      { status: 500 }
    );
  }
}