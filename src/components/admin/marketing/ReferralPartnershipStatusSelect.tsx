'use client';

import InlineSelect from '@/components/admin/InlineSelect';
import { updateReferralPartnershipStatus } from '@/app/admin/(protected)/marketing/referrals/actions';
import { REFERRAL_PARTNERSHIP_STATUSES, type ReferralPartnershipStatus } from '@/data/marketing';

export default function ReferralPartnershipStatusSelect({ id, status }: { id: string; status: ReferralPartnershipStatus }) {
  return (
    <InlineSelect
      value={status}
      options={REFERRAL_PARTNERSHIP_STATUSES}
      onSave={(v) => updateReferralPartnershipStatus(id, v as ReferralPartnershipStatus)}
    />
  );
}
