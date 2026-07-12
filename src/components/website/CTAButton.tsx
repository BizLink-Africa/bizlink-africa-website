import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ReactNode } from 'react';

interface CTAButtonProps {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'outline' | 'outline-light' | 'white';
  icon?: ReactNode;
  className?: string;
  external?: boolean;
}

export default function CTAButton({ href, children, variant = 'primary', icon, className = '', external }: CTAButtonProps) {
  const base =
    'inline-flex items-center gap-2 px-6 py-3 text-sm font-medium tracking-wide transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

  const variants = {
    primary: 'bg-[#00342b] text-white hover:bg-[#004d40] focus-visible:ring-[#00342b]',
    outline: 'border border-[#1b1c1c] text-[#1b1c1c] hover:bg-[#efeded] focus-visible:ring-[#00342b]',
    'outline-light': 'border border-white text-white hover:bg-white hover:text-[#00342b] focus-visible:ring-white focus-visible:ring-offset-[#00342b]',
    white: 'bg-white text-[#00342b] hover:bg-[#f5f3f3] focus-visible:ring-[#00342b]',
  };

  const cls = `${base} ${variants[variant]} ${className}`;

  if (external) {
    return (
      <a href={href} className={cls} target="_blank" rel="noopener noreferrer">
        {children}
        {icon ?? <ArrowRight size={16} />}
      </a>
    );
  }

  return (
    <Link href={href} className={cls}>
      {children}
      {icon ?? <ArrowRight size={16} />}
    </Link>
  );
}
