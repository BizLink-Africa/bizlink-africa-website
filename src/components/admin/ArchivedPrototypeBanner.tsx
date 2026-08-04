import { Archive } from 'lucide-react';
import { ARCHIVED_PROTOTYPE_BANNER_TEXT } from '@/lib/archived-financial-prototype';

export default function ArchivedPrototypeBanner() {
  return (
    <div className="mb-6 flex items-start gap-3 border border-amber-300 bg-amber-50 px-4 py-3">
      <Archive size={16} className="text-amber-800 mt-0.5 shrink-0" />
      <p className="text-sm text-amber-900 font-medium">{ARCHIVED_PROTOTYPE_BANNER_TEXT}</p>
    </div>
  );
}
