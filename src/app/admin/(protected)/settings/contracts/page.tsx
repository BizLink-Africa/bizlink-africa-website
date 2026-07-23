import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import ContractSettingsForm from '@/components/admin/ContractSettingsForm';
import type { ContractSettingsInput } from './actions';

export const dynamic = 'force-dynamic';

interface ContractSettingsRow {
  contract_prefix: string;
  contract_renewal_notice_days: number;
  contract_expiry_notice_days: number;
  contract_required_approval_roles: string[];
}

export default async function ContractSettingsPage() {
  let canManage = true;
  try {
    await requirePermission('contract.settings.view');
  } catch {
    return <AccessDenied requiredPermission="contract.settings.view" />;
  }
  try {
    await requirePermission('contract.settings.manage');
  } catch {
    canManage = false;
  }

  const supabase = await createClient();
  const [{ data }, { data: roleRows }] = await Promise.all([
    supabase.from('company_settings').select('contract_prefix, contract_renewal_notice_days, contract_expiry_notice_days, contract_required_approval_roles').eq('id', true).single(),
    supabase.from('roles').select('id, name').eq('is_active', true).order('name'),
  ]);

  const settings = data as ContractSettingsRow | null;
  const roleOptions = (roleRows ?? []).map((r) => ({ value: r.id, label: r.name }));
  const initial: ContractSettingsInput = {
    contractPrefix: settings?.contract_prefix ?? 'CTR',
    renewalNoticeDays: settings?.contract_renewal_notice_days ?? 30,
    expiryNoticeDays: settings?.contract_expiry_notice_days ?? 14,
    requiredApprovalRoles: settings?.contract_required_approval_roles ?? ['ceo'],
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-bold text-2xl text-[#00342b]">Contract Settings</h1>
        <p className="text-sm text-[#707975] mt-1">
          Contract numbering, renewal/expiry notice windows, and which roles must sign off on a contract. The
          configured Contract Approval workflow itself lives in{' '}
          <Link href="/admin/governance/approval-workflows" className="underline hover:text-[#00342b]">Governance &gt; Approval Workflows</Link>.
        </p>
      </div>

      {canManage ? (
        <ContractSettingsForm initial={initial} roleOptions={roleOptions} />
      ) : (
        <div className="bg-white border border-[#bfc9c4] p-6 space-y-2 text-sm text-[#3f4945]">
          <p><span className="font-semibold text-[#707975]">Contract Prefix:</span> {initial.contractPrefix}</p>
          <p><span className="font-semibold text-[#707975]">Renewal Notice:</span> {initial.renewalNoticeDays} days</p>
          <p><span className="font-semibold text-[#707975]">Expiry Notice:</span> {initial.expiryNoticeDays} days</p>
          <p><span className="font-semibold text-[#707975]">Required Approval Roles:</span> {initial.requiredApprovalRoles.join(', ')}</p>
        </div>
      )}
    </div>
  );
}
