import { labelFor, OPPORTUNITY_STAGES } from '@/data/crm';

const STAGE_COLORS: Record<string, string> = {
  identified: 'bg-[#eeeeee] text-[#3f4945]',
  qualified: 'bg-[#e0f2ee] text-[#00342b]',
  solution_proposed: 'bg-[#e6e6fa] text-[#3d3d9e]',
  proposal_sent: 'bg-[#e6e6fa] text-[#3d3d9e]',
  negotiation: 'bg-[#fef3e0] text-[#8a5a00]',
  verbal_agreement: 'bg-[#fef3e0] text-[#8a5a00]',
  won: 'bg-[#dcf5e3] text-[#1b7a3d]',
  lost: 'bg-[#fbe4e4] text-[#8a1f1f]',
  on_hold: 'bg-[#eeeeee] text-[#5a5f5c]',
};

export default function OpportunityStageBadge({ stage }: { stage: string }) {
  const colorClass = STAGE_COLORS[stage] ?? 'bg-[#eeeeee] text-[#3f4945]';
  return (
    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${colorClass}`}>
      {labelFor(OPPORTUNITY_STAGES, stage)}
    </span>
  );
}
