import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyTurnstile } from '@/lib/turnstile';
import { screenLead } from '@/lib/leadSpamFilter';
import {
  QUESTIONNAIRE_FIELDS,
  missingRequiredAnswers,
  renderQuestionnaireHtml,
  buildLeadNote,
  appendToNotes,
  escapeHtml,
} from '@/lib/questionnaire';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Website requirement-gathering questionnaire (see /questionnaire).
 *
 * Unlike /api/contact this deliberately does NOT create a lead. The form is an
 * unlisted link sent to people we're already talking to, so a new lead record
 * would be a duplicate. Instead the answers are appended to the matching lead's
 * notes when one exists, and always emailed.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Only ever read the declared question set off the wire — an extra key in
    // the payload can't smuggle content into the email or the lead note.
    const answers: Record<string, string> = {};
    for (const field of QUESTIONNAIRE_FIELDS) {
      const value = body?.[field.name];
      if (typeof value === 'string') answers[field.name] = value.trim();
    }

    const missing = missingRequiredAnswers(answers);
    if (missing.length) {
      const labels = QUESTIONNAIRE_FIELDS.filter((f) => missing.includes(f.name))
        .map((f) => f.label)
        .join(', ');
      return NextResponse.json(
        { error: `Please fill in the required questions: ${labels}` },
        { status: 400 }
      );
    }

    const { name, email } = answers;

    // Same content screen the contact form uses. Honeypot / gibberish hits get
    // a fake 201 so abusers learn nothing; a bad email gets a real 400 so a
    // human fixing a typo can see why.
    const screen = screenLead({
      name,
      email,
      honeypot: typeof body?.company_website === 'string' ? body.company_website : '',
    });
    if (screen.spam) {
      console.warn('[questionnaire] blocked submission:', screen.reason);
      if (screen.reason === 'invalid-email') {
        return NextResponse.json(
          { error: 'Please enter a valid email address.' },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true }, { status: 201 });
    }

    const remoteIp =
      request.headers.get('cf-connecting-ip') ??
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      undefined;
    const verdict = await verifyTurnstile(body?.turnstileToken, remoteIp);
    if (!verdict.ok) {
      console.warn('[questionnaire] turnstile failed:', verdict.reason);
      return NextResponse.json(
        { error: 'Spam protection failed. Please refresh and try again.' },
        { status: 400 }
      );
    }

    // Attach to an existing lead by email. Best-effort: a questionnaire from
    // someone who was never a lead (or a DB hiccup) must still reach the inbox.
    let leadId: string | null = null;
    try {
      const supabase = supabaseAdmin();
      const { data: lead } = await supabase
        .from('leads')
        .select('id, notes')
        .ilike('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lead) {
        leadId = lead.id;
        const note = buildLeadNote(answers, new Date());
        const { error: updateError } = await supabase
          .from('leads')
          .update({ notes: appendToNotes(lead.notes, note) })
          .eq('id', lead.id);
        if (updateError) {
          console.error('[questionnaire] note update failed:', updateError);
          leadId = null;
        }
      }
    } catch (dbError) {
      console.error('[questionnaire] lead lookup threw:', dbError);
    }

    const answersHtml = renderQuestionnaireHtml(answers);
    const dashboardUrl = leadId
      ? `https://www.nunezdev.com/dashboard/leads/${leadId}`
      : 'https://www.nunezdev.com/dashboard/leads';

    try {
      await resend.emails.send({
        from: 'NunezDev Questionnaire <reece@nunezdev.com>',
        to: ['reece@nunezdev.com'],
        replyTo: email,
        subject: `Website questionnaire: ${name}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #ffc312; margin-bottom: 4px;">Website questionnaire submitted</h1>
            <p style="color: #666; margin-top: 0; font-size: 14px;">
              ${escapeHtml(name)} &middot; <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>
            </p>
            <p style="color: #666; font-size: 14px;">
              ${leadId
                ? 'Appended to this lead&rsquo;s notes.'
                : 'No matching lead found &mdash; the answers are in this email only.'}
            </p>
            <div style="margin: 24px 0;">
              <a href="${dashboardUrl}"
                 style="display: inline-block; background-color: #ffc312; color: #1a1a1a; font-weight: 600; text-decoration: none; padding: 12px 22px; border-radius: 6px; font-size: 15px;">
                ${leadId ? 'View Lead in Dashboard' : 'Open Leads Dashboard'} &rarr;
              </a>
            </div>
            <div style="background-color: #f8f9fa; border-radius: 6px; padding: 24px;">
              ${answersHtml}
            </div>
          </div>
        `,
      });

      // Copy to the submitter — the Google Form this replaces did the same, and
      // it gives them a written record of what they committed to.
      await resend.emails.send({
        from: 'Reece at NunezDev <reece@nunezdev.com>',
        to: [email],
        subject: 'Your website questionnaire — copy of your answers',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background-color: white; border-radius: 8px; padding: 30px;">
              <h1 style="color: #ffc312; margin: 0 0 8px 0; font-size: 26px;">Thanks, ${escapeHtml(
                name
              )}!</h1>
              <p style="color: #444; line-height: 1.6;">
                I've got your answers. I'll review them and follow up within 24 hours
                with a scope, a timeline, and an honest price.
              </p>
              <p style="color: #444; line-height: 1.6;">
                If you have a logo, brand files, or photos to share, just reply to this
                email and attach them.
              </p>
              <div style="margin: 28px 0;">
                <a href="https://www.nunezdev.com/book"
                   style="display: inline-block; background-color: #ffc312; color: #1a1a1a; font-weight: 600; text-decoration: none; padding: 12px 22px; border-radius: 6px; font-size: 15px;">
                  Book a call to walk through it &rarr;
                </a>
              </div>
              <h2 style="color: #333; font-size: 17px; border-top: 1px solid #eee; padding-top: 24px;">Your answers</h2>
              ${answersHtml}
              <p style="color: #999; font-size: 13px; border-top: 1px solid #eee; padding-top: 18px; margin-top: 8px;">
                Reece Nunez &middot; NunezDev &middot; reece@nunezdev.com
              </p>
            </div>
          </div>
        `,
      });
    } catch (emailError) {
      // The answers are already on the lead record, but a silent email failure
      // means we'd never know a questionnaire came in. Surface it.
      console.error('[questionnaire] email send failed:', emailError);
      return NextResponse.json(
        { error: 'Your answers were saved, but the confirmation email failed to send. Please email reece@nunezdev.com.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, leadId }, { status: 201 });
  } catch (error) {
    console.error('[questionnaire] unhandled error:', error);
    return NextResponse.json(
      { error: 'Failed to submit the questionnaire. Please try again.' },
      { status: 500 }
    );
  }
}
