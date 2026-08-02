import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import NewRuleForm from '@/components/admin/commission/NewRuleForm';

export const dynamic = 'force-dynamic';

export default async function NewCommissionRulePage() {
  try {
    await requirePermission('commission_rules.manage');
  } catch {
    return <AccessDenied requiredPermission="commission_rules.manage" />;
  }

  const supabase = await createClient();
  const [{ data: merchantRows }, { data: contractRows }] = await Promise.all([
    supabase.from('merchants').select('id, business_name').order('business_name'),
    supabase.from('contracts').select('id, contract_number, contract_title').order('contract_number'),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">New Commission &amp; Fee Rule</h1>
        <p className="text-sm text-[#707975] mt-1">
          Saved as a draft first. Submit it for approval once it&apos;s ready — a different Finance user must approve it.
        </p>
      </div>
      <NewRuleForm merchants={merchantRows ?? []} contracts={contractRows ?? []} />
    </div>
  );
}
