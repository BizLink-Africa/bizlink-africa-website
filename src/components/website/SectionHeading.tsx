import { ReactNode } from 'react';

interface SectionHeadingProps {
  badge?: string;
  title: ReactNode;
  subtitle?: string;
  center?: boolean;
  light?: boolean;
}

export default function SectionHeading({ badge, title, subtitle, center, light }: SectionHeadingProps) {
  return (
    <div className={center ? 'text-center' : ''}>
      {badge && (
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5 text-xs font-semibold uppercase tracking-widest ${
          light
            ? 'bg-[#afefdd]/20 text-[#afefdd]'
            : 'bg-[#afefdd] text-[#065043]'
        }`}>
          {badge}
        </div>
      )}
      <h2 className={`font-[Geist,sans-serif] font-semibold text-3xl md:text-4xl leading-tight tracking-tight mb-4 ${
        light ? 'text-white' : 'text-[#00342b]'
      }`}>
        {title}
      </h2>
      {subtitle && (
        <p className={`text-base md:text-lg leading-relaxed ${
          light ? 'text-[#c4c7c7]' : 'text-[#3f4945]'
        }`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
