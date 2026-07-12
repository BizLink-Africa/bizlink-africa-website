import { LucideIcon } from 'lucide-react';
import CTAButton from './CTAButton';

interface ServiceCardProps {
  Icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  cta?: string;
}

export default function ServiceCard({ Icon, title, description, href = '/contact', cta = 'Request Service' }: ServiceCardProps) {
  return (
    <div className="group border border-[#bfc9c4] bg-white p-6 hover:border-[#00342b] hover:shadow-sm transition-all duration-200 flex flex-col gap-4">
      <div className="w-11 h-11 bg-[#afefdd] flex items-center justify-center shrink-0">
        <Icon size={22} className="text-[#00342b]" />
      </div>
      <div className="flex-1">
        <h3 className="font-[Geist,sans-serif] font-semibold text-lg text-[#1b1c1c] mb-2">{title}</h3>
        <p className="text-sm leading-relaxed text-[#3f4945]">{description}</p>
      </div>
      <CTAButton href={href} variant="outline" className="self-start text-xs px-4 py-2">
        {cta}
      </CTAButton>
    </div>
  );
}
