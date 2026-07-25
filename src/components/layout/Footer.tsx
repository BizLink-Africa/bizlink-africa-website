import Link from 'next/link';
import Image from 'next/image';
import { COMPANY, NAV_LINKS } from '@/data/website';
import { Mail, Phone, MapPin } from 'lucide-react';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white focus-visible:ring-offset-[#00342b] rounded-sm';

export default function Footer() {
  return (
    <footer className="bg-[#00342b] text-[#c4c7c7]">
      <div className="max-w-[1280px] mx-auto px-6 md:px-12 py-16 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Brand */}
        <div className="md:col-span-1">
          <div className="flex items-center gap-3 mb-4">
            <Image
              src="/bizlink-logo.jpg"
              alt="BizLink Africa Logo"
              width={44}
              height={44}
              className="object-contain rounded-sm brightness-110"
            />
            <span className="font-[Geist,sans-serif] font-bold text-[#afefdd] text-base leading-tight">
              {COMPANY.shortName}
            </span>
          </div>
          <p className="text-sm leading-relaxed max-w-xs mb-6">
            Empowering African businesses through world-class AI automation and digital infrastructure.
          </p>
          <p className="text-xs text-[#aeb1b1] leading-relaxed">
            BizLink Africa Limited provides ICT infrastructure, automation systems, and integration support. We do not hold or settle client funds.
          </p>
        </div>

        {/* Navigation */}
        <div>
          <p className="text-xs font-semibold text-[#afefdd] uppercase tracking-widest mb-5">Navigate</p>
          <div className="flex flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm hover:text-[#afefdd] transition-colors duration-200 ${FOCUS_RING}`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div>
          <p className="text-xs font-semibold text-[#afefdd] uppercase tracking-widest mb-5">Connect</p>
          <div className="flex flex-col gap-4">
            <a
              href={`mailto:${COMPANY.emailGeneral}`}
              className={`flex items-start gap-2 text-sm hover:text-[#afefdd] transition-colors ${FOCUS_RING}`}
            >
              <Mail size={15} className="mt-0.5 shrink-0 text-[#94d3c1]" />
              <span>
                <span className="block text-xs text-[#aeb1b1] mb-0.5">Business Email</span>
                {COMPANY.emailGeneral}
              </span>
            </a>
            <a
              href={`mailto:${COMPANY.emailSupport}`}
              className={`flex items-start gap-2 text-sm hover:text-[#afefdd] transition-colors ${FOCUS_RING}`}
            >
              <Mail size={15} className="mt-0.5 shrink-0 text-[#94d3c1]" />
              <span>
                <span className="block text-xs text-[#aeb1b1] mb-0.5">Technical Support</span>
                {COMPANY.emailSupport}
              </span>
            </a>
            <a
              href={COMPANY.phoneLink}
              className={`flex items-start gap-2 text-sm hover:text-[#afefdd] transition-colors ${FOCUS_RING}`}
            >
              <Phone size={15} className="mt-0.5 shrink-0 text-[#94d3c1]" />
              <span>
                <span className="block text-xs text-[#aeb1b1] mb-0.5">Customer Support</span>
                {COMPANY.phone}
              </span>
            </a>
          </div>
        </div>

        {/* Address */}
        <div>
          <p className="text-xs font-semibold text-[#afefdd] uppercase tracking-widest mb-5">Headquarters</p>
          <div className="flex items-start gap-2 text-sm">
            <MapPin size={15} className="mt-0.5 shrink-0 text-[#94d3c1]" />
            <span className="leading-relaxed">{COMPANY.address}</span>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-[#004d40]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12 py-5 flex flex-col md:flex-row justify-between items-center gap-3">
          <p className="text-xs text-[#aeb1b1]">{COMPANY.copyright}</p>
          <div className="flex gap-5 text-xs text-[#aeb1b1]">
            <Link href="/privacy-policy" className={`py-1 hover:text-[#afefdd] transition-colors ${FOCUS_RING}`}>Privacy Policy</Link>
            <Link href="/terms-of-service" className={`py-1 hover:text-[#afefdd] transition-colors ${FOCUS_RING}`}>Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
