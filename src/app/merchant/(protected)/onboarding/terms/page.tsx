import type { Metadata } from 'next';
import { CheckCircle2 } from 'lucide-react';
import { getMerchantProfile } from '@/lib/supabase/merchant-dal';
import { createClient } from '@/lib/supabase/server';
import { TERMS_VERSION, PRIVACY_VERSION } from '@/data/legal';
import TermsAcceptanceForm from './TermsAcceptanceForm';

export const metadata: Metadata = {
  title: 'Merchant Terms Acceptance',
  robots: { index: false, follow: false },
};

interface ExistingAcceptance {
  accepted_at: string;
  accepted_by_name: string;
  terms_version: string;
  privacy_version: string;
}

export default async function MerchantTermsPage() {
  // requireActiveMerchant() already ran in the layout above this page — this
  // is a second, cheap read of the same cache()'d profile, not a fresh gate.
  const merchant = await getMerchantProfile();
  if (!merchant) return null;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('merchant_terms_acceptances')
    .select('accepted_at, accepted_by_name, terms_version, privacy_version')
    .eq('merchant_id', merchant.merchantId)
    .eq('terms_version', TERMS_VERSION)
    .eq('privacy_version', PRIVACY_VERSION)
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle<ExistingAcceptance>();

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <section className="max-w-3xl mx-auto px-6 md:px-12 py-12">
      <h1 className="font-[Geist,sans-serif] font-bold text-2xl md:text-3xl text-[#1b1c1c] mb-2">
        Merchant Terms Acceptance
      </h1>
      <p className="text-sm text-[#707975] mb-8">
        This page records your digital acknowledgement during onboarding. It is not a replacement for the signed
        merchant agreement.
      </p>

      <div className="border border-[#bfc9c4] bg-white p-6 mb-8 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Merchant Business Name</p>
          <p className="text-[#1b1c1c]">{merchant.businessName}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Authorised Representative</p>
          <p className="text-[#1b1c1c]">{merchant.fullName}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Date</p>
          <p className="text-[#1b1c1c]">{today}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1">Version of Terms</p>
          <p className="text-[#1b1c1c]">{TERMS_VERSION} · {PRIVACY_VERSION}</p>
        </div>
      </div>

      <p className="text-sm text-[#3f4945] mb-8">
        Please review the{' '}
        <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#00342b] underline hover:no-underline">
          Privacy Policy
        </a>{' '}
        and{' '}
        <a href="/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-[#00342b] underline hover:no-underline">
          Terms of Service
        </a>{' '}
        before acknowledging below.
      </p>

      {existing ? (
        <div className="border border-[#afefdd] bg-[#afefdd]/10 p-6 flex items-start gap-4">
          <CheckCircle2 size={22} className="text-[#00342b] mt-0.5 shrink-0" />
          <div>
            <p className="font-[Geist,sans-serif] font-semibold text-[#00342b] mb-1">Terms already accepted</p>
            <p className="text-sm text-[#3f4945] leading-relaxed">
              {existing.accepted_by_name} accepted terms version {existing.terms_version} and privacy version{' '}
              {existing.privacy_version} on{' '}
              {new Date(existing.accepted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              . This record is append-only and cannot be edited.
            </p>
          </div>
        </div>
      ) : (
        <TermsAcceptanceForm />
      )}
    </section>
  );
}
