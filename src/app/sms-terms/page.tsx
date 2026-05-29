import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SMS Terms & Conditions',
  description:
    'NunezDev SMS messaging program terms. Message types, frequency, opt-in and opt-out instructions, and carrier disclosures for our text message service.',
  alternates: {
    canonical: 'https://www.nunezdev.com/sms-terms',
  },
  openGraph: {
    title: 'SMS Terms & Conditions | NunezDev',
    description:
      'Terms governing NunezDev text message communications, including opt-in, opt-out, frequency, and carrier disclosures.',
    url: 'https://www.nunezdev.com/sms-terms',
    siteName: 'NunezDev',
    type: 'website',
  },
};

export default function SmsTermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-24 text-gray-800">
      <h1 className="text-3xl font-bold mb-2">SMS Terms &amp; Conditions</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: May 26, 2026</p>

      <div className="space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold mb-2">1. Program Description</h2>
          <p>
            NunezDev LLC (&quot;NunezDev,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
            operates an SMS / text messaging program to communicate with prospects, clients, and
            customers who opt in. By providing your mobile phone number and opting in through one
            of the methods described in Section 3, you agree to these SMS Terms &amp; Conditions
            and our{' '}
            <a href="/privacy-policy" className="text-emerald-600 hover:underline">
              Privacy Policy
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">2. Two Independent Message Programs</h2>
          <p className="mb-3">
            NunezDev operates <strong>two separate SMS programs</strong>, each with its own
            independent consent. You may opt in to either, both, or neither, and you may opt out
            of one without affecting the other. Consent to one is never bundled with consent to
            the other, and consent to either is never a condition of purchase.
          </p>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-1">
                a. Service / Transactional Messages
              </h3>
              <p className="mb-2">
                Messages directly related to your project, account, or inquiry. Includes:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Invoice and payment reminders</li>
                <li>Project status updates and milestone notifications</li>
                <li>Customer service responses to your inquiries</li>
                <li>Appointment and consultation confirmations</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-1">
                b. Marketing / Promotional Messages
              </h3>
              <p className="mb-2">
                Messages about NunezDev offerings that are <em>not</em> tied to your existing
                project or account. Includes:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Service discounts and limited-time offers</li>
                <li>Announcements of new services or capabilities</li>
                <li>Occasional educational or promotional content</li>
              </ul>
              <p className="mt-2 text-gray-700">
                Marketing-program consent is collected via a separate, distinctly-labeled
                checkbox that is never pre-checked and never required to receive transactional
                messages.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">3. How to Opt In</h2>
          <p className="mb-2">
            You can opt in to either program through our contact form at{' '}
            <a href="/contact" className="text-emerald-600 hover:underline">
              nunezdev.com/contact
            </a>
            . The form presents two separate consent checkboxes — one for service messages and a
            distinctly labeled one for marketing messages. Both are unchecked by default. You may
            check one, both, or neither.
          </p>
          <p className="mb-2">
            Either consent may also be given verbally during a phone or in-person conversation,
            or by texting <code>START</code> in reply to a confirmation message from us. In all
            cases, transactional and marketing consents are recorded independently.
          </p>
          <p className="mt-3">
            <strong>Consent to either program is not a condition of purchase</strong> and is not
            required to obtain any product or service from NunezDev.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">4. Message Frequency</h2>
          <p>
            Message frequency varies based on your engagement with NunezDev. You should not
            typically expect more than a few messages per week. Transactional messages such as
            invoice reminders or project updates are sent only when relevant to your account or
            project.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">5. Message and Data Rates</h2>
          <p>
            <strong>Message and data rates may apply.</strong> Standard carrier rates from your
            mobile service provider apply to all SMS and MMS messages you send or receive in
            connection with this program. NunezDev does not charge a separate fee for SMS messages,
            but your wireless carrier may. Check your mobile plan for details.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">6. How to Opt Out (STOP)</h2>
          <p>
            You can cancel the SMS service at any time by texting{' '}
            <code>STOP</code> in reply to any message you receive from us. After you send the
            message <code>STOP</code>, we will send you one confirmation message acknowledging
            that you have been unsubscribed. You will no longer receive SMS messages from us
            unless you re-opt in through one of the methods described in Section 3.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">7. How to Get Help (HELP)</h2>
          <p>
            If you are experiencing issues with the messaging program, you can reply with the
            keyword <code>HELP</code> to any message for assistance, or contact us directly at{' '}
            <a href="mailto:reece@nunezdev.com" className="text-emerald-600 hover:underline">
              reece@nunezdev.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">8. Supported Carriers</h2>
          <p>
            This service is available on most major U.S. wireless carriers, including AT&amp;T,
            T-Mobile, Verizon Wireless, Sprint, Boost, Cricket, MetroPCS, U.S. Cellular, Virgin
            Mobile, and others. Carriers are not liable for delayed or undelivered messages. Service
            availability and message delivery are not guaranteed.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">9. Privacy &amp; Data Handling</h2>
          <p>
            We respect your privacy. Mobile information (phone numbers and SMS opt-in data) is{' '}
            <strong>
              never shared, sold, rented, or transferred to any third party or affiliate for
              marketing or promotional purposes.
            </strong>{' '}
            The only third parties that receive your mobile data are sub-processors strictly
            required to deliver the message itself (e.g., Twilio and the cellular carrier
            associated with your number). For full details on how we collect, use, and protect
            your data, see our{' '}
            <a href="/privacy-policy" className="text-emerald-600 hover:underline">
              Privacy Policy
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">10. Changes to These Terms</h2>
          <p>
            We may update these SMS Terms &amp; Conditions from time to time. Material changes
            will be posted on this page with a revised &quot;Last updated&quot; date. Continued
            participation in the messaging program after changes are posted constitutes acceptance
            of the updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">11. Contact Us</h2>
          <p>
            If you have any questions about these SMS Terms &amp; Conditions or our messaging
            program, please contact us:
          </p>
          <p className="mt-2">
            <strong>NunezDev LLC</strong>
            <br />
            Email:{' '}
            <a href="mailto:reece@nunezdev.com" className="text-emerald-600 hover:underline">
              reece@nunezdev.com
            </a>
            <br />
            Website:{' '}
            <a href="https://www.nunezdev.com" className="text-emerald-600 hover:underline">
              www.nunezdev.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
