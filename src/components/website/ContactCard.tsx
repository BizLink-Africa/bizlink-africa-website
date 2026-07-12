import { Mail, Phone, MapPin } from 'lucide-react';
import { COMPANY } from '@/data/website';

export default function ContactCard() {
  return (
    <div className="border border-[#bfc9c4] bg-[#f5f3f3] p-6 md:p-8">
      <p className="text-xs font-semibold text-[#00342b] uppercase tracking-widest mb-6">Contact BizLink Africa</p>
      <div className="flex flex-col gap-5">
        <a href={`mailto:${COMPANY.emailGeneral}`} className="flex items-start gap-3 text-sm hover:text-[#00342b] transition-colors text-[#1b1c1c]">
          <Mail size={16} className="mt-0.5 text-[#00342b] shrink-0" />
          <span>
            <span className="block text-xs text-[#707975] mb-0.5">Business Email</span>
            {COMPANY.emailGeneral}
          </span>
        </a>
        <a href={`mailto:${COMPANY.emailSupport}`} className="flex items-start gap-3 text-sm hover:text-[#00342b] transition-colors text-[#1b1c1c]">
          <Mail size={16} className="mt-0.5 text-[#00342b] shrink-0" />
          <span>
            <span className="block text-xs text-[#707975] mb-0.5">Technical Support</span>
            {COMPANY.emailSupport}
          </span>
        </a>
        <a href={COMPANY.whatsappLink} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 text-sm hover:text-[#00342b] transition-colors text-[#1b1c1c]">
          <Phone size={16} className="mt-0.5 text-[#00342b] shrink-0" />
          <span>
            <span className="block text-xs text-[#707975] mb-0.5">Customer Support</span>
            {COMPANY.whatsapp}
          </span>
        </a>
        <div className="flex items-start gap-3 text-sm text-[#1b1c1c]">
          <MapPin size={16} className="mt-0.5 text-[#00342b] shrink-0" />
          <span>
            <span className="block text-xs text-[#707975] mb-0.5">Headquarters</span>
            {COMPANY.address}
          </span>
        </div>
      </div>
    </div>
  );
}
