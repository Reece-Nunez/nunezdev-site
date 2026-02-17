import { NextRequest, NextResponse } from 'next/server';
import { leadNurtureService } from '@/lib/leadNurturing';
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
      subject = 'New Contact Form Submission'
    } = contactData;

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      );
    }

    // Create lead in nurturing system
    try {
      const leadId = await leadNurtureService.createLeadFromContact({
        name,
        email,
        phone,
        company,
        message
      });

      console.log('Lead created successfully:', leadId);
    } catch (leadError: any) {
      console.error('Error creating lead:', leadError);
      // Continue even if lead creation fails
    }

    // Send immediate notification to you
    try {
      await resend.emails.send({
        from: 'NunezDev Contact Form <reece@nunezdev.com>',
        to: ['reece@nunezdev.com'],
        subject: `New Contact: ${name} - ${subject}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #ffc312;">New Contact Form Submission</h1>

            <div style="background-color: #f8f9fa; border-radius: 6px; padding: 20px; margin: 20px 0;">
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
              <p><strong>Company:</strong> ${company || 'Not provided'}</p>
              <p><strong>Subject:</strong> ${subject}</p>
            </div>

            <div style="margin: 20px 0;">
              <h3>Message:</h3>
              <p style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; white-space: pre-wrap;">${message}</p>
            </div>

            <p style="margin-top: 20px; font-size: 14px; color: #666;">
              This contact has been automatically added to your lead nurturing system.
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