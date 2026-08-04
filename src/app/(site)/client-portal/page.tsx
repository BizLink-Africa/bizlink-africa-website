import type { Metadata } from 'next';
import {
  BarChart3, Bot, ShoppingBag, Activity, Ticket,
  Building2, Bell, Lock, ArrowRight, Shield,
  TrendingUp, Users, CheckCircle, AlertCircle,
} from 'lucide-react';
import SectionHeading from '@/components/website/SectionHeading';
import { CLIENT_PORTAL_SECTIONS, COMPLIANCE_TEXT } from '@/data/website';

export const metadata: Metadata = {
  title: 'Client Portal',
  description: 'Manage your BizLink Africa services, automation tools, onboarding progress, support tickets, and integration status from one secure dashboard.',
};

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  BarChart3, Bot, ShoppingBag, Activity, Ticket, Building2, Bell,
};

const DEMO_STATS = [
  { label: 'AI Conversations', value: '3,847', change: '+12% this week', up: true },
  { label: 'Orders Processed', value: '1,204', change: '+8% this week', up: true },
  { label: 'Integration Status', value: 'Active', change: '99.9% uptime', up: true },
  { label: 'Open Tickets', value: '2', change: '1 resolved today', up: false },
];

const DEMO_ACTIVITY = [
  { time: '10:42 AM', event: 'AI agent responded to 14 WhatsApp inquiries', type: 'bot', location: 'Kariakoo, DSM' },
  { time: '09:15 AM', event: 'Payment of TZS 450,000 received directly into merchant account', type: 'payment', location: 'Direct settlement' },
  { time: '08:50 AM', event: 'New order received from Instagram — Kitenge ya Maasai', type: 'order', location: 'Mwenge, DSM' },
  { time: 'Yesterday', event: 'Support ticket #TZ-0041 resolved — API integration query', type: 'ticket', location: 'Resolved' },
  { time: 'Yesterday', event: 'Social commerce workflow processed 38 orders', type: 'order', location: 'WhatsApp + Facebook' },
];

const DEMO_SERVICES = [
  { name: 'AI Sales Agent', status: 'Active', color: 'bg-[#afefdd] text-[#065043]' },
  { name: 'WhatsApp Commerce', status: 'Active', color: 'bg-[#afefdd] text-[#065043]' },
  { name: 'Payment Integration', status: 'Connected', color: 'bg-[#afefdd] text-[#065043]' },
  { name: 'Business Workflows', status: 'Active', color: 'bg-[#afefdd] text-[#065043]' },
];

export default function ClientPortalPage() {
  return (
    <>
      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-[#00342b] py-24">
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)', backgroundSize: '40px 40px' }}
        />
        <div className="max-w-[1280px] mx-auto px-6 md:px-12 relative z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#afefdd]/20 text-[#afefdd] text-xs font-semibold rounded-full mb-6 uppercase tracking-wider">
              <Shield size={14} />
              Secure Dashboard
            </div>
            <h1 className="font-[Geist,sans-serif] font-bold text-4xl md:text-5xl leading-tight tracking-tight text-white mb-5">
              Client Portal
            </h1>
            <p className="text-lg leading-relaxed text-[#c4c7c7]">
              Manage your BizLink Africa services, automation tools, onboarding progress, support tickets, and integration status from one secure dashboard.
            </p>
          </div>
        </div>
      </section>

      {/* ── PORTAL SECTIONS PREVIEW ── */}
      <section className="py-20 bg-[#fbf9f8]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <SectionHeading
            badge="Dashboard Modules"
            title="Everything in One Place"
            subtitle="Your complete business operations — AI agents, commerce, payments, and support — managed from a single secure dashboard."
            center
          />
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {CLIENT_PORTAL_SECTIONS.map((section) => {
              const Icon = ICONS[section.icon];
              return (
                <div
                  key={section.title}
                  className="relative border border-[#bfc9c4] bg-white p-6 hover:border-[#00342b] hover:shadow-sm transition-all duration-200 group"
                >
                  <div className="absolute top-3 right-3 opacity-30 group-hover:opacity-60 transition-opacity">
                    <Lock size={13} className="text-[#707975]" />
                  </div>
                  <div className="w-10 h-10 bg-[#afefdd] flex items-center justify-center mb-4">
                    {Icon && <Icon size={20} className="text-[#00342b]" />}
                  </div>
                  <h3 className="font-[Geist,sans-serif] font-semibold text-[#1b1c1c] mb-2">{section.title}</h3>
                  <p className="text-xs text-[#3f4945] leading-relaxed">{section.desc}</p>
                  <div className="mt-4 pt-4 border-t border-[#efeded] flex items-center gap-2 text-xs text-[#00342b] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Access in dashboard</span>
                    <ArrowRight size={12} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── VIRTUAL DASHBOARD DEMO ── */}
      <section className="py-20 bg-[#efeded]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <SectionHeading
            badge="Dashboard Preview"
            title="See Your Business at a Glance"
            subtitle="A sample of what your BizLink Africa dashboard looks like — with live Tanzanian business data."
            center
          />

          <div className="mt-10 border border-[#bfc9c4] bg-white overflow-hidden shadow-sm">

            {/* Dashboard top bar */}
            <div className="bg-[#00342b] px-6 py-3 flex items-center flex-wrap justify-between gap-x-4 gap-y-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-6 h-6 bg-[#afefdd] flex items-center justify-center shrink-0">
                  <BarChart3 size={13} className="text-[#00342b]" />
                </div>
                <span className="font-[Geist,sans-serif] font-semibold text-white text-sm truncate">BizLink Africa — Client Dashboard</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-[#94d3c1]">Demo: Zanzibar Spice Traders Ltd</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-[#afefdd] rounded-full animate-pulse" />
                  <span className="text-xs text-[#c4c7c7]">Live</span>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 border-b border-[#efeded]">
              {DEMO_STATS.map((stat) => (
                <div key={stat.label} className="p-5 border-b sm:border-b-0 sm:border-r border-[#efeded] last:border-b-0 sm:last:border-r-0">
                  <p className="text-xs text-[#707975] mb-1">{stat.label}</p>
                  <p className="font-[Geist,sans-serif] font-bold text-2xl text-[#1b1c1c] mb-1">{stat.value}</p>
                  <div className="flex items-center gap-1">
                    <TrendingUp size={11} className={stat.up ? 'text-[#00342b]' : 'text-[#707975]'} />
                    <span className="text-[11px] text-[#707975]">{stat.change}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Main content area */}
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#efeded]">

              {/* Activity feed */}
              <div className="md:col-span-2 p-6">
                <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-4">Recent Activity — Tanzania</p>
                <div className="flex flex-col gap-4">
                  {DEMO_ACTIVITY.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 pb-4 border-b border-[#efeded] last:border-0 last:pb-0">
                      <div className={`w-7 h-7 flex items-center justify-center shrink-0 ${
                        item.type === 'bot' ? 'bg-[#afefdd]' :
                        item.type === 'payment' ? 'bg-[#00342b]' :
                        item.type === 'order' ? 'bg-[#efeded]' : 'bg-[#f5f3f3]'
                      }`}>
                        {item.type === 'bot' && <Bot size={13} className="text-[#00342b]" />}
                        {item.type === 'payment' && <CheckCircle size={13} className="text-[#afefdd]" />}
                        {item.type === 'order' && <ShoppingBag size={13} className="text-[#1b1c1c]" />}
                        {item.type === 'ticket' && <Ticket size={13} className="text-[#707975]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#1b1c1c] leading-snug">{item.event}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-[#707975]">{item.time}</span>
                          <span className="text-[11px] text-[#bfc9c4]">·</span>
                          <span className="text-[11px] text-[#707975]">{item.location}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Services sidebar */}
              <div className="p-6">
                <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-4">Active Services</p>
                <div className="flex flex-col gap-3 mb-6">
                  {DEMO_SERVICES.map((svc) => (
                    <div key={svc.name} className="flex items-center justify-between">
                      <span className="text-sm text-[#1b1c1c]">{svc.name}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 ${svc.color}`}>{svc.status}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[#efeded] pt-5">
                  <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-3">Payment Activity</p>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-[#3f4945]">This Month (Received)</span>
                      <span className="text-sm font-semibold text-[#00342b] font-[Geist,sans-serif]">TZS 12.4M</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-[#3f4945]">Last Month</span>
                      <span className="text-sm font-semibold text-[#1b1c1c] font-[Geist,sans-serif]">TZS 9.8M</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-[#3f4945]">Settlement</span>
                      <span className="text-sm font-semibold text-[#1b1c1c] font-[Geist,sans-serif]">Direct to Merchant</span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-start gap-2 bg-[#afefdd]/20 p-3">
                    <AlertCircle size={13} className="text-[#065043] mt-0.5 shrink-0" />
                    <p className="text-[11px] text-[#065043] leading-relaxed">Payments are settled directly to your verified merchant account by your approved payment partner. BizLink Africa does not receive, hold or control merchant funds.</p>
                  </div>
                </div>

                <div className="border-t border-[#efeded] pt-5 mt-5">
                  <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-3">Support</p>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-[#3f4945]">Open tickets</span>
                      <span className="text-xs font-semibold text-[#1b1c1c]">2</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-[#3f4945]">Resolved (30 days)</span>
                      <span className="text-xs font-semibold text-[#1b1c1c]">17</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-[#3f4945]">Avg. response time</span>
                      <span className="text-xs font-semibold text-[#00342b]">&lt; 2 hrs</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Demo footer */}
            <div className="bg-[#f5f3f3] px-6 py-3 flex items-center flex-wrap justify-between gap-x-4 gap-y-2 border-t border-[#efeded]">
              <div className="flex items-center gap-2">
                <Users size={13} className="text-[#707975]" />
                <span className="text-xs text-[#707975]">Sample data — for demonstration purposes only</span>
              </div>
              <span className="text-xs text-[#bfc9c4]">BizLink Africa Limited · Dar es Salaam, Tanzania</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMPLIANCE ── */}
      <section className="py-12 bg-[#f5f3f3]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <div className="border border-[#afefdd] bg-[#afefdd]/10 p-6 flex items-start gap-4">
            <div className="shrink-0 w-9 h-9 bg-[#afefdd] flex items-center justify-center">
              <Shield size={17} className="text-[#00342b]" />
            </div>
            <p className="text-sm text-[#3f4945] leading-relaxed">
              <strong className="text-[#00342b] font-semibold">Compliance Notice: </strong>
              {COMPLIANCE_TEXT}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
