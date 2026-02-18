import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'NunezDev privacy policy — how we collect, use, retain, and disclose personal data.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-24 text-gray-800">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: February 18, 2026</p>

      <div className="space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold mb-2">1. Introduction</h2>
          <p>
            NunezDev (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the website{' '}
            <strong>nunezdev.com</strong> and related services. This Privacy Policy describes how we
            collect, use, retain, and disclose personal data when you use our services, including our
            website, client portal, invoicing system, and any third-party integrations we use to
            deliver our services.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">2. Information We Collect</h2>
          <p className="mb-2">We may collect the following types of personal information:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Contact Information:</strong> Name, email address, phone number, and business
              name provided when you contact us, request a quote, or become a client.
            </li>
            <li>
              <strong>Account Information:</strong> Login credentials and profile information for our
              client portal.
            </li>
            <li>
              <strong>Payment Information:</strong> Billing details processed through Stripe. We do
              not store full credit card numbers on our servers.
            </li>
            <li>
              <strong>Project Data:</strong> Files, documents, and communications related to your
              project that you upload or share through our platform.
            </li>
            <li>
              <strong>Usage Data:</strong> Browser type, IP address, pages visited, and other
              analytics data collected automatically through cookies and similar technologies.
            </li>
            <li>
              <strong>Third-Party Platform Data:</strong> If you connect with us through platforms
              like Thumbtack, we may receive your name, contact information, and project details as
              provided by that platform.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">3. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To provide, maintain, and improve our web development and software services</li>
            <li>To communicate with you about projects, invoices, and support requests</li>
            <li>To process payments and send receipts</li>
            <li>To send project updates, reminders, and notifications you have opted into</li>
            <li>To respond to inquiries submitted through our website or third-party platforms</li>
            <li>To comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">4. Data Sharing &amp; Third Parties</h2>
          <p className="mb-2">
            We do not sell your personal data. We may share information with the following types of
            third parties solely to deliver our services:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Payment Processors:</strong> Stripe, for processing payments securely.
            </li>
            <li>
              <strong>Email Services:</strong> Resend, for transactional emails such as invoices and
              notifications.
            </li>
            <li>
              <strong>Cloud Infrastructure:</strong> AWS and Supabase, for hosting and data storage.
            </li>
            <li>
              <strong>Lead Platforms:</strong> Thumbtack and similar platforms, where we may receive
              and respond to your project inquiries.
            </li>
            <li>
              <strong>Analytics:</strong> Google Analytics, for understanding website usage patterns.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">5. Data Retention</h2>
          <p>
            We retain personal data for as long as necessary to fulfill the purposes described in
            this policy, maintain our business records, comply with legal obligations, and resolve
            disputes. Client project data is retained for the duration of our business relationship
            and for a reasonable period afterward. You may request deletion of your data at any time
            by contacting us.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">6. Data Security</h2>
          <p>
            We implement industry-standard security measures to protect your personal data,
            including encryption in transit (TLS/SSL), secure authentication, and access controls.
            However, no method of transmission over the internet is 100% secure, and we cannot
            guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">7. Your Rights</h2>
          <p className="mb-2">Depending on your jurisdiction, you may have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Opt out of marketing communications</li>
            <li>Request a copy of your data in a portable format</li>
          </ul>
          <p className="mt-2">
            To exercise any of these rights, please contact us at the email address below.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">8. Cookies</h2>
          <p>
            Our website uses cookies and similar tracking technologies for analytics and to improve
            your experience. You can control cookie preferences through your browser settings.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">9. Children&apos;s Privacy</h2>
          <p>
            Our services are not directed at individuals under the age of 13. We do not knowingly
            collect personal data from children.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any material
            changes by posting the updated policy on this page with a revised &quot;Last
            updated&quot; date.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">11. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy or our data practices, please
            contact us:
          </p>
          <p className="mt-2">
            <strong>NunezDev</strong>
            <br />
            Email:{' '}
            <a href="mailto:contact@nunezdev.com" className="text-emerald-600 hover:underline">
              contact@nunezdev.com
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
