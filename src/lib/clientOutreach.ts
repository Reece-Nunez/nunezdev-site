/**
 * Templates for one-tap client outreach: the care-plan upsell email and the
 * Google review request (SMS + email). Pure string builders so they're easy to
 * test. House rule: never use em dashes.
 */
import { GOOGLE_REVIEW_URL, EMAIL } from "./contact";

function firstName(name: string | null | undefined): string {
  return (name || "").trim().split(/\s+/)[0] || "there";
}

/** Care-plan upsell email. Pitches all three plans; the client picks. */
export function carePlanEmailHtml(name: string | null | undefined): string {
  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6;">
    <h2 style="margin: 0 0 12px;">Hi ${firstName(name)},</h2>
    <p>Now that your site is live, I want to make sure it stays fast, secure, and online without you having to think about it. That is what a care plan covers: hosting, security updates, backups, and someone (me) who fixes things quickly when they break.</p>
    <p>Here are the options:</p>

    <div style="border: 1px solid #eee; border-radius: 8px; padding: 16px; margin: 12px 0;">
      <strong>Essential: $49/mo</strong>
      <p style="margin: 6px 0 0; color: #555;">Hosting, SSL, uptime monitoring, monthly backups, security and dependency updates, 99.9% uptime.</p>
    </div>
    <div style="border: 1px solid #ffe08a; background: #fffdf5; border-radius: 8px; padding: 16px; margin: 12px 0;">
      <strong>Growth: $199/mo</strong> <span style="color:#b8860b;">(most popular)</span>
      <p style="margin: 6px 0 0; color: #555;">Everything in Essential, plus 3 hours/month of dev or content time, daily backups, performance and SEO monitoring.</p>
    </div>
    <div style="border: 1px solid #eee; border-radius: 8px; padding: 16px; margin: 12px 0;">
      <strong>Premium: $499/mo</strong>
      <p style="margin: 6px 0 0; color: #555;">Everything in Growth, plus 8 hours/month, a staging environment, A/B testing, a dedicated support channel, and a monthly strategy call.</p>
    </div>

    <p>Most clients start on Essential or Growth. Just reply with which one fits and I will get you set up. Happy to talk it through if you are not sure.</p>
    <p>Thanks,<br>Reece Nunez<br>NunezDev</p>
  </div>`;
}

/** Google review request, SMS length. */
export function reviewRequestSms(name: string | null | undefined): string {
  return `Hi ${firstName(name)}, this is Reece at NunezDev. It was great working with you. If you have a minute, a quick Google review would mean a lot and helps other local businesses find me: ${GOOGLE_REVIEW_URL}`;
}

/** Google review request, email version. */
export function reviewRequestEmailHtml(name: string | null | undefined): string {
  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6;">
    <h2 style="margin: 0 0 12px;">Hi ${firstName(name)},</h2>
    <p>It was great working with you. If you have a minute, would you mind leaving a quick Google review? It genuinely helps other local businesses find me, and I read every one.</p>
    <p style="text-align: center; margin: 24px 0;">
      <a href="${GOOGLE_REVIEW_URL}" style="display: inline-block; background: #ffc312; color: #1a1a1a; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Leave a Google review</a>
    </p>
    <p>Thank you,<br>Reece Nunez<br>NunezDev<br><a href="mailto:${EMAIL}" style="color:#b8860b;">${EMAIL}</a></p>
  </div>`;
}
