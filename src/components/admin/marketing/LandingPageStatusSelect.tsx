'use client';

import InlineSelect from '@/components/admin/InlineSelect';
import { updateLandingPageStatus } from '@/app/admin/(protected)/marketing/landing-pages/actions';
import { LANDING_PAGE_STATUSES, type LandingPageStatus } from '@/data/marketing';

export default function LandingPageStatusSelect({ id, status }: { id: string; status: LandingPageStatus }) {
  return (
    <InlineSelect
      value={status}
      options={LANDING_PAGE_STATUSES}
      onSave={(v) => updateLandingPageStatus(id, v as LandingPageStatus)}
    />
  );
}
