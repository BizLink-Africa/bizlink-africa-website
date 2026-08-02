import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import AccessDenied from '@/components/admin/AccessDenied';
import CalculationPreviewForm from '@/components/admin/commission/CalculationPreviewForm';

export const dynamic = 'force-dynamic';

export default async function CalculationPreviewPage() {
  try {
    await requirePermission('commission_rules.view');
  } catch {
    return <AccessDenied requiredPermission="commission_rules.view" />;
  }

  const supabase = await createClient();
  const { data: merchantRows } = await supabase.from('merchants').select('id, business_name').order('business_name');

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-bold text-2xl text-[#00342b]">Calculation Preview</h1>
        <p className="text-sm text-[#707975] mt-1">
          Shows what an approved rule would charge for a given amount — the same calculation engine used everywhere else, never a client-side estimate.
        </p>
      </div>
      <CalculationPreviewForm merchants={merchantRows ?? []} />
    </div>
  );
}
