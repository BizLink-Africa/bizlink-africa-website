import type { Metadata } from 'next';
import { COMPANY } from '@/data/website';

// Requires review by qualified Tanzanian legal counsel before publication.

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms governing use of the BizLink Africa Limited website, ICT services, merchant onboarding, payment-integration, reconciliation and settlement services.',
};

const h2Class = 'font-[Geist,sans-serif] font-bold text-xl text-[#00342b] mt-10 mb-3';
const pClass = 'text-[#3f4945] leading-relaxed';
const ulClass = 'list-disc pl-5 space-y-1 text-[#3f4945] leading-relaxed';

export default function TermsOfServicePage() {
  return (
    <section className="max-w-3xl mx-auto px-6 md:px-12 pt-20 pb-24">
      <h1 className="font-[Geist,sans-serif] font-bold text-3xl md:text-4xl text-[#1b1c1c] mb-2">Terms of Service</h1>
      <p className="text-sm text-[#707975] mb-10">Last updated: July 2026</p>

      <p className={pClass}>
        These Terms of Service govern the use of the BizLink Africa Limited website and services, including ICT
        automation services and merchant payment-infrastructure services.
      </p>

      <h2 className={h2Class}>1. About BizLink Africa</h2>
      <p className={pClass}>
        BizLink Africa is an ICT, automation, merchant onboarding, payment-integration, reconciliation and
        settlement-management company.
      </p>

      <h2 className={h2Class}>2. Website Use</h2>
      <p className={pClass}>
        Users agree to use the website lawfully and not misuse forms, systems, or communication channels.
      </p>

      <h2 className={h2Class}>3. Inquiry Does Not Create a Contract</h2>
      <p className={pClass}>
        Submitting an inquiry does not guarantee onboarding, approval or service activation. BizLink Africa reviews
        inquiries and may contact the business for consultation, verification, negotiation, and service planning.
      </p>

      <h2 className={h2Class}>4. Merchant Eligibility</h2>
      <p className={pClass}>Merchant services are subject to:</p>
      <ul className={ulClass}>
        <li>Business verification</li>
        <li>KYC review</li>
        <li>Risk assessment</li>
        <li>Applicable partner approval</li>
        <li>Signed merchant agreement</li>
        <li>Settlement beneficiary verification</li>
      </ul>

      <h2 className={h2Class}>5. Merchant Onboarding</h2>
      <p className={pClass}>
        BizLink coordinates onboarding, while final verification and till/payment-account activation may be
        performed by an approved payment infrastructure partner.
      </p>

      <h2 className={h2Class}>6. Merchant Responsibilities</h2>
      <p className={pClass}>Merchants are responsible for:</p>
      <ul className={ulClass}>
        <li>Providing accurate information</li>
        <li>Maintaining lawful operations</li>
        <li>Using services only for approved business activities</li>
        <li>Protecting credentials</li>
        <li>Supplying requested transaction evidence</li>
        <li>Notifying BizLink of ownership, address or beneficiary changes</li>
        <li>Following applicable payment and network rules</li>
        <li>Cooperating with fraud, chargeback or regulatory investigations</li>
      </ul>

      <h2 className={h2Class}>7. Prohibited Activities</h2>
      <p className={pClass}>Users and merchants must not use our services for:</p>
      <ul className={ulClass}>
        <li>Fraud</li>
        <li>Money laundering</li>
        <li>Terrorism financing</li>
        <li>Illegal products or services</li>
        <li>Unauthorised transactions</li>
        <li>Impersonation</li>
        <li>Security circumvention</li>
        <li>Unsolicited messaging</li>
        <li>Misuse of payment channels</li>
        <li>Infringement of intellectual property</li>
      </ul>

      <h2 className={h2Class}>8. Fees and Commercial Terms</h2>
      <p className={pClass}>
        Rates, commissions, service fees, settlement charges and other commercial terms are agreed privately in the
        applicable merchant agreement or proposal. BizLink Africa does not display fixed public pricing, and actual
        rates and commercial terms are not published on this website.
      </p>

      <h2 className={h2Class}>9. Collections and Settlement</h2>
      <p className={pClass}>
        BizLink Africa is not a bank or licensed payment service provider and does not act as a custodian of client
        funds. In connection with merchant payment-infrastructure services:
      </p>
      <ul className={ulClass}>
        <li>Transactions are reconciled before settlement.</li>
        <li>Settlement is made to a verified merchant bank account or mobile wallet.</li>
        <li>Settlement timing is governed by agreed schedules, cut-off times, successful reconciliation and service availability.</li>
        <li>BizLink may deduct contractually agreed fees, commissions, chargebacks, reversals or authorised adjustments.</li>
        <li>Unreconciled or suspicious transactions may be held for review.</li>
        <li>Incorrect beneficiary information may delay settlement.</li>
      </ul>

      <h2 className={h2Class}>10. Chargebacks, Reversals and Refunds</h2>
      <p className={pClass}>
        Merchants must cooperate with chargeback, reversal and refund processes, including promptly supplying
        transaction evidence and other information reasonably requested by BizLink Africa or the approved payment
        infrastructure partner. Amounts subject to a valid chargeback, reversal or refund may be deducted from
        current or future settlement.
      </p>

      <h2 className={h2Class}>11. Settlement Holds</h2>
      <p className={pClass}>BizLink may delay or hold settlement where:</p>
      <ul className={ulClass}>
        <li>KYC is incomplete</li>
        <li>Information is inaccurate</li>
        <li>Suspicious activity is detected</li>
        <li>Transactions are disputed</li>
        <li>Reconciliation fails</li>
        <li>Required evidence is missing</li>
        <li>A legal or partner instruction applies</li>
      </ul>

      <h2 className={h2Class}>12. Third-Party Infrastructure</h2>
      <p className={pClass}>
        Service availability may depend on banks, mobile networks, APIs, payment infrastructure and other third
        parties. BizLink Africa does not guarantee uninterrupted service availability and is not responsible for
        outages, rule changes, or failures caused by third parties.
      </p>

      <h2 className={h2Class}>13. Confidentiality</h2>
      <p className={pClass}>
        Commercial rates, API information, settlement processes and partner arrangements are confidential and are
        not disclosed publicly.
      </p>

      <h2 className={h2Class}>14. Data Protection</h2>
      <p className={pClass}>
        Personal and business information is collected, used, and protected as described in our Privacy Policy,
        which forms part of these Terms of Service.
      </p>

      <h2 className={h2Class}>15. Intellectual Property</h2>
      <p className={pClass}>
        BizLink Africa branding, website content, designs, systems, and materials belong to BizLink Africa Limited
        unless otherwise stated.
      </p>

      <h2 className={h2Class}>16. Suspension and Termination</h2>
      <p className={pClass}>
        BizLink Africa may suspend or terminate services, including merchant payment-infrastructure services, where
        a user or merchant violates agreements, misuses systems, fails onboarding or eligibility requirements, or
        engages in unlawful or suspicious activity.
      </p>

      <h2 className={h2Class}>17. Limitation of Liability</h2>
      <p className={pClass}>
        BizLink Africa does not guarantee merchant approval or activation. To the extent permitted by law, BizLink
        Africa is not liable for indirect losses, lost profits, third-party platform failures, payment infrastructure
        partner issues, delays in settlement caused by third parties, or client-side misuse of systems.
      </p>

      <h2 className={h2Class}>18. Indemnity</h2>
      <p className={pClass}>
        Merchants agree to indemnify BizLink Africa against losses, claims, or costs arising from inaccurate
        information, unauthorised or fraudulent activity, or breach of these Terms of Service by the merchant or its
        representatives.
      </p>

      <h2 className={h2Class}>19. Changes to Services or Terms</h2>
      <p className={pClass}>
        BizLink Africa may update these Terms of Service, or change, suspend, or discontinue any part of its
        services, from time to time. Updated terms will be posted on the website.
      </p>

      {/* Governing law and dispute resolution wording — flagged separately for legal review before publication. */}
      <h2 className={h2Class}>20. Governing Law and Dispute Resolution</h2>
      <p className={pClass}>
        These Terms of Service are governed by the laws of the United Republic of Tanzania. Any dispute arising from
        these Terms of Service or the use of BizLink Africa services will first be addressed through good-faith
        negotiation between the parties, and if unresolved, may be referred to the courts of Tanzania or another
        dispute resolution mechanism agreed between the parties.
      </p>

      <h2 className={h2Class}>21. Contact Details</h2>
      <p className={pClass}>For questions, contact:</p>
      <ul className={`${ulClass} break-words`}>
        <li><a href={`mailto:${COMPANY.emailGeneral}`} className="text-[#00342b] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00342b] focus-visible:ring-offset-2 rounded-sm">{COMPANY.emailGeneral}</a></li>
        <li><a href={`mailto:${COMPANY.emailSupport}`} className="text-[#00342b] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00342b] focus-visible:ring-offset-2 rounded-sm">{COMPANY.emailSupport}</a></li>
        <li><a href={COMPANY.phoneLink} className="text-[#00342b] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00342b] focus-visible:ring-offset-2 rounded-sm">{COMPANY.phone}</a> (also WhatsApp)</li>
        <li>{COMPANY.address}</li>
      </ul>
    </section>
  );
}
