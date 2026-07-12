import type { Metadata } from 'next';
import { COMPANY } from '@/data/website';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How BizLink Africa Limited collects, uses, and protects information gathered through our website and services.',
};

const h2Class = 'font-[Geist,sans-serif] font-bold text-xl text-[#00342b] mt-10 mb-3';
const pClass = 'text-[#3f4945] leading-relaxed';
const ulClass = 'list-disc pl-5 space-y-1 text-[#3f4945] leading-relaxed';

export default function PrivacyPolicyPage() {
  return (
    <section className="max-w-3xl mx-auto px-6 md:px-12 pt-20 pb-24">
      <h1 className="font-[Geist,sans-serif] font-bold text-3xl md:text-4xl text-[#1b1c1c] mb-2">Privacy Policy</h1>
      <p className="text-sm text-[#707975] mb-10">Last updated: July 2026</p>

      <h2 className={h2Class}>1. Introduction</h2>
      <p className={pClass}>
        BizLink Africa Limited respects user privacy and is committed to protecting personal information collected
        through the website, inquiry forms, onboarding communication, support channels, and business service
        requests.
      </p>

      <h2 className={h2Class}>2. Information We Collect</h2>
      <p className={pClass}>We may collect:</p>
      <ul className={ulClass}>
        <li>Full name</li>
        <li>Business or company name</li>
        <li>Business category or service offered</li>
        <li>Physical location</li>
        <li>Phone or WhatsApp number</li>
        <li>Email address</li>
        <li>Service requirements</li>
        <li>Inquiry notes</li>
        <li>Communication records</li>
        <li>Technical information such as browser, device, IP address, and website usage data</li>
      </ul>

      <h2 className={h2Class}>3. How We Use Information</h2>
      <p className={pClass}>We use information to:</p>
      <ul className={ulClass}>
        <li>Respond to inquiries</li>
        <li>Contact potential clients</li>
        <li>Manage offline onboarding</li>
        <li>Provide ICT consultation</li>
        <li>Prepare service proposals</li>
        <li>Configure automation and integration services</li>
        <li>Provide customer support</li>
        <li>Improve our website and services</li>
        <li>Maintain security and compliance records</li>
      </ul>

      <h2 className={h2Class}>4. Payment and Fund Handling</h2>
      <p className={pClass}>
        BizLink Africa Limited does not hold, receive, control, or settle client funds. Payment collection and
        settlement are handled directly between the client and the approved payment partner. BizLink Africa only
        provides ICT infrastructure and integration support.
      </p>

      <h2 className={h2Class}>5. Data Sharing</h2>
      <p className={pClass}>We may share necessary information only with:</p>
      <ul className={ulClass}>
        <li>Approved payment/integration partners when required for onboarding or technical setup</li>
        <li>Internal BizLink Africa staff</li>
        <li>Technical service providers supporting our systems</li>
        <li>Authorities where required by law</li>
      </ul>
      <p className={`${pClass} mt-3`}>We do not sell personal data.</p>

      <h2 className={h2Class}>6. Data Storage and Security</h2>
      <p className={pClass}>
        We use reasonable technical and organizational measures to protect personal information from unauthorized
        access, loss, misuse, or disclosure.
      </p>

      <h2 className={h2Class}>7. Data Retention</h2>
      <p className={pClass}>
        We keep inquiry, onboarding, support, and client records only as long as necessary for business, legal,
        operational, and compliance purposes.
      </p>

      <h2 className={h2Class}>8. User Rights</h2>
      <p className={pClass}>
        Users may contact BizLink Africa to request access, correction, or deletion of their personal information,
        subject to legal and operational requirements.
      </p>

      <h2 className={h2Class}>9. Cookies and Analytics</h2>
      <p className={pClass}>
        The website may use cookies or analytics tools to improve performance, security, and user experience.
      </p>

      <h2 className={h2Class}>10. Third-Party Links</h2>
      <p className={pClass}>
        Our website may link to third-party websites or services. BizLink Africa is not responsible for the privacy
        practices of those third parties.
      </p>

      <h2 className={h2Class}>11. Contact</h2>
      <p className={pClass}>For privacy questions, contact:</p>
      <ul className={`${ulClass} break-words`}>
        <li><a href={`mailto:${COMPANY.emailGeneral}`} className="text-[#00342b] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00342b] focus-visible:ring-offset-2 rounded-sm">{COMPANY.emailGeneral}</a></li>
        <li><a href={`mailto:${COMPANY.emailSupport}`} className="text-[#00342b] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00342b] focus-visible:ring-offset-2 rounded-sm">{COMPANY.emailSupport}</a></li>
        <li><a href={COMPANY.whatsappLink} target="_blank" rel="noopener noreferrer" className="text-[#00342b] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00342b] focus-visible:ring-offset-2 rounded-sm">{COMPANY.whatsapp}</a></li>
      </ul>
    </section>
  );
}
