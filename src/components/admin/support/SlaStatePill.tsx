import type { SlaState } from '@/data/tickets';

const LABELS: Record<SlaState, string> = {
  on_track: 'On Track',
  due_soon: 'Due Soon',
  breached: 'Breached',
  met: 'Met',
};

const TONE_CLASSES: Record<SlaState, string> = {
  on_track: 'bg-[#e0f2ee] text-[#00342b]',
  due_soon: 'bg-[#fef3e0] text-[#8a5a00]',
  breached: 'bg-[#fbe4e4] text-[#8a1f1f]',
  met: 'bg-[#dcf5e3] text-[#1b7a3d]',
};

export default function SlaStatePill({ state }: { state: SlaState }) {
  return <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${TONE_CLASSES[state]}`}>{LABELS[state]}</span>;
}
