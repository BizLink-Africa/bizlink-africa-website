'use client';

import { useState, useTransition } from 'react';
import { ONBOARDING_CHECKLIST_ITEMS, type OnboardingChecklistKey } from '@/data/clients';
import { toggleOnboardingChecklistItem } from '@/app/admin/(protected)/actions';

type Owner = { leadId: string } | { clientId: string };

export default function OnboardingChecklist({
  owner,
  initialValues,
}: {
  owner: Owner;
  initialValues: Partial<Record<OnboardingChecklistKey, boolean>>;
}) {
  const [values, setValues] = useState(initialValues);
  const [pendingKey, setPendingKey] = useState<OnboardingChecklistKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const completedCount = ONBOARDING_CHECKLIST_ITEMS.filter((item) => values[item.key]).length;

  const handleToggle = (key: OnboardingChecklistKey) => {
    const nextValue = !values[key];
    setValues((prev) => ({ ...prev, [key]: nextValue }));
    setPendingKey(key);
    setError(null);

    startTransition(async () => {
      const result = await toggleOnboardingChecklistItem(owner, key, nextValue);
      setPendingKey(null);
      if (!result.success) {
        setValues((prev) => ({ ...prev, [key]: !nextValue }));
        setError(result.message ?? 'Failed to save checklist item.');
      }
    });
  };

  return (
    <div className="bg-white border border-[#bfc9c4] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#00342b]">Offline Onboarding Checklist</h2>
        <span className="text-xs text-[#707975]">{completedCount} / {ONBOARDING_CHECKLIST_ITEMS.length}</span>
      </div>

      <ul className="space-y-2">
        {ONBOARDING_CHECKLIST_ITEMS.map((item) => (
          <li key={item.key}>
            <label className="flex items-center gap-3 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={values[item.key] ?? false}
                onChange={() => handleToggle(item.key)}
                disabled={pendingKey === item.key}
                className="accent-[#00342b]"
              />
              <span className={values[item.key] ? 'text-[#1b1c1c]' : 'text-[#3f4945]'}>{item.label}</span>
            </label>
          </li>
        ))}
      </ul>

      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
