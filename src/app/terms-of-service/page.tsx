import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'NunezDev terms of service — the contractual terms governing use of our services.',
};

export default function TermsOfServicePage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-24 text-gray-800">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: February 18, 2026</p>

      <div className="space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold mb-2">1. Acceptance of Terms</h2>
          <p>
            By accessing or using the services provided by NunezDev (&quot;we,&quot; &quot;us,&quot;
            or &quot;our&quot;), including our website at <strong>nunezdev.com</strong>, client
            portal, invoicing system, and any related tools, you agree to be bound by these Terms of
            Service. If you do not agree to these terms, please do not use our services.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">2. Services</h2>
          <p>
            NunezDev provides custom web development, software engineering, and related digital
            services. The specific scope, deliverables, timeline, and pricing for each project are
            defined in individual proposals or contracts agreed upon between NunezDev and the client.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">3. Client Accounts</h2>
          <p>
            Certain features of our services require you to create an account or access our client
            portal. You are responsible for maintaining the confidentiality of your account
            credentials and for all activities that occur under your account. You agree to notify us
            immediately of any unauthorized use of your account.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">4. Payments &amp; Invoicing</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Payment terms are specified in individual project proposals or contracts.
            </li>
            <li>
              Invoices are issued through our platform and may include payment plan options with
              installment schedules.
            </li>
            <li>
              Payments are processed securely through Stripe. By making a payment, you agree to
              Stripe&apos;s terms of service.
            </li>
            <li>
              Late payments may be subject to grace periods as specified in the invoice. Overdue
              payments may incur follow-up communications.
            </li>
            <li>
              Refund policies are determined on a per-project basis and outlined in individual
              contracts.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">5. Intellectual Property</h2>
          <p>
            Unless otherwise specified in a project contract, upon full payment, the client receives
            ownership of the custom code and design assets created specifically for their project.
            NunezDev retains the right to use general techniques, knowledge, and non-proprietary
            components developed during the project. NunezDev may display completed work in
            portfolios unless the client requests otherwise in writing.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">6. Client Portal &amp; File Uploads</h2>
          <p>
            Our client portal allows you to upload files, view project status, and manage invoices.
            You are responsible for the content you upload and agree not to upload any content that
            is unlawful, harmful, or infringes on third-party rights. We reserve the right to remove
            content that violates these terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">7. Third-Party Platforms</h2>
          <p>
            If you engage with us through third-party platforms such as Thumbtack, the terms and
            policies of those platforms also apply. By authorizing NunezDev to access information
            through these platforms, you consent to the collection and use of your data as described
            in our{' '}
            <a href="/privacy-policy" className="text-emerald-600 hover:underline">
              Privacy Policy
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">8. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, NunezDev shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages arising from your use of our
            services. Our total liability for any claim arising from our services shall not exceed
            the amount paid by you for the specific service giving rise to the claim.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">9. Warranties &amp; Disclaimers</h2>
          <p>
            Our services are provided &quot;as is&quot; and &quot;as available.&quot; While we strive
            to deliver high-quality work, we do not warrant that our services will be uninterrupted,
            error-free, or meet every specific expectation beyond what is defined in individual
            project contracts.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">10. Termination</h2>
          <p>
            Either party may terminate a service agreement as outlined in the individual project
            contract. We reserve the right to suspend or terminate access to our platform for
            violation of these terms. Upon termination, provisions related to intellectual property,
            limitation of liability, and any outstanding payment obligations survive.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">11. Governing Law</h2>
          <p>
            These Terms of Service are governed by and construed in accordance with the laws of the
            State of Oklahoma, without regard to its conflict of law principles.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">12. Changes to These Terms</h2>
          <p>
            We may update these Terms of Service from time to time. We will notify you of any
            material changes by posting the updated terms on this page with a revised &quot;Last
            updated&quot; date. Continued use of our services after changes constitutes acceptance of
            the updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">13. Contact Us</h2>
          <p>
            If you have any questions about these Terms of Service, please contact us:
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
