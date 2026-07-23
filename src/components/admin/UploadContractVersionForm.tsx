'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { uploadContractVersion } from '@/app/admin/(protected)/contracts/actions';

export default function UploadContractVersionForm({ contractId }: { contractId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await uploadContractVersion(contractId, formData);
    setSubmitting(false);

    if (result.success) {
      formRef.current?.reset();
      router.refresh();
    } else {
      setError(result.message ?? 'Failed to upload file.');
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
      <input
        type="file"
        name="file"
        accept=".pdf,.doc,.docx"
        required
        className="text-sm text-[#3f4945] file:mr-3 file:py-2 file:px-4 file:border file:border-[#bfc9c4] file:text-sm file:font-medium file:bg-white hover:file:bg-[#f5f3f3]"
      />
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center gap-2 bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
      >
        <Upload size={14} /> {submitting ? 'Uploading...' : 'Upload Version'}
      </button>
      {error && <p className="text-sm text-red-700 w-full">{error}</p>}
    </form>
  );
}
