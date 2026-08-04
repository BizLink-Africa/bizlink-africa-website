import type { Metadata } from 'next';
import Image from 'next/image';
import { Bot, ShoppingBag, CreditCard, Workflow, Laptop, MessageCircle, ShoppingCart, Users, ArrowRightLeft, CheckCircle, ArrowRight } from 'lucide-react';
import CTAButton from '@/components/website/CTAButton';
import ComplianceCard from '@/components/website/ComplianceCard';
import { SOLUTIONS } from '@/data/website';

const SOLUTION_IMAGES: Record<string, string> = {
  'ai-agents': '/ai-agents.png',
  'social-commerce': '/social-commerce.png',
  'workflow-automation': '/workflow-automation.jpg',
  'ict-consulting': '/ict-consulting.jpg',
  'whatsapp-business': '/whatsapp-business.jpg',
  'ecommerce': '/ecommerce-setup.jpg',
  'crm-automation': '/crm-automation.jpg',
  'system-integration': '/system-integration.jpg',
};

export const metadata: Metadata = {
  title: 'Our Solutions',
  description: 'Explore BizLink Africa Limited solutions: AI agents, social commerce automation, payment integration support, workflow automation, and ICT consulting.',
};

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Bot, ShoppingBag, CreditCard, Workflow, Laptop, MessageCircle, ShoppingCart, Users, ArrowRightLeft,
};

export default function SolutionsPage() {
  return (
    <>
      {/* ── HERO ── */}
      <section className="pt-20 pb-16 px-6 md:px-12 max-w-[1280px] mx-auto">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#afefdd] text-[#065043] text-xs font-semibold rounded-full mb-6 uppercase tracking-wider">
            Enterprise Reliability
          </div>
          <h1 className="font-[Geist,sans-serif] font-bold text-4xl md:text-5xl leading-tight tracking-tight text-[#00342b] mb-6">
            Technological Infrastructure for the African Century.
          </h1>
          <p className="text-lg leading-relaxed text-[#3f4945] max-w-2xl">
            We design and deploy high-performance automation systems that empower businesses across East Africa to scale with security, precision, and confidence.
          </p>
        </div>
      </section>

      {/* ── SOLUTIONS ── */}
      <main className="max-w-[1280px] mx-auto px-6 md:px-12 pb-20">
        {SOLUTIONS.map((sol, idx) => {
          const Icon = ICONS[sol.icon];
          const isEven = idx % 2 === 0;

          return (
            <section key={sol.id} className={`mb-24 ${idx === 2 ? '' : ''}`}>
              {/* Section 3 (workflow automation) gets dark treatment */}
              {idx === 2 ? (
                <div className="bg-[#414444] text-white p-10 md:p-14 relative overflow-hidden">
                  <div
                    className="absolute inset-0 opacity-5 pointer-events-none"
                    style={{ backgroundImage: 'linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)', backgroundSize: '40px 40px' }}
                  />
                  <div className="relative z-10">
                    <div className="text-center max-w-2xl mx-auto mb-12">
                      <div className="w-12 h-12 bg-[#afefdd]/20 flex items-center justify-center mx-auto mb-4">
                        {Icon && <Icon size={24} className="text-[#afefdd]" />}
                      </div>
                      <h2 className="font-[Geist,sans-serif] font-semibold text-2xl md:text-3xl text-white mb-4">{sol.title}</h2>
                      <p className="text-[#c4c7c7] leading-relaxed">{sol.description}</p>
                    </div>
                    {/* Tech flow */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 max-w-3xl mx-auto mb-12">
                      {[
                        { label: 'Raw Input', icon: '→' },
                        null,
                        { label: 'BizLink Engine', icon: '⚙' },
                        null,
                        { label: 'Automated Result', icon: '✓' },
                      ].map((item, i) =>
                        item === null ? (
                          <div key={i} className="hidden md:flex flex-1 items-center">
                            <div className="tech-flow-line w-full" />
                          </div>
                        ) : (
                          <div key={item.label} className="flex flex-col items-center gap-3 text-center">
                            <div className="w-16 h-16 rounded-full border-2 border-[#94d3c1] flex items-center justify-center bg-[#2b2e2e] text-2xl text-[#94d3c1]">
                              {item.icon}
                            </div>
                            <span className="text-xs font-semibold uppercase tracking-widest text-[#c4c7c7]">{item.label}</span>
                          </div>
                        )
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {sol.features.map((f) => (
                        <div key={f} className="border-l-2 border-[#94d3c1] pl-5">
                          <p className="text-sm text-[#c4c7c7] leading-relaxed">{f}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-10 text-center">
                      <CTAButton href="/contact" variant="white">Request Service</CTAButton>
                    </div>
                  </div>
                </div>
              ) : (
                /* Standard 2-col layout, alternating sides */
                <div className={`grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center ${!isEven ? 'md:[&>div:first-child]:order-2' : ''}`}>
                  <div>
                    <div className="w-12 h-12 bg-[#afefdd] flex items-center justify-center mb-5">
                      {Icon && <Icon size={24} className="text-[#00342b]" />}
                    </div>
                    <h2 className="font-[Geist,sans-serif] font-semibold text-2xl md:text-3xl text-[#00342b] mb-4">{sol.title}</h2>
                    <p className="text-[#3f4945] leading-relaxed mb-7">{sol.description}</p>
                    <ul className="flex flex-col gap-3 mb-8">
                      {sol.features.map((f) => (
                        <li key={f} className="flex items-start gap-3">
                          <CheckCircle size={17} className="text-[#00342b] mt-0.5 shrink-0" />
                          <span className="text-sm text-[#3f4945] leading-relaxed">{f}</span>
                        </li>
                      ))}
                    </ul>
                    <CTAButton href="/contact">Request Service</CTAButton>
                  </div>
                  {/* Visual */}
                  <div className="relative">
                    {SOLUTION_IMAGES[sol.id] ? (
                      <div className="relative w-full h-[420px] overflow-hidden border border-[#bfc9c4]">
                        <Image
                          src={SOLUTION_IMAGES[sol.id]}
                          alt={sol.title}
                          fill
                          className="object-cover object-center"
                          sizes="(max-width: 768px) 100vw, 50vw"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-[420px] bg-[#efeded] border border-[#bfc9c4] flex items-center justify-center">
                        <div className="text-center p-8">
                          {Icon && <Icon size={56} className="text-[#00342b]/30 mx-auto mb-3" />}
                          <p className="text-sm text-[#707975] font-medium">{sol.title}</p>
                        </div>
                      </div>
                    )}
                    <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-[#afefdd]/40 -z-10" />
                  </div>
                </div>
              )}

              {/* Divider */}
              {idx < SOLUTIONS.length - 1 && (
                <div className="mt-24 h-px bg-[#bfc9c4]" />
              )}
            </section>
          );
        })}

        {/* ── BOTTOM CTA ── */}
        <section className="bg-[#00342b] p-10 md:p-14 text-center text-white">
          <h2 className="font-[Geist,sans-serif] font-semibold text-2xl md:text-3xl mb-4">
            Ready to automate your business?
          </h2>
          <p className="text-[#c4c7c7] mb-8 max-w-xl mx-auto">
            Our team is ready to help you design and deploy the right solution for your business.
          </p>
          <CTAButton href="/contact" variant="white" icon={<ArrowRight size={16} />}>
            Submit Inquiry
          </CTAButton>
        </section>
      </main>

      {/* ── COMPLIANCE ── */}
      <section className="py-12 bg-[#f5f3f3]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <ComplianceCard />
        </div>
      </section>
    </>
  );
}
