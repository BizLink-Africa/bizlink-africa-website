import { z } from 'zod';
import {
  REQUESTED_SOLUTIONS,
  PREFERRED_CONTACT_METHODS,
  MERCHANT_SOLUTION_VALUE,
  MERCHANT_BUSINESS_REGISTRATION_STATUSES,
  MERCHANT_BUSINESS_TYPES,
  MERCHANT_MONTHLY_VOLUME_RANGES,
  MERCHANT_SETTLEMENT_DESTINATIONS,
  MERCHANT_COLLECTION_METHODS,
  MERCHANT_GOLIVE_TIMELINES,
} from '@/data/inquiries';

export { MERCHANT_SOLUTION_VALUE };

const solutionValues = REQUESTED_SOLUTIONS.map((s) => s.value) as [string, ...string[]];
const contactMethodValues = PREFERRED_CONTACT_METHODS.map((m) => m.value) as [string, ...string[]];
const registrationStatusValues = MERCHANT_BUSINESS_REGISTRATION_STATUSES.map((o) => o.value) as [string, ...string[]];
const businessTypeValues = MERCHANT_BUSINESS_TYPES.map((o) => o.value) as [string, ...string[]];
const volumeRangeValues = MERCHANT_MONTHLY_VOLUME_RANGES.map((o) => o.value) as [string, ...string[]];
const settlementDestinationValues = MERCHANT_SETTLEMENT_DESTINATIONS.map((o) => o.value) as [string, ...string[]];
const collectionMethodValues = MERCHANT_COLLECTION_METHODS.map((o) => o.value) as [string, ...string[]];
const goLiveTimelineValues = MERCHANT_GOLIVE_TIMELINES.map((o) => o.value) as [string, ...string[]];

const MAX_TEXT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 5000;

// Shared by the public inquiry form (client-side, for immediate field-level
// errors) and the /api/inquiries route (server-side, source of truth — the
// client can never be trusted to have enforced this itself).
export const inquirySchema = z
  .object({
    fullName: z.string().trim().min(1, 'Please enter your full name.').max(MAX_TEXT_LENGTH),
    businessName: z.string().trim().min(1, 'Please enter your business or company name.').max(MAX_TEXT_LENGTH),
    businessType: z.string().trim().min(1, 'Please enter your business type or service offered.').max(MAX_TEXT_LENGTH),
    location: z.string().trim().min(1, 'Please enter your physical location.').max(MAX_TEXT_LENGTH),
    phone: z.string().trim().min(1, 'Please enter a phone or WhatsApp number.').max(MAX_TEXT_LENGTH),
    email: z
      .string()
      .trim()
      .min(1, 'Please enter your email address.')
      .max(MAX_TEXT_LENGTH)
      .refine((v) => /^\S+@\S+\.\S+$/.test(v), 'Please provide a valid email address.'),
    requestedSolution: z.array(z.enum(solutionValues)).min(1, 'Please select at least one solution you need.'),
    preferredContactMethod: z.union([z.enum(contactMethodValues), z.literal('')]).optional(),
    message: z.union([z.string().trim().max(MAX_MESSAGE_LENGTH), z.literal('')]).optional(),
    consentGiven: z.boolean().refine((v) => v === true, {
      message: 'Please confirm BizLink Africa may contact you about your inquiry.',
    }),

    // Merchant Payment Infrastructure — preliminary, non-sensitive fields
    // only. Never bank/wallet account numbers or KYC documents; those are
    // collected later through a protected onboarding workflow.
    merchantBusinessRegistrationStatus: z.union([z.enum(registrationStatusValues), z.literal('')]).optional(),
    merchantBusinessType: z.union([z.enum(businessTypeValues), z.literal('')]).optional(),
    merchantMonthlyVolumeRange: z.union([z.enum(volumeRangeValues), z.literal('')]).optional(),
    merchantSettlementDestination: z.union([z.enum(settlementDestinationValues), z.literal('')]).optional(),
    merchantCurrentCollectionMethod: z.union([z.enum(collectionMethodValues), z.literal('')]).optional(),
    merchantBusinessLocationsCount: z.coerce
      .number()
      .int('Please enter a whole number of locations.')
      .min(1, 'Please enter at least 1 business location.')
      .max(100000, 'Please enter a realistic number of locations.')
      .optional(),
    merchantGoLiveTimeline: z.union([z.enum(goLiveTimelineValues), z.literal('')]).optional(),
    merchantAccuracyConfirmed: z.boolean().optional(),

    // Honeypot — must stay empty. Hidden from real users via CSS; a filled
    // value means an automated submission.
    website: z.union([z.string().max(200), z.literal('')]).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.requestedSolution.includes(MERCHANT_SOLUTION_VALUE)) return;

    const requireChoice = (value: string | undefined, field: string, message: string) => {
      if (!value) ctx.addIssue({ code: 'custom', path: [field], message });
    };

    requireChoice(data.merchantBusinessRegistrationStatus, 'merchantBusinessRegistrationStatus', 'Please select your business registration status.');
    requireChoice(data.merchantBusinessType, 'merchantBusinessType', 'Please select your business type.');
    requireChoice(data.merchantMonthlyVolumeRange, 'merchantMonthlyVolumeRange', 'Please select your estimated monthly transaction volume.');
    requireChoice(data.merchantSettlementDestination, 'merchantSettlementDestination', 'Please select your preferred settlement destination.');
    requireChoice(data.merchantCurrentCollectionMethod, 'merchantCurrentCollectionMethod', 'Please select your current payment collection method.');
    requireChoice(data.merchantGoLiveTimeline, 'merchantGoLiveTimeline', 'Please select your expected go-live timeline.');

    if (data.merchantBusinessLocationsCount === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['merchantBusinessLocationsCount'],
        message: 'Please enter the number of business locations or branches.',
      });
    }

    if (data.merchantAccuracyConfirmed !== true) {
      ctx.addIssue({
        code: 'custom',
        path: ['merchantAccuracyConfirmed'],
        message: 'Please confirm the accuracy statement to continue.',
      });
    }
  });

export type InquiryFormValues = z.infer<typeof inquirySchema>;

// Maps Zod issues to a flat { fieldName: firstMessage } record for inline
// field-level error display on the form.
export function firstFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0]?.toString();
    if (key && !(key in out)) out[key] = issue.message;
  }
  return out;
}
