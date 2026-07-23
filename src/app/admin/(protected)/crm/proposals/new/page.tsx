import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import CreateProposalForm from '@/components/admin/crm/CreateProposalForm';

export const dynamic = 'force-dynamic';

export default async function NewProposalPage({ searchParams }: { searchParams: Promise<{ leadId?: string }> }) {
  try {
    await requirePermission('proposals.manage');
  } catch {
    return <AccessDenied requiredPermission="proposals.manage" />;
  }

  const { leadId } = await searchParams;
  const supabase = await createClient();

  const [{ data: clientRows }, { data: settings }] = await Promise.all([
    supabase.from('clients').select('id, business_name').order('business_name'),
    supabase.from('company_settings').select('default_currency').eq('id', true).single(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/crm/proposals" className="inline-flex items-center gap-1.5 text-sm text-[#00342b] hover:underline mb-3">
          <ArrowLeft size={14} /> Back to Proposals
        </Link>
        <h1 className="font-bold text-2xl text-[#00342b]">New Proposal</h1>
      </div>

      <CreateProposalForm clients={clientRows ?? []} leadId={leadId} defaultCurrency={settings?.default_currency ?? 'TZS'} />
    </div>
  );
}
