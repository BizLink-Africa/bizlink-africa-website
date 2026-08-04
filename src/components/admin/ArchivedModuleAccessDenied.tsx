import Link from 'next/link';
import { Archive } from 'lucide-react';
import { verifyAdminSession } from '@/lib/supabase/dal';
import { logAuditEvent } from '@/lib/audit';

const REASON_MESSAGE: Record<'disabled' | 'not_super_admin' | 'unauthenticated', string> = {
  disabled: 'This archived module is currently disabled.',
  not_super_admin: 'This archived module is restricted to Super Admin.',
  unauthenticated: 'You must be signed in as a Super Admin to view this archived module.',
};

// Mirrors AccessDenied.tsx's audit-logging pattern, scoped to the archived
// financial-prototype modules (settlement/payouts/commission/collections/
// financial-reports/selcom-disbursement). Every render is audit-logged the
// same way a normal permission denial is.
export default async function ArchivedModuleAccessDenied({
  reason,
  module,
}: {
  reason: 'disabled' | 'not_super_admin' | 'unauthenticated';
  module: string;
}) {
  try {
    const user = await verifyAdminSession();
    void logAuditEvent({
      performedBy: user.email ?? 'unknown',
      actionType: 'access_denied',
      module,
      recordId: `archived_prototype:${reason}`,
      result: 'failure',
    });
  } catch {
    // verifyAdminSession() redirects unauthenticated visitors before this
    // would ever render for them — this only guards an unexpected failure.
  }

  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6">
      <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mb-5">
        <Archive size={26} className="text-amber-800" />
      </div>
      <h1 className="font-bold text-xl text-[#00342b] mb-2">Archived Financial Prototype</h1>
      <p className="text-sm text-[#707975] max-w-sm mb-2">{REASON_MESSAGE[reason]}</p>
      <p className="text-xs text-[#aeb1b1] max-w-sm mb-6">
        BizLink Africa does not handle merchant funds or settlements. This module is preserved for audit history
        only.
      </p>
      <Link href="/admin" className="text-sm text-[#00342b] font-medium hover:underline">
        Return to Overview →
      </Link>
    </div>
  );
}
