import 'server-only';
import type { createClient } from '@/lib/supabase/server';
import { computeExpiryFlag, type ContractStatus } from '@/data/contracts';
import type { ActionItem } from './types';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface ContractsOverview {
  pendingApprovalCount: number;
  pendingApprovalItems: ActionItem[];
  awaitingSignatureCount: number;
  awaitingSignatureItems: ActionItem[];
  expiringSoonCount: number;
  expiringSoonItems: ActionItem[];
  statusCounts: Record<string, number>;
}

export async function getContractsOverview(supabase: Supabase): Promise<ContractsOverview | null> {
  const { data, error } = await supabase
    .from('contracts')
    .select('id, contract_title, contract_number, status, end_date, renewal_notice_period_days');

  if (error || !data) return null;

  const today = new Date().toISOString().slice(0, 10);
  const statusCounts: Record<string, number> = {};
  for (const row of data) statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;

  const pendingApproval = data.filter((c) => c.status === 'pending_ceo_approval');
  const awaitingSignature = data.filter((c) => c.status === 'awaiting_signature');
  const expiringSoon = data.filter(
    (c) => computeExpiryFlag(c.status as ContractStatus, c.end_date, c.renewal_notice_period_days, today) === 'expiring_soon'
  );

  const toItem = (c: (typeof data)[number], detail: string): ActionItem => ({
    id: c.id,
    title: `${c.contract_number} — ${c.contract_title}`,
    detail,
    severity: 'medium',
    href: `/admin/contracts/${c.id}`,
  });

  return {
    pendingApprovalCount: pendingApproval.length,
    pendingApprovalItems: pendingApproval.slice(0, 10).map((c) => toItem(c, 'Awaiting CEO approval')),
    awaitingSignatureCount: awaitingSignature.length,
    awaitingSignatureItems: awaitingSignature.slice(0, 10).map((c) => toItem(c, 'Awaiting client signature')),
    expiringSoonCount: expiringSoon.length,
    expiringSoonItems: expiringSoon.slice(0, 10).map((c) => toItem(c, `Ends ${c.end_date}`)),
    statusCounts,
  };
}
