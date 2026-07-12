import { Shield } from 'lucide-react';
import { COMPLIANCE_TEXT } from '@/data/website';

interface ComplianceCardProps {
  className?: string;
}

export default function ComplianceCard({ className = '' }: ComplianceCardProps) {
  return (
    <div className={`border border-[#afefdd] bg-[#afefdd]/10 p-6 md:p-8 ${className}`}>
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-10 h-10 bg-[#afefdd] flex items-center justify-center">
          <Shield size={20} className="text-[#00342b]" />
        </div>
        <div>
          <p className="text-xs font-semibold text-[#065043] uppercase tracking-widest mb-2">Compliance Notice</p>
          <p className="text-sm leading-relaxed text-[#3f4945]">{COMPLIANCE_TEXT}</p>
        </div>
      </div>
    </div>
  );
}
