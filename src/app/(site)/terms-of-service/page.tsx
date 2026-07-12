import type { Metadata } from 'next';
import { COMPANY } from '@/data/website';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms governing use of the BizLink Africa Limited website and services.',
};

const h2Class = 'font-[Geist,sans-serif] font-bold text-xl text-[#00342b] mt-10 mb-3';
const pClass = 'text-[#3f4945] leading-relaxed';
const ulClass = 'list-disc pl-5 space-y-1 text-[#3f4945] leading-relaxed';

export default function TermsOfServicePage() {
  return (
    <section className="max-w-3xl mx-auto px-6 md:px-12 pt-20 pb-24">
      <h1 className="font-[Geist,sans-serif] font-bold text-3xl md:text-4xl text-[#1b1c1c] mb-2">Terms of Service</h1>
      <p className="text-sm text-[#707975] mb-10">Last updated: July 2026</p>

      <h2 className={h2Class}>1. Introduction</h2>
      <p className={pClass}>
        These Terms of Service govern the use of the BizLink Africa Limited website and services.
      </p>

      <h2 className={h2Class}>2. About BizLink Africa</h2>
      <p className={pClass}>
        BizLink Africa Limited is an ICT solutions company offering technology consulting, AI automation, social
        commerce automation, e-commerce setup, CRM/workflow automation, system/API integration, and payment
        integration support through trusted payment partners.
      </p>

      <h2 className={h2Class}>3. Use of Website</h2>
      <p className={pClass}>
        Users agree to use the website lawfully and not misuse forms, systems, or communication channels.
      </p>

      <h2 className={h2Class}>4. Inquiries and Onboarding</h2>
      <p className={pClass}>
        Submitting an inquiry does not create a binding contract. BizLink Africa reviews inquiries and may contact
        the business for offline onboarding, consultation, negotiation, and service planning.
      </p>

      <h2 className={h2Class}>5. No Public Pricing</h2>
      <p className={pClass}>
        BizLink Africa does not display fixed public pricing. Service scope, pricing, and implementation terms are
        discussed and agreed privately with each client.
      </p>

      <h2 className={h2Class}>6. Payment Integration Support</h2>
      <p className={pClass}>
        BizLink Africa may provide ICT support for payment integration through approved payment partners. BizLink
        Africa does not hold, receive, control, or settle client funds. Each client is responsible for their own
        payment partner account, wallet, compliance requirements, and settlements.
      </p>

      <h2 className={h2Class}>7. Client Responsibilities</h2>
      <p className={pClass}>Clients are responsible for:</p>
      <ul className={ulClass}>
        <li>Providing accurate business information</li>
        <li>Completing offline onboarding requirements</li>
        <li>Maintaining lawful business operations</li>
        <li>Protecting login credentials</li>
        <li>Reviewing and approving service requirements</li>
        <li>Complying with applicable laws and payment partner requirements</li>
      </ul>

      <h2 className={h2Class}>8. Service Availability</h2>
      <p className={pClass}>
        BizLink Africa aims to provide reliable ICT services but does not guarantee uninterrupted availability of
        websites, dashboards, APIs, third-party platforms, or partner systems.
      </p>

      <h2 className={h2Class}>9. Third-Party Services</h2>
      <p className={pClass}>
        Some services may depend on third-party platforms, APIs, hosting providers, AI tools, payment partners, or
        communication channels. BizLink Africa is not responsible for outages, rule changes, or failures caused by
        third parties.
      </p>

      <h2 className={h2Class}>10. Intellectual Property</h2>
      <p className={pClass}>
        BizLink Africa branding, website content, designs, systems, and materials belong to BizLink Africa Limited
        unless otherwise stated.
      </p>

      <h2 className={h2Class}>11. Limitation of Liability</h2>
      <p className={pClass}>
        BizLink Africa is not liable for indirect losses, lost profits, third-party platform failures, payment
        partner issues, or client-side misuse of systems.
      </p>

      <h2 className={h2Class}>12. Termination</h2>
      <p className={pClass}>
        BizLink Africa may suspend or terminate services where a client violates agreements, misuses systems, fails
        onboarding requirements, or engages in unlawful activity.
      </p>

      <h2 className={h2Class}>13. Changes to Terms</h2>
      <p className={pClass}>
        BizLink Africa may update these Terms of Service from time to time. Updated terms will be posted on the
        website.
      </p>

      <h2 className={h2Class}>14. Contact</h2>
      <p className={pClass}>For questions, contact:</p>
      <ul className={`${ulClass} break-words`}>
        <li><a href={`mailto:${COMPANY.emailGeneral}`} className="text-[#00342b] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00342b] focus-visible:ring-offset-2 rounded-sm">{COMPANY.emailGeneral}</a></li>
        <li><a href={`mailto:${COMPANY.emailSupport}`} className="text-[#00342b] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00342b] focus-visible:ring-offset-2 rounded-sm">{COMPANY.emailSupport}</a></li>
        <li><a href={COMPANY.whatsappLink} target="_blank" rel="noopener noreferrer" className="text-[#00342b] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00342b] focus-visible:ring-offset-2 rounded-sm">{COMPANY.whatsapp}</a></li>
      </ul>
    </section>
  );
}
