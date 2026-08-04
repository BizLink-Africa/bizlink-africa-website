import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight, Bot, ShoppingBag, CreditCard, Workflow, Laptop,
  MapPin, ShoppingCart, Shield, ArrowRightLeft, Users,
  Wallet, ShieldCheck, Building2, MessageCircle, CheckCircle,
  Zap, BadgeCheck, Check,
} from 'lucide-react';
import CTAButton from '@/components/website/CTAButton';
import SectionHeading from '@/components/website/SectionHeading';
import ComplianceCard from '@/components/website/ComplianceCard';
import { SOLUTIONS, ADVANTAGES, PARTNERSHIP_FEATURES, WHO_WE_SERVE, SERVICE_CATEGORIES, COMPANY } from '@/data/website';

const ADVANTAGE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  MapPin, Bot, ShoppingCart, Shield, ArrowRightLeft, Users,
};

const PARTNERSHIP_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Wallet, ShieldCheck, Building2,
};

const SOLUTION_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Bot, ShoppingBag, CreditCard, Workflow, Laptop, MessageCircle, ShoppingCart, Users, ArrowRightLeft,
};

const SERVICE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Bot, ShoppingBag, CreditCard, Workflow, Laptop,
};

export default function HomePage() {
  return (
    <>
      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-[#fbf9f8] border-b border-[#bfc9c4] py-12 lg:py-16">
        {/* Brand accent line at top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#00342b]" />
        <div className="max-w-[1280px] mx-auto px-6 md:px-12 grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">

          {/* ── LEFT: Copy ── */}
          <div className="z-10">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-[#00342b]/30 bg-[#afefdd]/20 text-[#00342b] text-xs font-medium rounded-full mb-4">
              <Zap size={11} className="text-[#00342b]" />
              ICT Solutions for Digital Businesses
            </div>

            <h1 className="font-[Geist,sans-serif] font-bold text-3xl md:text-[36px] lg:text-[40px] leading-[1.15] tracking-tight text-[#1b1c1c] mb-4">
              Powering Business Growth with{' '}
              <span className="italic text-[#00a651]">AI Automation</span>{' '}
              &amp; Payment Infrastructure
            </h1>

            <p className="text-sm leading-relaxed text-[#3f4945] mb-6 max-w-md">
              BizLink Africa Limited helps startups, SMEs, service providers, and online businesses automate sales, customer care, social commerce, and merchant payment integration support through approved payment partners — with each merchant managing their own payment account and settlement directly.
            </p>

            <div className="flex flex-wrap gap-3 mb-6">
              <CTAButton href="/contact">Start Your Journey</CTAButton>
            </div>

            {/* Trust indicators row */}
            <div className="flex flex-wrap gap-4 pt-4 border-t border-[#bfc9c4]">
              {[
                { icon: CheckCircle, label: 'Direct merchant settlement' },
                { icon: Shield, label: 'Provider-neutral integration support' },
                { icon: BadgeCheck, label: 'Secure offline onboarding' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <Icon size={13} className="text-[#00342b] shrink-0" />
                  <span className="text-xs text-[#3f4945] font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Hero image (stacks below the copy on mobile/tablet) ── */}
          <div className="relative">
            <div className="relative overflow-hidden shadow-lg" style={{ aspectRatio: '4/3' }}>
              <Image
                src="/hero-image.png"
                alt="BizLink Africa — empowering businesses across East Africa"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover object-center"
                priority
              />
            </div>
            {/* Decorative accent */}
            <div className="absolute -bottom-3 -right-3 w-16 h-16 bg-[#afefdd]/40 -z-10" />
          </div>
        </div>

        {/* Background gradient */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[#00342b]/4 to-transparent pointer-events-none -z-0" />
      </section>

      {/* ── WHO WE ARE ── */}
      <section className="py-20 bg-white border-b border-[#bfc9c4]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Image */}
            <div className="relative">
              <div className="aspect-[4/3] bg-[#1b1c1c] overflow-hidden relative">
                <Image
                  src="/operations-hub.png"
                  alt="BizLink Africa — Operations Hub, Dar es Salaam"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                  priority
                />
              </div>
              {/* Decorative accent */}
              <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-[#afefdd]/30 -z-10" />
              <div className="absolute -top-4 -left-4 w-16 h-16 bg-[#00342b]/10 -z-10" />
            </div>

            {/* Content */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#afefdd] text-[#065043] text-xs font-semibold rounded-full mb-6 uppercase tracking-wider">
                Who We Are
              </div>
              <h2 className="font-[Geist,sans-serif] font-bold text-3xl md:text-4xl leading-tight tracking-tight text-[#1b1c1c] mb-6">
                Bridging the Gap Between Tech and Business Growth
              </h2>
              <p className="text-[#3f4945] leading-relaxed mb-5">
                BizLink Africa Limited serves as a strategic ICT bridging partner for startups, SMEs, and digital businesses across Tanzania and East Africa. We specialize in navigating the complexities of the digital economy by providing the technical connective tissue required for modern commerce.
              </p>
              <p className="text-[#3f4945] leading-relaxed mb-8">
                Our philosophy is built on absolute reliability. We don&apos;t just provide tools — we build the backbone that allows African businesses to scale securely and efficiently in an increasingly automated world.
              </p>

              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-8 border-t border-[#bfc9c4]">
                {[
                  { value: '500+', label: 'Businesses Automated' },
                  { value: '24/7', label: 'Technical Support' },
                  { value: '5+', label: 'Years in East Africa' },
                  { value: '99.9%', label: 'Infrastructure Uptime' },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p className="font-[Geist,sans-serif] font-bold text-2xl text-[#00342b] mb-1">{stat.value}</p>
                    <p className="text-sm text-[#707975]">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── CORE SOLUTIONS PREVIEW ── */}
      <section className="py-20 bg-[#fbf9f8]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <SectionHeading
            badge="Our Services"
            title="Core Solutions"
            subtitle="Everything your business needs to automate, grow, and integrate — built for East Africa."
            center
          />
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SOLUTIONS.map((sol) => {
              const Icon = SOLUTION_ICONS[sol.icon];
              return (
                <div key={sol.id} className="border border-[#bfc9c4] bg-white p-6 hover:border-[#00342b] hover:shadow-sm transition-all duration-200 group">
                  <div className="w-11 h-11 bg-[#afefdd] flex items-center justify-center mb-4">
                    {Icon && <Icon size={22} className="text-[#00342b]" />}
                  </div>
                  <h3 className="font-[Geist,sans-serif] font-semibold text-[#1b1c1c] text-lg mb-2">{sol.title}</h3>
                  <p className="text-sm text-[#3f4945] leading-relaxed mb-4">{sol.description}</p>
                  <Link
                    href="/solutions"
                    className="text-xs font-semibold text-[#00342b] flex items-center gap-1 group-hover:gap-2 transition-all w-fit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#00342b] rounded-sm"
                  >
                    Learn More <ArrowRight size={13} />
                  </Link>
                </div>
              );
            })}
          </div>
          <div className="mt-10 text-center">
            <CTAButton href="/solutions">View All Solutions</CTAButton>
          </div>
        </div>
      </section>

      {/* ── BIZLINK ADVANTAGE ── */}
      <section className="py-20 bg-[#efeded]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <SectionHeading
            badge="Why BizLink"
            title="The BizLink Advantage"
            subtitle="Six reasons businesses across Tanzania trust BizLink Africa Limited to power their growth."
            center
          />
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {ADVANTAGES.map((adv) => {
              const Icon = ADVANTAGE_ICONS[adv.icon];
              return (
                <div key={adv.title} className="bg-white border border-[#bfc9c4] p-6">
                  <div className="w-10 h-10 bg-[#afefdd] flex items-center justify-center mb-4">
                    {Icon && <Icon size={20} className="text-[#00342b]" />}
                  </div>
                  <h3 className="font-[Geist,sans-serif] font-semibold text-[#1b1c1c] mb-2">{adv.title}</h3>
                  <p className="text-sm text-[#3f4945] leading-relaxed">{adv.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── PARTNERSHIP APPROACH PREVIEW ── */}
      <section className="py-20 bg-[#00342b] text-white relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)', backgroundSize: '40px 40px' }}
        />
        <div className="max-w-[1280px] mx-auto px-6 md:px-12 relative z-10">
          <SectionHeading
            badge="Our Model"
            title="We Build the Bridge, You Maintain Control"
            subtitle="BizLink Africa coordinates merchant onboarding and payment-technology integration through approved payment partners. Each merchant maintains their own payment account and manages settlement directly with the applicable partner."
            center
            light
          />
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PARTNERSHIP_FEATURES.map((f) => {
              const Icon = PARTNERSHIP_ICONS[f.icon];
              return (
                <div key={f.title} className="border border-white/20 bg-white/5 p-6 backdrop-blur-sm">
                  <div className="w-10 h-10 bg-[#afefdd]/20 flex items-center justify-center mb-4">
                    {Icon && <Icon size={20} className="text-[#afefdd]" />}
                  </div>
                  <h3 className="font-[Geist,sans-serif] font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-[#c4c7c7] leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-10 text-center">
            <CTAButton href="/partnership" variant="white">Learn Our Approach</CTAButton>
          </div>
        </div>
      </section>

      {/* ── ALL SERVICES ── */}
      <section className="py-20 bg-[#fbf9f8]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <SectionHeading
            badge="All Services"
            title="Everything We Offer"
            subtitle="A complete portfolio of ICT, automation, and integration services built for businesses across Tanzania and East Africa."
            center
          />
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {SERVICE_CATEGORIES.map((cat) => {
              const Icon = SERVICE_ICONS[cat.icon];
              return (
                <div key={cat.category} className="border border-[#bfc9c4] bg-white p-5 hover:border-[#00342b] hover:shadow-sm transition-all duration-200">
                  <div className="w-10 h-10 bg-[#afefdd] flex items-center justify-center mb-4">
                    {Icon && <Icon size={20} className="text-[#00342b]" />}
                  </div>
                  <h3 className="font-[Geist,sans-serif] font-semibold text-[#1b1c1c] text-sm mb-3">{cat.category}</h3>
                  <ul className="space-y-2">
                    {cat.items.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <Check size={12} className="text-[#00342b] mt-0.5 shrink-0" />
                        <span className="text-xs text-[#3f4945] leading-snug">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <div className="mt-10 text-center">
            <CTAButton href="/solutions">View Detailed Solutions</CTAButton>
          </div>
        </div>
      </section>

      {/* ── WHO WE SERVE ── */}
      <section className="py-20 bg-[#efeded]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <SectionHeading
            badge="Who We Serve"
            title="Built for Businesses Like Yours"
            subtitle="From startups to enterprise, we serve a wide range of business types across Tanzania and East Africa."
            center
          />
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {WHO_WE_SERVE.map((type) => (
              <span
                key={type}
                className="px-4 py-2 border border-[#bfc9c4] bg-white text-sm text-[#1b1c1c] font-medium hover:border-[#00342b] hover:text-[#00342b] transition-colors cursor-default"
              >
                {type}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPLIANCE & TRUST ── */}
      <section className="py-16 bg-[#f5f3f3]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <ComplianceCard />
        </div>
      </section>

      {/* ── CONTACT CTA ── */}
      <section className="py-20 bg-[#2b2e2e] text-white relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)', backgroundSize: '40px 40px' }}
        />
        <div className="max-w-[1280px] mx-auto px-6 md:px-12 text-center relative z-10">
          <h2 className="font-[Geist,sans-serif] font-semibold text-3xl md:text-4xl text-white mb-4">
            Ready to Transform Your Business?
          </h2>
          <p className="text-[#c4c7c7] text-lg mb-10 max-w-2xl mx-auto">
            Submit an inquiry and our team will contact you for consultation and offline onboarding.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <CTAButton href="/contact" variant="white">Submit Inquiry</CTAButton>
            <CTAButton href={COMPANY.whatsappLink} variant="outline-light" external icon={<MessageCircle size={16} />}>
              Chat on WhatsApp
            </CTAButton>
          </div>
        </div>
      </section>
    </>
  );
}
