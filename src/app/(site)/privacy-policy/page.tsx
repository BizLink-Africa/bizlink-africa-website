import type { Metadata } from 'next';
import { COMPANY } from '@/data/website';

// Legal review is recommended before publication of this policy.

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How BizLink Africa Limited collects, uses, and protects information gathered through our website, merchant onboarding coordination, and payment-integration support services.',
};

const LAST_UPDATED = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

const h2Class = 'font-[Geist,sans-serif] font-bold text-xl text-[#00342b] mt-10 mb-3';
const pClass = 'text-[#3f4945] leading-relaxed';
const ulClass = 'list-disc pl-5 space-y-1 text-[#3f4945] leading-relaxed';

export default function PrivacyPolicyPage() {
  return (
    <section className="max-w-3xl mx-auto px-6 md:px-12 pt-20 pb-24">
      <h1 className="font-[Geist,sans-serif] font-bold text-3xl md:text-4xl text-[#1b1c1c] mb-2">Privacy Policy</h1>
      <p className="text-sm text-[#707975] mb-10">Last updated: {LAST_UPDATED}</p>

      <p className={pClass}>
        BizLink Africa Limited respects user privacy and is committed to protecting personal information collected
        through the website, inquiry forms, merchant onboarding coordination, payment-integration support, support
        channels, and other business service requests. This policy explains what information we collect, how it is
        used, and how it is protected.
      </p>

      <div className="mt-6 border border-[#afefdd] bg-[#afefdd]/10 p-5">
        <p className="text-sm text-[#3f4945] leading-relaxed">
          Each merchant maintains and manages their own payment account or wallet with the applicable approved
          payment partner. BizLink Africa does not receive, hold, control or settle merchant funds. Relevant
          onboarding information may be securely shared with an approved payment partner where required for
          verification, account setup and integration.
        </p>
      </div>

      <h2 className={h2Class}>1. Information We Collect</h2>
      <p className={pClass}>Depending on the services requested, we may collect:</p>
      <ul className={ulClass}>
        <li>Contact details</li>
        <li>Business/company details</li>
        <li>Business category and location</li>
        <li>Service requirements</li>
        <li>Onboarding information</li>
        <li>Technical integration information</li>
        <li>Support and communication records</li>
        <li>Security and website-usage information</li>
        <li>KYC documentation — collected only through protected or offline onboarding processes where required</li>
      </ul>

      <h2 className={h2Class}>2. Sensitive Information</h2>
      <p className={pClass}>
        Merchant onboarding may involve sensitive information, including identity, business ownership, or
        KYC-related information. This information receives additional protection and is only accessed and used for
        the purposes described in this policy.
      </p>

      <h2 className={h2Class}>3. How Information Is Collected</h2>
      <p className={pClass}>Information may be collected through:</p>
      <ul className={ulClass}>
        <li>The public inquiry form</li>
        <li>A protected onboarding portal</li>
        <li>Direct business communication</li>
        <li>Approved integration partners</li>
        <li>Payment partner systems, where information is shared for onboarding and verification purposes</li>
        <li>Support channels</li>
      </ul>

      <h2 className={h2Class}>4. How We Use Information</h2>
      <p className={pClass}>We use the information we collect to:</p>
      <ul className={ulClass}>
        <li>Respond to inquiries</li>
        <li>Provide ICT consultation</li>
        <li>Coordinate merchant onboarding</li>
        <li>Support technical integration</li>
        <li>Configure services</li>
        <li>Provide support</li>
        <li>Maintain security</li>
        <li>Maintain compliance and audit records</li>
      </ul>
      <p className={`${pClass} mt-3`}>
        Final KYC verification and account or till activation are carried out by the approved payment partner, not
        by BizLink Africa.
      </p>

      <h2 className={h2Class}>5. Information Sharing</h2>
      <p className={pClass}>We may share necessary information only with:</p>
      <ul className={ulClass}>
        <li>Approved payment partners</li>
        <li>Banks or mobile-wallet operators</li>
        <li>Authorised BizLink Africa staff</li>
        <li>Technical service providers supporting our systems</li>
        <li>Regulators or lawful authorities where required</li>
        <li>Professional advisers, where necessary</li>
      </ul>
      <p className={`${pClass} mt-3`}>
        BizLink Africa does not sell personal information. Confidential commercial and partner agreement terms are
        never disclosed as part of this information sharing.
      </p>

      <h2 className={h2Class}>6. Payment Accounts and Fund Handling</h2>
      <p className={pClass}>
        Each merchant maintains and manages their own payment account or wallet with the applicable approved
        payment partner. BizLink Africa does not receive, hold, control or settle merchant funds. Relevant
        onboarding information may be securely shared with an approved payment partner where required for
        verification, account setup and integration.
      </p>
      <ul className={`${ulClass} mt-3`}>
        <li>Full merchant bank or mobile-wallet settlement credentials should not be collected through the public website.</li>
        <li>Final merchant verification and account activation may be conducted by the approved payment partner.</li>
        <li>Third-party payment partners maintain their own privacy practices, independent of BizLink Africa.</li>
      </ul>

      <h2 className={h2Class}>7. Data Security</h2>
      <p className={pClass}>We apply technical and organisational safeguards, including:</p>
      <ul className={ulClass}>
        <li>Encryption</li>
        <li>Masking of sensitive data</li>
        <li>Role-based access controls</li>
        <li>Audit logs</li>
        <li>Restricted staff access</li>
        <li>Secure document storage</li>
        <li>Monitoring</li>
        <li>Incident response procedures</li>
      </ul>

      <h2 className={h2Class}>8. Data Retention</h2>
      <p className={pClass}>
        KYC, onboarding, technical-integration, support, and audit information may be retained for as long as
        necessary to meet legal, contractual, and operational requirements.
      </p>

      <h2 className={h2Class}>9. Merchant Responsibilities</h2>
      <p className={pClass}>
        Merchants must provide accurate and authorised information and must promptly notify BizLink Africa of any
        changes to the information they have submitted.
      </p>

      <h2 className={h2Class}>10. User Rights</h2>
      <p className={pClass}>
        Where legally applicable, users may contact BizLink Africa to request access to, correction of, objection
        to, or deletion of their personal information, subject to legal and operational requirements.
      </p>

      <h2 className={h2Class}>11. Cookies and Analytics</h2>
      <p className={pClass}>
        The website may use cookies or analytics tools to improve performance, security, and user experience.
      </p>

      <h2 className={h2Class}>12. Third-Party Services</h2>
      <p className={pClass}>
        Our website and services may involve third-party providers, including hosting, analytics, communication,
        and approved payment partners. Third-party payment partners maintain their own privacy practices, and
        BizLink Africa is not responsible for their independent privacy practices. BizLink Africa does not disclose
        confidential third-party or partner agreement terms.
      </p>

      <h2 className={h2Class}>13. Policy Updates</h2>
      <p className={pClass}>
        This Privacy Policy may be updated periodically to reflect changes in our services, legal requirements, or
        business operations. Updates will be posted on this page with a revised &ldquo;Last updated&rdquo; date.
      </p>

      <h2 className={h2Class}>14. Contact Information</h2>
      <p className={pClass}>For privacy questions, contact:</p>
      <ul className={`${ulClass} break-words`}>
        <li><a href={`mailto:${COMPANY.emailGeneral}`} className="text-[#00342b] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00342b] focus-visible:ring-offset-2 rounded-sm">{COMPANY.emailGeneral}</a></li>
        <li><a href={`mailto:${COMPANY.emailSupport}`} className="text-[#00342b] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00342b] focus-visible:ring-offset-2 rounded-sm">{COMPANY.emailSupport}</a></li>
        <li><a href={COMPANY.phoneLink} className="text-[#00342b] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00342b] focus-visible:ring-offset-2 rounded-sm">{COMPANY.phone}</a> (also WhatsApp)</li>
        <li>{COMPANY.address}</li>
      </ul>
    </section>
  );
}
