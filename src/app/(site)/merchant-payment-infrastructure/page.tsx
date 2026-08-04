import type { Metadata } from 'next';
import {
  UserPlus, Plug, Globe, Settings, Webhook, Activity, LifeBuoy, BarChart3,
  ShieldCheck, AlertCircle, CheckCircle, ArrowRight, Building2, Smartphone,
} from 'lucide-react';
import SectionHeading from '@/components/website/SectionHeading';
import CTAButton from '@/components/website/CTAButton';

const BASE_URL = 'https://bizlinkafrica.net';
const PAGE_TITLE = 'Payment Integration Infrastructure';
const PAGE_DESCRIPTION =
  'BizLink Africa helps businesses coordinate onboarding and securely integrate with approved payment infrastructure. Each merchant maintains their own payment account or wallet and manages settlement directly with the payment partner.';
const PAGE_PATH = '/merchant-payment-infrastructure';

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: PAGE_PATH,
  },
  openGraph: {
    title: `${PAGE_TITLE} | BizLink Africa Limited`,
    description: PAGE_DESCRIPTION,
    url: PAGE_PATH,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${PAGE_TITLE} | BizLink Africa Limited`,
    description: PAGE_DESCRIPTION,
  },
};

const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: PAGE_TITLE,
  serviceType: 'Payment integration infrastructure coordination',
  description: PAGE_DESCRIPTION,
  provider: {
    '@type': 'Organization',
    name: 'BizLink Africa Limited',
    url: BASE_URL,
  },
  areaServed: 'TZ',
  url: `${BASE_URL}${PAGE_PATH}`,
};

const WHAT_WE_PROVIDE = [
  { icon: UserPlus, title: 'Merchant Onboarding Coordination', desc: 'We coordinate the onboarding process from inquiry through to activation.' },
  { icon: Plug, title: 'Payment API Integration', desc: 'Technical integration with approved payment infrastructure.' },
  { icon: Globe, title: 'Website, App and Social-Commerce Integration', desc: 'Connect payment integration to your website, app, and social-commerce channels.' },
  { icon: Settings, title: 'Technical Configuration', desc: 'We configure the technical setup required for your integration to function correctly.' },
  { icon: Webhook, title: 'Webhook and Transaction-Status Setup', desc: 'Webhook endpoints and transaction-status handling are configured for reliable, real-time updates.' },
  { icon: Activity, title: 'Integration Monitoring', desc: 'Ongoing monitoring of your integration uptime and technical health.' },
  { icon: LifeBuoy, title: 'Technical Support and Escalation', desc: 'A dedicated channel for support requests and issue escalation.' },
  { icon: BarChart3, title: 'Dashboard and Reporting Visibility', desc: 'Visibility into your integration activity through your BizLink dashboard, where authorised.' },
];

const MERCHANT_CONTROLLED_POINTS = [
  'Each merchant has their own payment account, wallet or till.',
  'Each merchant manages their own settlement details.',
  'Settlement is handled directly by the approved payment partner.',
  'BizLink does not receive or disburse merchant funds.',
];

const SETTLEMENT_DESTINATIONS = [
  { icon: Building2, title: 'Bank Account', desc: "Held in the merchant's own name and managed by the merchant." },
  { icon: Smartphone, title: 'Mobile Wallet or Till', desc: "Held in the merchant's own name and managed by the merchant." },
];

const ONBOARDING_STEPS = [
  { step: '01', title: 'Submit Inquiry', desc: 'Submit your business details through our public inquiry form.' },
  { step: '02', title: 'Business Consultation', desc: 'Our team reviews your business and discusses your payment integration needs.' },
  { step: '03', title: 'Offline KYC-Document Coordination', desc: 'Required verification documents are collected and coordinated securely offline — never through the public website.' },
  { step: '04', title: 'Submission to Approved Payment Partner', desc: 'Your business information is submitted to the approved payment partner for review.' },
  { step: '05', title: 'Partner Review and Approval', desc: 'The approved payment partner conducts final verification and approval. Approval is not guaranteed.' },
  { step: '06', title: 'Merchant Account/Till Creation', desc: 'Your merchant payment account or till is created directly by the approved payment partner.' },
  { step: '07', title: 'Technical Integration', desc: 'BizLink configures the technical integration between your systems and the payment partner.' },
  { step: '08', title: 'Testing and Activation', desc: 'The integration is tested before going live.' },
];

const COMPLIANCE_POINTS = [
  'Merchant verification is required.',
  'Final approval is controlled by the applicable payment partner.',
  'Sensitive documents are not uploaded through the public inquiry form.',
  'Partner credentials are protected.',
  'BizLink operates a zero-touch fund model — BizLink never receives, holds, controls or settles merchant funds.',
];

export default function MerchantPaymentInfrastructurePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-[#00342b] py-24">
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)', backgroundSize: '40px 40px' }}
        />
        <div className="max-w-[1280px] mx-auto px-6 md:px-12 relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#afefdd]/20 text-[#afefdd] text-xs font-semibold rounded-full mb-6 uppercase tracking-wider">
              <ShieldCheck size={14} />
              Payment Integration
            </div>
            <h1 className="font-[Geist,sans-serif] font-bold text-4xl md:text-5xl leading-tight tracking-tight text-white mb-6">
              Connect Your Business to Trusted Payment Infrastructure
            </h1>
            <p className="text-lg leading-relaxed text-[#c4c7c7] max-w-2xl mb-8">
              {PAGE_DESCRIPTION}
            </p>
            <CTAButton href="/contact" variant="white">Request Payment Integration Support</CTAButton>
          </div>
        </div>
      </section>

      {/* ── 1. WHAT BIZLINK PROVIDES ── */}
      <section className="py-20 bg-[#fbf9f8]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <SectionHeading
            badge="What BizLink Provides"
            title="What BizLink Provides"
            subtitle="End-to-end coordination and technical support for connecting your business to approved payment infrastructure."
            center
          />
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHAT_WE_PROVIDE.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="border border-[#bfc9c4] bg-white p-6 hover:border-[#00342b] hover:shadow-sm transition-all duration-200">
                <div className="w-11 h-11 bg-[#afefdd] flex items-center justify-center mb-4">
                  <Icon size={22} className="text-[#00342b]" />
                </div>
                <h3 className="font-[Geist,sans-serif] font-semibold text-[#1b1c1c] text-base mb-2">{title}</h3>
                <p className="text-sm text-[#3f4945] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 2. MERCHANT-CONTROLLED ACCOUNTS ── */}
      <section className="py-20 bg-[#00342b] text-white">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <SectionHeading
            badge="Merchant-Controlled Accounts"
            title="Merchant-Controlled Accounts"
            subtitle="Every merchant owns and manages their own payment account — BizLink Africa never receives or disburses merchant funds."
            center
            light
          />
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            <div className="flex flex-col gap-4">
              {MERCHANT_CONTROLLED_POINTS.map((item) => (
                <div key={item} className="flex items-start gap-3 border border-white/20 bg-white/5 p-5 backdrop-blur-sm">
                  <CheckCircle size={17} className="text-[#afefdd] mt-0.5 shrink-0" />
                  <p className="text-sm text-[#c4c7c7] leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {SETTLEMENT_DESTINATIONS.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="border border-white/20 bg-white/5 p-6 text-center backdrop-blur-sm">
                  <div className="w-12 h-12 bg-[#afefdd]/20 flex items-center justify-center mb-4 mx-auto">
                    <Icon size={22} className="text-[#afefdd]" />
                  </div>
                  <h3 className="font-[Geist,sans-serif] font-semibold text-white text-base mb-2">{title}</h3>
                  <p className="text-xs text-[#c4c7c7] leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. ONBOARDING PROCESS ── */}
      <section className="py-20 bg-[#efeded]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <SectionHeading
            badge="The Process"
            title="Onboarding Process"
            subtitle="From inquiry to activation, every step is coordinated on your behalf."
            center
          />
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
            {ONBOARDING_STEPS.map((step) => (
              <div key={step.step} className="flex items-start gap-4">
                <div className="shrink-0 w-12 h-12 bg-[#00342b] flex items-center justify-center font-[Geist,sans-serif] font-bold text-[#afefdd] text-sm">
                  {step.step}
                </div>
                <div>
                  <h3 className="font-[Geist,sans-serif] font-semibold text-[#1b1c1c] text-base mb-1">{step.title}</h3>
                  <p className="text-sm text-[#3f4945] leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. SECURITY AND COMPLIANCE ── */}
      <section className="py-20 bg-[#f5f3f3]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <SectionHeading
            badge="Security & Compliance"
            title="Security and Compliance"
            subtitle="Payment integration infrastructure operates under defined controls and review requirements."
            center
          />
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
            {COMPLIANCE_POINTS.map((item) => (
              <div key={item} className="flex items-start gap-3 border border-[#bfc9c4] bg-white p-5">
                <AlertCircle size={17} className="text-[#00342b] mt-0.5 shrink-0" />
                <p className="text-sm text-[#3f4945] leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-xs text-[#707975] text-center max-w-2xl mx-auto">
            This page provides a general overview of our payment integration infrastructure services. Approval, activation and settlement are subject to review, KYC outcomes and the approved payment partner&apos;s terms, and are not guaranteed.
          </p>
        </div>
      </section>

      {/* ── 5. CALL TO ACTION ── */}
      <section className="py-20 bg-[#2b2e2e] text-white text-center">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#afefdd]/20 text-[#afefdd] text-xs font-semibold rounded-full mb-6 uppercase tracking-wider">
            <CheckCircle size={14} />
            Get Started
          </div>
          <h2 className="font-[Geist,sans-serif] font-semibold text-2xl md:text-3xl mb-4">
            Ready to integrate trusted payment infrastructure?
          </h2>
          <p className="text-[#c4c7c7] mb-8 max-w-xl mx-auto">
            Submit an inquiry and our team will guide you through onboarding and integration — settlement happens directly between you and your payment partner.
          </p>
          <CTAButton href="/contact" variant="white" icon={<ArrowRight size={16} />}>
            Request Payment Integration Support
          </CTAButton>
        </div>
      </section>
    </>
  );
}
