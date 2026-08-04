import type { Metadata } from 'next';
import { COMPANY } from '@/data/website';

// Tanzanian legal review is recommended before publication of this document.

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms governing use of the BizLink Africa Limited website, ICT and automation services, and payment-integration support — each merchant controls their own payment account and settlement directly with the approved payment partner.',
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
        automation services and payment-integration support.
      </p>

      <h2 className={h2Class}>1. About BizLink Africa</h2>
      <p className={pClass}>
        BizLink Africa is an ICT solutions and integration-support company. BizLink Africa provides ICT
        infrastructure, automation and integration support. Each merchant has and manages their own payment
        account, wallet or till, and settlement happens directly between the merchant and the approved payment
        partner. BizLink Africa does not receive, hold, control, disburse or settle merchant funds.
      </p>

      <h2 className={h2Class}>2. Inquiry and Onboarding</h2>
      <p className={pClass}>
        Users agree to use the website lawfully and not misuse forms, systems, or communication channels.
        Submitting an inquiry does not guarantee approval or activation. BizLink Africa reviews inquiries and may
        contact the business for consultation, verification, and service planning. Merchant services are subject
        to:
      </p>
      <ul className={ulClass}>
        <li>Business verification</li>
        <li>KYC review</li>
        <li>Risk assessment</li>
        <li>Approval by the applicable payment partner</li>
        <li>A signed merchant agreement</li>
        <li>Settlement details verified directly with the approved payment partner</li>
      </ul>
      <p className={`${pClass} mt-3`}>
        Final payment-account activation and KYC approval are subject to the payment partner, not BizLink Africa.
      </p>

      <h2 className={h2Class}>3. Payment Integration Support</h2>
      <p className={pClass}>In connection with payment integration, BizLink may:</p>
      <ul className={ulClass}>
        <li>Coordinate onboarding</li>
        <li>Assist with API integration</li>
        <li>Configure technical connections</li>
        <li>Support testing and monitoring</li>
        <li>Assist with issue escalation</li>
      </ul>

      <h2 className={h2Class}>4. Merchant-Controlled Account</h2>
      <ul className={ulClass}>
        <li>The merchant owns and manages their payment account, wallet or till.</li>
        <li>The merchant supplies and maintains their settlement instructions directly with the approved payment partner.</li>
        <li>BizLink Africa does not hold or settle merchant funds.</li>
        <li>The merchant is responsible for checking their own transaction records and settlement information directly with the approved payment partner.</li>
      </ul>

      <h2 className={h2Class}>5. Merchant Responsibilities</h2>
      <p className={pClass}>Merchants are responsible for:</p>
      <ul className={ulClass}>
        <li>Providing accurate business information</li>
        <li>Maintaining lawful operations</li>
        <li>Cooperating with KYC requirements</li>
        <li>Protecting credentials</li>
        <li>Complying with the approved payment partner&apos;s rules</li>
        <li>Providing and maintaining accurate settlement details</li>
        <li>Cooperating on transaction and dispute matters</li>
      </ul>

      <h2 className={h2Class}>6. Fees</h2>
      <p className={pClass}>
        BizLink technology, integration and support fees are agreed privately with each client. Payment-partner
        transaction fees are governed by the merchant&apos;s applicable arrangement with that payment partner. These
        fees are not published on this website.
      </p>

      <h2 className={h2Class}>7. Third-Party Infrastructure</h2>
      <p className={pClass}>
        BizLink is not responsible for partner, bank, mobile-network or API outages outside its control. Service
        availability may depend on banks, mobile networks, APIs, payment infrastructure and other third parties,
        and BizLink Africa does not guarantee uninterrupted availability of these third-party systems.
      </p>

      <h2 className={h2Class}>8. No Custody of Funds</h2>
      <p className={pClass}>
        BizLink Africa Limited does not receive, hold, control, safeguard, disburse or settle merchant funds.
        Payment collection and settlement are handled directly through the merchant&apos;s account with the
        applicable approved payment partner.
      </p>
      <p className={`${pClass} mt-3`}>
        BizLink Africa has no authority over merchant settlement and cannot itself hold, delay or release merchant
        funds. Any review, hold, or delay affecting settlement is a matter solely between the merchant and the
        approved payment partner, under that partner&apos;s own policies.
      </p>

      <h2 className={h2Class}>9. Data Protection</h2>
      <p className={pClass}>
        Personal and business information is collected, used, and protected as described in our Privacy Policy,
        which forms part of these Terms of Service.
      </p>

      <h2 className={h2Class}>10. Confidentiality</h2>
      <p className={pClass}>
        Commercial rates, API information, and partner arrangements are confidential and are not disclosed
        publicly.
      </p>

      <h2 className={h2Class}>11. Intellectual Property</h2>
      <p className={pClass}>
        BizLink Africa branding, website content, designs, systems, and materials belong to BizLink Africa Limited
        unless otherwise stated.
      </p>

      <h2 className={h2Class}>12. Service Availability</h2>
      <p className={pClass}>
        BizLink Africa does not guarantee uninterrupted availability of its own ICT and integration services and
        may carry out maintenance, updates or changes to its systems from time to time.
      </p>

      <h2 className={h2Class}>13. Suspension and Termination</h2>
      <p className={pClass}>
        BizLink Africa may suspend or terminate its ICT or integration-support services where a user or merchant
        violates agreements, misuses systems, fails onboarding or eligibility requirements, or engages in unlawful
        or suspicious activity — including fraud, money laundering, terrorism financing, unauthorised transactions,
        impersonation, security circumvention, or misuse of payment channels.
      </p>

      <h2 className={h2Class}>14. Liability</h2>
      <p className={pClass}>
        BizLink Africa does not guarantee merchant approval or activation. To the extent permitted by law, BizLink
        Africa is not liable for indirect losses, lost profits, third-party platform failures, payment-partner
        issues, delays in settlement caused by third parties, or client-side misuse of systems.
      </p>
      <p className={`${pClass} mt-3`}>
        Merchants agree to indemnify BizLink Africa against losses, claims, or costs arising from inaccurate
        information, unauthorised or fraudulent activity, or breach of these Terms of Service by the merchant or
        its representatives.
      </p>

      <h2 className={h2Class}>15. Changes</h2>
      <p className={pClass}>
        BizLink Africa may update these Terms of Service, or change, suspend, or discontinue any part of its
        services, from time to time. Updated terms will be posted on the website.
      </p>

      <h2 className={h2Class}>16. Governing Law</h2>
      <p className={pClass}>
        These Terms of Service are governed by the laws of the United Republic of Tanzania. Any dispute arising from
        these Terms of Service or the use of BizLink Africa services will first be addressed through good-faith
        negotiation between the parties, and if unresolved, may be referred to the courts of Tanzania or another
        dispute resolution mechanism agreed between the parties.
      </p>

      <h2 className={h2Class}>17. Contact</h2>
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
