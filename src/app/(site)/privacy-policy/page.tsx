import type { Metadata } from 'next';
import { COMPANY } from '@/data/website';

// Legal review required before final publication.

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How BizLink Africa Limited collects, uses, and protects information gathered through our website, merchant onboarding, and payment services.',
};

const h2Class = 'font-[Geist,sans-serif] font-bold text-xl text-[#00342b] mt-10 mb-3';
const pClass = 'text-[#3f4945] leading-relaxed';
const ulClass = 'list-disc pl-5 space-y-1 text-[#3f4945] leading-relaxed';

export default function PrivacyPolicyPage() {
  return (
    <section className="max-w-3xl mx-auto px-6 md:px-12 pt-20 pb-24">
      <h1 className="font-[Geist,sans-serif] font-bold text-3xl md:text-4xl text-[#1b1c1c] mb-2">Privacy Policy</h1>
      <p className="text-sm text-[#707975] mb-10">Last updated: July 2026</p>

      <p className={pClass}>
        BizLink Africa Limited respects user privacy and is committed to protecting personal information collected
        through the website, inquiry forms, merchant onboarding, payment integration and settlement coordination,
        support channels, and other business service requests. This policy explains what information we collect,
        how it is used, and how it is protected.
      </p>

      <div className="mt-6 border border-[#afefdd] bg-[#afefdd]/10 p-5">
        <p className="text-sm text-[#3f4945] leading-relaxed">
          Merchant activation and payment services may require BizLink Africa to securely transmit relevant
          onboarding information to approved payment infrastructure partners for verification, account setup,
          transaction processing and compliance purposes.
        </p>
      </div>

      <h2 className={h2Class}>1. Information We Collect</h2>
      <p className={pClass}>Depending on the services requested, we may collect:</p>
      <ul className={ulClass}>
        <li>Identity and contact information</li>
        <li>Business registration details</li>
        <li>Business ownership and representative information</li>
        <li>Merchant onboarding information</li>
        <li>Business licences and tax information</li>
        <li>Settlement beneficiary information</li>
        <li>Bank-account or mobile-wallet information</li>
        <li>Transaction and reconciliation records</li>
        <li>Support and communication records</li>
        <li>Device, IP and security-event information</li>
      </ul>

      <h2 className={h2Class}>2. Sensitive Information</h2>
      <p className={pClass}>
        Merchant onboarding may involve sensitive information, including identity, business, financial, or
        settlement details. This information receives additional protection and is only accessed and used for the
        purposes described in this policy.
      </p>

      <h2 className={h2Class}>3. How Information Is Collected</h2>
      <p className={pClass}>Information may be collected through:</p>
      <ul className={ulClass}>
        <li>The public inquiry form</li>
        <li>A protected onboarding portal</li>
        <li>Direct business communication</li>
        <li>Approved integration partners</li>
        <li>Transaction and settlement systems</li>
        <li>Support channels</li>
      </ul>

      <h2 className={h2Class}>4. How We Use Information</h2>
      <p className={pClass}>
        BizLink Africa coordinates the collection and preliminary review of merchant information. Final KYC
        verification, approval decisions, and account or till activation are carried out by the approved payment
        infrastructure partner, not by BizLink Africa. We use information to:
      </p>
      <ul className={ulClass}>
        <li>Conduct preliminary merchant assessment</li>
        <li>Coordinate KYC with the approved payment infrastructure partner</li>
        <li>Support account or till activation</li>
        <li>Provide payment integration</li>
        <li>Perform transaction reconciliation</li>
        <li>Facilitate merchant settlement</li>
        <li>Support fraud, AML and risk review</li>
        <li>Handle chargebacks and disputes</li>
        <li>Provide support</li>
        <li>Meet audit and legal compliance requirements</li>
      </ul>

      <h2 className={h2Class}>5. Information Sharing</h2>
      <p className={pClass}>We may share necessary information only with:</p>
      <ul className={ulClass}>
        <li>Approved payment infrastructure partners</li>
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

      <h2 className={h2Class}>6. Settlement Information</h2>
      <p className={pClass}>
        Where a merchant applies for payment infrastructure services, verified bank-account or mobile-wallet details
        may be processed for the purpose of merchant settlement. This information is used only to facilitate
        settlement in line with the applicable merchant arrangement and is not published or disclosed publicly.
      </p>

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
        KYC, transaction, settlement, chargeback, and audit information may be retained for as long as necessary to
        meet legal, contractual, and operational requirements.
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
        Our website and services may involve third-party providers, including hosting, analytics, communication, and
        approved payment infrastructure providers. BizLink Africa is not responsible for the independent privacy
        practices of third parties and does not disclose confidential third-party or partner agreement terms.
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
