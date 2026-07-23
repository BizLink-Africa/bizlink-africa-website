import Link from 'next/link';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import CreateContractForm from '@/components/admin/CreateContractForm';
import { CONTRACT_STATUSES, labelFor, computeExpiryFlag, type ContractStatus } from '@/data/contracts';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-[#eeeeee] text-[#3f4945]',
  under_review: 'bg-[#e5e7eb] text-[#374151]',
  pending_compliance_review: 'bg-[#fef3e0] text-[#8a5a00]',
  pending_ceo_approval: 'bg-[#fef3e0] text-[#8a5a00]',
  approved: 'bg-[#e0f2ee] text-[#00342b]',
  sent_to_client: 'bg-[#e6e6fa] text-[#3d3d9e]',
  awaiting_signature: 'bg-[#e6e6fa] text-[#3d3d9e]',
  signed: 'bg-[#dcf5e3] text-[#1b7a3d]',
  active: 'bg-[#dcf5e3] text-[#1b7a3d]',
  renewed: 'bg-[#dcf5e3] text-[#1b7a3d]',
  terminated: 'bg-[#fbe4e4] text-[#8a1f1f]',
  cancelled: 'bg-[#eeeeee] text-[#5a5f5c]',
};

export default async function ContractsPage() {
  let hasCreatePermission = true;
  try {
    await requirePermission('contracts.view');
  } catch {
    return <AccessDenied requiredPermission="contracts.view" />;
  }
  try {
    await requirePermission('contracts.create');
  } catch {
    hasCreatePermission = false;
  }

  const supabase = await createClient();
  const [{ data: contracts, error }, { data: clients }] = await Promise.all([
    supabase
      .from('contracts')
      .select('id, contract_number, contract_title, client_id, currency, contract_value, status, end_date, renewal_notice_period_days')
      .order('created_at', { ascending: false }),
    supabase.from('clients').select('id, client_name, business_name').order('client_name'),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const clientNameById = new Map((clients ?? []).map((c) => [c.id, c.business_name]));

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-bold text-2xl text-[#00342b]">Contracts</h1>
          <p className="text-sm text-[#707975] mt-1">{contracts?.length ?? 0} contract{(contracts?.length ?? 0) === 1 ? '' : 's'}</p>
        </div>
        {hasCreatePermission && <CreateContractForm clients={clients ?? []} currency="TZS" />}
      </div>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          Failed to load contracts: {error.message}
        </p>
      )}

      <div className="bg-white border border-[#bfc9c4] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">End Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {(contracts ?? []).map((c) => {
              const expiryFlag = computeExpiryFlag(c.status as ContractStatus, c.end_date, c.renewal_notice_period_days, today);
              return (
                <tr key={c.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f5f3f3]">
                  <td className="px-4 py-3 font-medium text-[#00342b]">
                    <Link href={`/admin/contracts/${c.id}`} className="hover:underline">{c.contract_number}</Link>
                  </td>
                  <td className="px-4 py-3 text-[#3f4945]">{c.contract_title}</td>
                  <td className="px-4 py-3 text-[#3f4945]">{c.client_id ? clientNameById.get(c.client_id) ?? '—' : '—'}</td>
                  <td className="px-4 py-3 text-[#3f4945] tabular-nums">{c.contract_value ? `${c.currency} ${c.contract_value.toLocaleString()}` : '—'}</td>
                  <td className={`px-4 py-3 ${expiryFlag ? 'text-red-700 font-medium' : 'text-[#3f4945]'}`}>
                    {c.end_date ?? '—'} {expiryFlag === 'expired' && '(expired)'} {expiryFlag === 'expiring_soon' && '(expiring soon)'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[c.status] ?? ''}`}>
                      {labelFor(CONTRACT_STATUSES, c.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/contracts/${c.id}`}
                      className="text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-1.5 hover:bg-[#00342b] hover:text-white transition-colors whitespace-nowrap"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
            {(contracts ?? []).length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#707975]">
                  No contracts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
