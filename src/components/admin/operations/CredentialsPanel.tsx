'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addProvisioningCredential } from '@/app/admin/(protected)/operations/provisioning/actions';
import { CREDENTIAL_TYPES, type CredentialType } from '@/data/operations';

interface Credential {
  id: string;
  credential_type: CredentialType;
  label: string;
  masked_preview: string;
  created_at: string;
}

export default function CredentialsPanel({
  provisioningId,
  clientId,
  credentials,
  readOnly,
}: {
  provisioningId: string | null;
  clientId: string;
  credentials: Credential[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [credentialType, setCredentialType] = useState<CredentialType>('api_key');
  const [label, setLabel] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [justAdded, setJustAdded] = useState<{ label: string; value: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass = 'w-full border border-[#bfc9c4] px-3 py-2 text-sm focus:border-[#00342b] focus:outline-none';

  const handleAdd = async () => {
    if (!provisioningId) return;
    setSaving(true);
    setError(null);
    const result = await addProvisioningCredential({ provisioningId, clientId, credentialType, label, secretValue });
    setSaving(false);
    if (result.success) {
      setJustAdded({ label, value: secretValue });
      setLabel('');
      setSecretValue('');
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to save credential.');
    }
  };

  return (
    <div className="bg-white border border-[#bfc9c4] p-6">
      <h2 className="font-semibold text-[#00342b] mb-1">API Credentials</h2>
      <p className="text-xs text-[#707975] mb-3">Secrets are encrypted at rest and shown only once, at creation.</p>

      {credentials.length === 0 ? (
        <p className="text-sm text-[#707975] mb-3">No credentials stored yet.</p>
      ) : (
        <ul className="divide-y divide-[#e5e5e5] mb-3">
          {credentials.map((c) => (
            <li key={c.id} className="py-2 text-sm">
              <p className="font-medium text-[#1b1c1c]">{c.label} <span className="text-xs text-[#707975] font-normal">({c.credential_type.replace(/_/g, ' ')})</span></p>
              <p className="text-xs text-[#707975] font-mono mt-0.5">{c.masked_preview}</p>
            </li>
          ))}
        </ul>
      )}

      {justAdded && (
        <div className="mb-3 text-sm bg-[#fef3e0] border border-[#eadfb0] px-3 py-2 space-y-1">
          <p className="font-semibold text-[#8a5a00]">Copy this now — you won&apos;t see the full value again:</p>
          <p className="font-mono text-xs break-all text-[#3f4945]">{justAdded.label}: {justAdded.value}</p>
        </div>
      )}

      {!readOnly && provisioningId && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select value={credentialType} onChange={(e) => setCredentialType(e.target.value as CredentialType)} className={inputClass}>
              {CREDENTIAL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" className={inputClass} />
            <input value={secretValue} onChange={(e) => setSecretValue(e.target.value)} placeholder="Value" type="password" className={inputClass} />
          </div>
          <button type="button" onClick={handleAdd} disabled={saving || !label.trim() || !secretValue.trim()} className="bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60">
            {saving ? 'Saving...' : 'Add Credential'}
          </button>
        </div>
      )}
      {!readOnly && !provisioningId && (
        <p className="text-xs text-[#707975]">Save the provisioning profile first before adding credentials.</p>
      )}

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 mt-2">{error}</p>}
    </div>
  );
}
