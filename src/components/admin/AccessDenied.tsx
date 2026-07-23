import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { verifyAdminSession } from '@/lib/supabase/dal';
import { logAuditEvent } from '@/lib/audit';

// The one real "unauthorized access" signal in the app: this only ever
// renders when the PRIMARY `.view` permission gate on a page fails (the
// secondary `.manage`-for-read-only-vs-editable check never reaches here —
// see the comment on requirePermission() in dal.ts). Every render is
// audit-logged (result: 'failure', action_type: 'access_denied') — this is
// what "TEST: Unauthorized settings access" actually exercises. Fire-and-
// forget: a logging failure must never block the page from rendering the
// denial message itself.
export default async function AccessDenied({ requiredPermission }: { requiredPermission?: string }) {
  try {
    const user = await verifyAdminSession();
    void logAuditEvent({
      performedBy: user.email ?? 'unknown',
      actionType: 'access_denied',
      module: requiredPermission?.split('.')[0] ?? 'unknown',
      recordId: requiredPermission,
      result: 'failure',
    });
  } catch {
    // verifyAdminSession() itself redirects unauthenticated visitors before
    // AccessDenied would ever render for them — this catch only guards
    // against an unexpected failure in that call, never suppresses the
    // redirect.
  }

  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6">
      <div className="w-14 h-14 bg-[#fbdada] rounded-full flex items-center justify-center mb-5">
        <ShieldAlert size={26} className="text-red-700" />
      </div>
      <h1 className="font-bold text-xl text-[#00342b] mb-2">Access Denied</h1>
      <p className="text-sm text-[#707975] max-w-sm mb-6">
        Your role doesn&apos;t have permission to view this page
        {requiredPermission && (
          <>
            {' '}
            (requires <span className="font-mono text-xs">{requiredPermission}</span>)
          </>
        )}
        . Contact a Super Admin if you believe this is a mistake.
      </p>
      <Link href="/admin" className="text-sm text-[#00342b] font-medium hover:underline">
        Return to Overview →
      </Link>
    </div>
  );
}
