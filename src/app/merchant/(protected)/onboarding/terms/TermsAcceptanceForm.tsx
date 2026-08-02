'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { MERCHANT_ACKNOWLEDGEMENTS } from '@/data/legal';
import { acceptMerchantTerms } from './actions';

const initialAcknowledgements = Object.fromEntries(MERCHANT_ACKNOWLEDGEMENTS.map((a) => [a.key, false]));

export default function TermsAcceptanceForm() {
  const router = useRouter();
  const [acknowledgements, setAcknowledgements] = useState<Record<string, boolean>>(initialAcknowledgements);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const allChecked = MERCHANT_ACKNOWLEDGEMENTS.every((a) => acknowledgements[a.key]);

  const toggle = (key: string) => {
    setAcknowledgements((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (submittingRef.current) return;
    if (!allChecked) {
      setErrorMessage('Please confirm all required acknowledgements before continuing.');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    const result = await acceptMerchantTerms(acknowledgements);
    submittingRef.current = false;
    setSubmitting(false);

    if (!result.success) {
      setErrorMessage(result.message);
      return;
    }

    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="border border-[#bfc9c4] bg-white p-6">
        <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-4">
          Required Acknowledgements
        </p>
        <div className="flex flex-col gap-4">
          {MERCHANT_ACKNOWLEDGEMENTS.map((item) => (
            <label key={item.key} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledgements[item.key] ?? false}
                onChange={() => toggle(item.key)}
                className="w-5 h-5 shrink-0 accent-[#00342b] mt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00342b] focus-visible:ring-offset-2 rounded-sm"
              />
              <span className="text-sm text-[#1b1c1c] leading-relaxed">{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {errorMessage && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={!allChecked || submitting}
        className="flex items-center justify-center gap-2 w-full md:w-auto md:min-w-[240px] bg-[#00342b] text-white py-4 px-8 text-sm font-medium tracking-wide hover:bg-[#004d40] transition-colors active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00342b] focus-visible:ring-offset-2"
      >
        {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
        {submitting ? 'Recording…' : 'Accept Terms'}
      </button>
    </form>
  );
}
