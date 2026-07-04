import { NextRequest, NextResponse } from 'next/server';
import { leadNurtureService } from '@/lib/leadNurturing';
import { verifyTurnstile } from '@/lib/turnstile';
import { screenLead } from '@/lib/leadSpamFilter';
import { getRequestCountry, isLowQualityGeo } from '@/lib/leadGeo';
import { sendTrackedSms } from '@/lib/smsOutbox';
import { buildWelcomeSms } from '@/lib/smsWelcome';
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
      smsMarketingConsent,
      // Hidden honeypot field (see LeadForm). Named baitily on the wire; real
      // users never fill it, bots that auto-fill every input do.
      company_website: honeypot,
    } = contactData;

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      );
    }

    // Content-level spam screen. Turnstile stops bots; this stops the junk a
    // human (or a challenge-solving bot) can still type — the reported lead
    // had no valid email and a mashed name. Honeypot/gibberish hits are
    // swallowed with a fake 201 so abusers get no signal to adapt; an invalid
    // email gets a real 400 so a legit user fixing a typo sees why.
    const screen = screenLead({ name, email, honeypot });
    if (screen.spam) {
      console.warn('[contact] blocked submission:', screen.reason);
      if (screen.reason === 'invalid-email') {
        return NextResponse.json(
          { error: 'Please enter a valid email address.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: true, message: 'Contact form submitted successfully' },
        { status: 201 }
      );
    }

    // A2P 10DLC: a phone number cannot be stored for SMS use without an
    // explicit, actively-checked consent. We only gate on transactional
    // consent — marketing consent stays fully optional per CTIA / TCPA
    // (it must be independently opted into, never bundled with service).
    if (phone && !smsConsent) {
      return NextResponse.json(
        {
          error:
            'Service-SMS consent is required when a phone number is provided. Please check the service consent box or remove the phone number.',
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

    // Geo quarantine: a real human outside our market (the recurring offshore
    // app-clone / recharge-app inquiries) still gets a 201 and the normal
    // thank-you page, but we store the lead tagged 'offshore', skip every
    // notification, and — via the `quality: 'low'` response — tell the client
    // NOT to fire the Google Ads `generate_lead` conversion, so bidding stops
    // being trained toward more of the same. See lib/leadGeo.
    const country = getRequestCountry(request.headers);
    const lowQuality = isLowQualityGeo(country);
    if (lowQuality) {
      console.warn('[contact] quarantined offshore lead:', { country });
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
        smsMarketingConsent: Boolean(smsMarketingConsent),
        smsConsentIp: remoteIp,
        lowQuality,
      });

      console.log('Lead created successfully:', leadId);
    } catch (leadError: any) {
      console.error('Error creating lead:', leadError);
      // Continue even if lead creation fails
    }

    // Send immediate notification to you — skipped for quarantined offshore
    // leads so junk inquiries never hit the inbox or the contact's mailbox.
    if (!lowQuality) try {
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
              <p><strong>Service SMS consent:</strong> ${smsConsent ? `Yes (opted in at ${new Date().toISOString()})` : 'No'}</p>
              <p><strong>Marketing SMS consent:</strong> ${smsMarketingConsent ? `Yes (opted in at ${new Date().toISOString()})` : 'No'}</p>
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

    // One-time A2P 10DLC opt-in confirmation. Only fires when the visitor
    // both supplied a phone AND actively checked the service-SMS box (the
    // route already 400s on a phone without consent). Carriers expect this
    // confirmation right after opt-in — and it tells the lead the opt-in
    // actually worked. Best-effort: never block or fail the submission.
    if (smsConsent && phone && !lowQuality) {
      try {
        const smsResult = await sendTrackedSms({
          to: phone,
          body: buildWelcomeSms({ name }),
        });
        if (!smsResult.ok) {
          console.warn('[contact] welcome SMS not sent:', smsResult.error);
        }
      } catch (smsError) {
        console.warn('[contact] welcome SMS threw:', smsError);
      }
    }

    // `quality` drives the client's conversion tracking: 'low' suppresses the
    // Google Ads `generate_lead` event so Smart Bidding isn't rewarded for
    // offshore junk. The visitor still sees a normal success + thank-you page.
    return NextResponse.json(
      {
        success: true,
        message: 'Contact form submitted successfully',
        quality: lowQuality ? 'low' : 'ok',
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