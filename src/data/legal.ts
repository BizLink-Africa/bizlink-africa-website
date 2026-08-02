// Kept in lockstep with the "Last updated" dates on /terms-of-service and
// /privacy-policy. Bump these whenever either page's substantive content
// changes so existing acceptance records stay tied to the version a
// merchant actually saw.
export const TERMS_VERSION = 'tos-2026-07';
export const PRIVACY_VERSION = 'privacy-2026-07';

export interface MerchantAcknowledgement {
  key: string;
  label: string;
}

// Each is recorded individually in merchant_terms_acceptances.acknowledgements
// (not collapsed into one blanket checkbox) so the stored record shows
// exactly what a merchant did and did not confirm.
export const MERCHANT_ACKNOWLEDGEMENTS: MerchantAcknowledgement[] = [
  { key: 'accurate_information', label: 'The information I have submitted is accurate.' },
  { key: 'verification_consent', label: 'I consent to business and identity verification.' },
  { key: 'approved_use', label: 'I agree to the approved-use restrictions.' },
  {
    key: 'kyc_partner_understanding',
    label:
      'I understand that final KYC approval is performed by the approved payment infrastructure partner, not BizLink Africa.',
  },
  {
    key: 'private_commercial_terms',
    label: 'I accept that private commercial and settlement terms are set out in the signed merchant agreement.',
  },
  { key: 'settlement_authorisation', label: 'I authorise settlement to my verified beneficiary.' },
  {
    key: 'investigation_cooperation',
    label: 'I agree to cooperate with chargeback, fraud and compliance investigations.',
  },
  {
    key: 'settlement_hold_understanding',
    label: 'I understand that settlement may be held where reconciliation or compliance checks are incomplete.',
  },
  {
    key: 'beneficiary_change_notice',
    label: 'I agree to notify BizLink Africa before changing my settlement details.',
  },
];

export const MERCHANT_ACKNOWLEDGEMENT_KEYS = MERCHANT_ACKNOWLEDGEMENTS.map((a) => a.key);
