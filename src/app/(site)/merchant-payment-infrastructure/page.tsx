import type { Metadata } from 'next';
import {
  UserPlus, Plug, Wallet, Activity, RefreshCw, Landmark, Banknote,
  FileText, LifeBuoy, ShieldCheck, AlertCircle, CheckCircle, ArrowRight,
  Building2, Smartphone,
} from 'lucide-react';
import SectionHeading from '@/components/website/SectionHeading';
import CTAButton from '@/components/website/CTAButton';

const PAGE_TITLE = 'Merchant Payment Infrastructure';
const PAGE_DESCRIPTION =
  'BizLink Africa coordinates merchant onboarding, payment API integration, transaction reconciliation and settlement management through approved payment infrastructure partners.';
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

const WHAT_WE_PROVIDE = [
  { icon: UserPlus, title: 'Merchant Onboarding Coordination', desc: 'We coordinate the onboarding process from inquiry through to activation.' },
  { icon: Plug, title: 'Payment API Integration', desc: 'Technical integration with approved payment infrastructure partners.' },
  { icon: Wallet, title: 'Merchant Till/Payment-Account Setup Coordination', desc: 'Coordination of till or payment-account setup with the approved partner.' },
  { icon: Activity, title: 'Transaction Monitoring', desc: 'Ongoing visibility into your merchant transaction activity.' },
  { icon: RefreshCw, title: 'Daily Reconciliation', desc: 'Collections are reconciled against transaction records daily.' },
  { icon: Landmark, title: 'Merchant Settlement Management', desc: 'We manage the settlement process on your behalf.' },
  { icon: Banknote, title: 'Bank and Mobile-Wallet Payout Support', desc: 'Settlement to verified bank accounts or mobile wallets.' },
  { icon: FileText, title: 'Merchant Statements and Reporting', desc: 'Regular statements and reporting on your transaction activity.' },
  { icon: LifeBuoy, title: 'Support and Issue Escalation', desc: 'A dedicated channel for support requests and issue escalation.' },
];

const ONBOARDING_STEPS = [
  { step: '01', title: 'Merchant Inquiry', desc: 'Submit an inquiry through our contact form.' },
  { step: '02', title: 'BizLink Pre-Screening', desc: 'Our team reviews your business information for fit.' },
  { step: '03', title: 'Secure Submission of Required Information', desc: 'Provide the business information required to proceed.' },
  { step: '04', title: 'Final KYC Review by Approved Partner', desc: 'The approved payment infrastructure partner conducts final verification.' },
  { step: '05', title: 'Till/Payment-Account Creation', desc: 'Your merchant till or payment account is created by the approved partner.' },
  { step: '06', title: 'Technical Configuration', desc: 'We configure the technical integration for your business.' },
  { step: '07', title: 'Settlement Beneficiary Verification', desc: 'Your settlement bank account or mobile wallet is verified.' },
  { step: '08', title: 'Testing and Activation', desc: 'The integration is tested before going live.' },
];

const SETTLEMENT_STEPS = [
  { step: '01', title: 'Collection Transactions Recorded', desc: 'Merchant collections are logged as they occur.' },
  { step: '02', title: 'Transactions Matched to Merchant', desc: 'Each transaction is matched to the correct merchant account.' },
  { step: '03', title: 'Applicable Fees Calculated', desc: 'Applicable processing fees are calculated in line with agreed merchant terms.' },
  { step: '04', title: 'Eligible Amounts Reconciled', desc: 'Eligible collections are reconciled ahead of settlement.' },
  { step: '05', title: 'Settlement Batch Prepared', desc: 'Reconciled amounts are grouped into a settlement batch.' },
  { step: '06', title: 'Authorised Review and Approval', desc: 'Settlement batches are reviewed and approved before payout.' },
  { step: '07', title: 'Settlement Sent to Verified Merchant Destination', desc: 'The settlement amount is disbursed to your verified bank account or mobile wallet.' },
  { step: '08', title: 'Merchant Statement Issued', desc: 'A statement reflecting the settlement is made available to you.' },
];

const SETTLEMENT_DESTINATIONS = [
  { icon: Building2, title: 'Verified Bank Account', desc: "Settlement is made to a verified beneficiary bank account in the merchant's name." },
  { icon: Smartphone, title: 'Verified Mobile Wallet', desc: "Settlement is made to a verified beneficiary mobile wallet in the merchant's name." },
];

const COMPLIANCE_POINTS = [
  'Final activation depends on successful KYC completion by the approved payment infrastructure partner.',
  'Settlement details must be verified before payouts are made.',
  'Transactions may be held for review where required.',
  'Chargebacks, reversals or disputes may affect settlement amounts or timing.',
  'Commercial and partner arrangements are confidential and not published.',
  'All reconciliation and settlement activity is subject to audit and reconciliation controls.',
];

export default function MerchantPaymentInfrastructurePage() {
  return (
    <>
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
              Merchant Services
            </div>
            <h1 className="font-[Geist,sans-serif] font-bold text-4xl md:text-5xl leading-tight tracking-tight text-white mb-6">
              Simplify Collections, Reconciliation and Merchant Settlement
            </h1>
            <p className="text-lg leading-relaxed text-[#c4c7c7] max-w-2xl mb-8">
              BizLink Africa helps businesses and merchants access structured payment infrastructure through approved technology partners. We coordinate onboarding, technical integration, collection visibility, reconciliation and settlement operations.
            </p>
            <CTAButton href="/contact" variant="white">Apply for Merchant Payment Infrastructure</CTAButton>
          </div>
        </div>
      </section>

      {/* ── WHAT WE PROVIDE ── */}
      <section className="py-20 bg-[#fbf9f8]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <SectionHeading
            badge="What We Provide"
            title="Structured Payment Infrastructure for Merchants"
            subtitle="End-to-end coordination across onboarding, integration, reconciliation and settlement."
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

      {/* ── HOW MERCHANT ONBOARDING WORKS ── */}
      <section className="py-20 bg-[#efeded]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <SectionHeading
            badge="The Process"
            title="How Merchant Onboarding Works"
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

      {/* ── MERCHANT SETTLEMENT PROCESS ── */}
      <section className="py-20 bg-[#fbf9f8]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <SectionHeading
            badge="Settlement"
            title="Merchant Settlement Process"
            subtitle="Collections are reconciled and settled according to your agreed merchant terms and schedules."
            center
          />
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
            {SETTLEMENT_STEPS.map((step) => (
              <div key={step.step} className="flex items-start gap-4">
                <div className="shrink-0 w-12 h-12 bg-[#afefdd] flex items-center justify-center font-[Geist,sans-serif] font-bold text-[#00342b] text-sm">
                  {step.step}
                </div>
                <div>
                  <h3 className="font-[Geist,sans-serif] font-semibold text-[#1b1c1c] text-base mb-1">{step.title}</h3>
                  <p className="text-sm text-[#3f4945] leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-10 text-xs text-[#707975] text-center max-w-2xl mx-auto">
            Settlement timing follows agreed merchant terms and applicable review requirements and is not guaranteed to be immediate.
          </p>
        </div>
      </section>

      {/* ── SETTLEMENT DESTINATIONS ── */}
      <section className="py-16 bg-white">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <SectionHeading
            badge="Settlement Destinations"
            title="Settlement Destinations"
            subtitle="Settlement is only ever made to a verified beneficiary you control."
            center
          />
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {SETTLEMENT_DESTINATIONS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="border border-[#bfc9c4] bg-[#fbf9f8] p-6 text-center">
                <div className="w-12 h-12 bg-[#afefdd] flex items-center justify-center mb-4 mx-auto">
                  <Icon size={22} className="text-[#00342b]" />
                </div>
                <h3 className="font-[Geist,sans-serif] font-semibold text-[#1b1c1c] text-base mb-2">{title}</h3>
                <p className="text-sm text-[#3f4945] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPLIANCE AND SECURITY ── */}
      <section className="py-20 bg-[#f5f3f3]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <SectionHeading
            badge="Compliance & Security"
            title="Compliance and Security"
            subtitle="Merchant payment infrastructure operates under defined controls and review requirements."
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
            This page provides a general overview of our merchant payment infrastructure services. Approval, activation and settlement are subject to review, KYC outcomes and agreed merchant terms, and are not guaranteed.
          </p>
        </div>
      </section>

      {/* ── CALL TO ACTION ── */}
      <section className="py-20 bg-[#2b2e2e] text-white text-center">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#afefdd]/20 text-[#afefdd] text-xs font-semibold rounded-full mb-6 uppercase tracking-wider">
            <CheckCircle size={14} />
            Get Started
          </div>
          <h2 className="font-[Geist,sans-serif] font-semibold text-2xl md:text-3xl mb-4">
            Ready to structure your merchant payments?
          </h2>
          <p className="text-[#c4c7c7] mb-8 max-w-xl mx-auto">
            Submit an inquiry and our team will guide you through onboarding, integration, reconciliation and settlement.
          </p>
          <CTAButton href="/contact" variant="white" icon={<ArrowRight size={16} />}>
            Apply for Merchant Payment Infrastructure
          </CTAButton>
        </div>
      </section>
    </>
  );
}
