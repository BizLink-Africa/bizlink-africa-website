'use client';

import InlineSelect from '@/components/admin/InlineSelect';
import { updateMilestoneStatus } from '@/app/admin/(protected)/operations/milestones/actions';
import { MILESTONE_STATUSES, type MilestoneStatus } from '@/data/operations';

export default function MilestoneStatusSelect({ id, projectId, status }: { id: string; projectId: string; status: MilestoneStatus }) {
  return (
    <InlineSelect
      value={status}
      options={MILESTONE_STATUSES}
      onSave={(v) => updateMilestoneStatus(id, projectId, v as MilestoneStatus)}
    />
  );
}
