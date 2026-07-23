export type PillTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger' | 'purple';

const TONE_CLASSES: Record<PillTone, string> = {
  neutral: 'bg-[#eeeeee] text-[#3f4945]',
  info: 'bg-[#e0f2ee] text-[#00342b]',
  warning: 'bg-[#fef3e0] text-[#8a5a00]',
  success: 'bg-[#dcf5e3] text-[#1b7a3d]',
  danger: 'bg-[#fbe4e4] text-[#8a1f1f]',
  purple: 'bg-[#e6e6fa] text-[#3d3d9e]',
};

// Generic status/priority pill — unlike PriorityBadge/StatusBadge (hard-wired
// to data/inquiries.ts), this takes its label and tone from the caller so it
// works across every Operations status taxonomy (onboarding stage, project
// status, task status, milestone status, priority).
export default function Pill({ label, tone = 'neutral' }: { label: string; tone?: PillTone }) {
  return <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${TONE_CLASSES[tone]}`}>{label}</span>;
}

export const PRIORITY_TONES: Record<string, PillTone> = {
  low: 'neutral',
  normal: 'info',
  high: 'warning',
  urgent: 'danger',
};
