'use client';

import InlineSelect from '@/components/admin/InlineSelect';
import { updateKbArticleStatus } from '@/app/admin/(protected)/support/knowledge-base/actions';
import { KB_STATUSES, type KbStatus } from '@/data/tickets';

export default function KbArticleStatusSelect({ id, status }: { id: string; status: KbStatus }) {
  return <InlineSelect value={status} options={KB_STATUSES} onSave={(v) => updateKbArticleStatus(id, v as KbStatus)} />;
}
