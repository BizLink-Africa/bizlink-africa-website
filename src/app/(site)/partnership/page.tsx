import type { Metadata } from 'next';
import { Shield, Wallet, ShieldOff, Building2, CheckCircle, ArrowRight } from 'lucide-react';
import SectionHeading from '@/components/website/SectionHeading';
import CTAButton from '@/components/website/CTAButton';
import ComplianceCard from '@/components/website/ComplianceCard';
import { PARTNERSHIP_FEATURES } from '@/data/website';

export const metadata: Metadata = {
  title: 'Partnership Approach',
  description: 'Learn how BizLink Africa Limited builds ICT infrastructure while you maintain full control of your funds through trusted payment partners.',
};

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Wallet, ShieldOff, Building2,
};

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Client Onboarding',
    desc: 'Your business is onboarded offline by the BizLink Africa team. All verification and documentation is handled in person.',
  },
  {
    step: '02',
    title: 'Merchant Wallet Setup',
    desc: 'You receive or maintain your own merchant wallet/account directly with the approved payment partner — no BizLink intermediary.',
  },
  {
    step: '03',
    title: 'BizLink Builds the Bridge',
    desc: 'We integrate your platform with the trusted payment infrastructure, automate your workflows, and provide ongoing technical support.',
  },
];

export default function PartnershipPage() {
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
              <Shield size={14} />
              Our Partnership Model
            </div>
            <h1 className="font-[Geist,sans-serif] font-bold text-4xl md:text-5xl leading-tight tracking-tight text-white mb-6">
              We Build the Bridge, You Maintain Control
            </h1>
            <p className="text-lg leading-relaxed text-[#c4c7c7] max-w-2xl">
              BizLink Africa Limited provides ICT infrastructure, automation systems, integration support, and technical enablement. Payment collection and settlement are handled directly between each client and the approved payment partner.
            </p>
          </div>
        </div>
      </section>

      {/* ── FEATURE CARDS ── */}
      <section className="py-20 bg-[#fbf9f8]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <SectionHeading
            badge="How We Work"
            title="Three Pillars of Our Partnership"
            subtitle="Every client relationship is built on these core principles."
            center
          />
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PARTNERSHIP_FEATURES.map((f) => {
              const Icon = ICONS[f.icon];
              return (
                <div key={f.title} className="border border-[#bfc9c4] bg-white p-8 hover:border-[#00342b] hover:shadow-sm transition-all duration-200">
                  <div className="w-12 h-12 bg-[#afefdd] flex items-center justify-center mb-5">
                    {Icon && <Icon size={24} className="text-[#00342b]" />}
                  </div>
                  <h3 className="font-[Geist,sans-serif] font-semibold text-xl text-[#1b1c1c] mb-3">{f.title}</h3>
                  <p className="text-sm text-[#3f4945] leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 bg-[#efeded]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <SectionHeading
            badge="The Process"
            title="How It Works"
            subtitle="Three simple steps from inquiry to live integration."
            center
          />
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step, idx) => (
              <div key={step.step} className="relative">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-14 h-14 bg-[#00342b] flex items-center justify-center font-[Geist,sans-serif] font-bold text-[#afefdd] text-lg">
                    {step.step}
                  </div>
                  <div>
                    <h3 className="font-[Geist,sans-serif] font-semibold text-[#1b1c1c] text-lg mb-2">{step.title}</h3>
                    <p className="text-sm text-[#3f4945] leading-relaxed">{step.desc}</p>
                  </div>
                </div>
                {idx < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden lg:block absolute top-7 left-[calc(56px+16px)] w-full h-px bg-[#bfc9c4]" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST ASSURANCES ── */}
      <section className="py-20 bg-[#fbf9f8]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <SectionHeading
                badge="Trust Assurances"
                title="Your Funds Are Always Under Your Control"
                subtitle="We hold zero client funds. Every settlement goes directly from your customers to your approved merchant account."
              />
              <div className="mt-8 flex flex-col gap-4">
                {[
                  'BizLink Africa Limited never receives or holds your funds.',
                  'All settlements go directly to your merchant wallet/account.',
                  'Payment partners are approved and regulated fintech providers.',
                  'Your merchant account is opened in your business name.',
                  'You have full visibility and control over your transactions.',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle size={17} className="text-[#00342b] mt-0.5 shrink-0" />
                    <p className="text-sm text-[#3f4945] leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <CTAButton href="/contact">Start Your Journey <ArrowRight size={16} /></CTAButton>
              </div>
            </div>

            {/* Visual */}
            <div className="bg-[#00342b] p-10 text-white">
              <div className="flex flex-col gap-6">
                {[
                  { icon: Wallet, title: 'Your Merchant Wallet', desc: 'Opened in your business name with the approved payment partner.' },
                  { icon: Shield, title: 'Regulated Infrastructure', desc: 'Connected to trusted, regulated fintech payment infrastructure.' },
                  { icon: Building2, title: 'BizLink as Integrator', desc: 'We build and maintain the technical integration — nothing more.' },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-4 border-b border-white/10 pb-5 last:border-0 last:pb-0">
                    <div className="w-9 h-9 bg-[#afefdd]/20 flex items-center justify-center shrink-0">
                      <Icon size={18} className="text-[#afefdd]" />
                    </div>
                    <div>
                      <p className="font-[Geist,sans-serif] font-semibold text-white text-sm mb-1">{title}</p>
                      <p className="text-xs text-[#c4c7c7] leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMPLIANCE SECTION ── */}
      <section className="py-16 bg-[#f5f3f3]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <ComplianceCard />
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="py-16 bg-[#2b2e2e] text-white text-center">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <h2 className="font-[Geist,sans-serif] font-semibold text-2xl md:text-3xl mb-4">
            Ready to get started?
          </h2>
          <p className="text-[#c4c7c7] mb-8 max-w-xl mx-auto">
            Contact the BizLink Africa team for a consultation. Our team handles all onboarding offline.
          </p>
          <CTAButton href="/contact" variant="white">Submit Inquiry</CTAButton>
        </div>
      </section>
    </>
  );
}
