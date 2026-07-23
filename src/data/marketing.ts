export const CAMPAIGN_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]['value'];

export const CAMPAIGN_CHANNELS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'google', label: 'Google' },
  { value: 'other', label: 'Other' },
] as const;

export type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number]['value'];

// Marketing Settings' "Default Channels" — a broader, org-level catalog
// (which mediums the team uses at all) distinct from CAMPAIGN_CHANNELS
// above (which specific platform a single campaign runs on).
export const DEFAULT_CHANNEL_OPTIONS = ['email', 'social_media', 'sms', 'whatsapp', 'phone', 'print'] as const;

export const CAMPAIGN_TYPES = [
  { value: 'lead_generation', label: 'Lead Generation' },
  { value: 'brand_awareness', label: 'Brand Awareness' },
  { value: 'product_launch', label: 'Product Launch' },
  { value: 'event', label: 'Event' },
  { value: 'other', label: 'Other' },
] as const;

export type CampaignType = (typeof CAMPAIGN_TYPES)[number]['value'];

export function labelFor<T extends { value: string; label: string }>(list: readonly T[], value: string): string {
  return list.find((item) => item.value === value)?.label ?? value;
}

export interface Campaign {
  id: string;
  name: string;
  type: CampaignType | null;
  channel: CampaignChannel;
  channels: CampaignChannel[];
  objective: string | null;
  status: CampaignStatus;
  start_date: string | null;
  end_date: string | null;
  budget: number;
  actual_spend: number;
  currency: string;
  target_audience: string | null;
  owner_user_id: string | null;
  description: string | null;
  leads_generated: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Live attribution for one campaign — leads/conversions/revenue walked
// from campaign_id -> website_leads -> clients -> invoices, never stored,
// so it can never disagree with what actually happened. Same shape reused
// for referral/partnership attribution (walked via referral_partner_id
// instead of campaign_id).
export interface CampaignAttribution {
  leadsCount: number;
  conversionsCount: number;
  attributedRevenue: number;
}

export const CONTENT_TYPES = [
  { value: 'post', label: 'Post' },
  { value: 'article', label: 'Article' },
  { value: 'video', label: 'Video' },
  { value: 'email', label: 'Email' },
  { value: 'ad', label: 'Ad' },
  { value: 'other', label: 'Other' },
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number]['value'];

export const CONTENT_STATUSES = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'ready', label: 'Ready' },
  { value: 'published', label: 'Published' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number]['value'];

export const APPROVAL_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number]['value'];

export interface ContentCalendarItem {
  id: string;
  title: string;
  channel: string | null;
  campaign_id: string | null;
  content_type: ContentType;
  planned_date: string | null;
  owner_user_id: string | null;
  status: ContentStatus;
  approval_status: ApprovalStatus;
  published_link: string | null;
  performance_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const SOCIAL_PLATFORMS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'other', label: 'Other' },
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]['value'];

export interface SocialMediaPost {
  id: string;
  platform: SocialPlatform;
  campaign_id: string | null;
  post_reference: string | null;
  posted_date: string | null;
  reach: number;
  engagement: number;
  clicks: number;
  leads: number;
  conversions: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const EMAIL_CAMPAIGN_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'sent', label: 'Sent' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export type EmailCampaignStatus = (typeof EMAIL_CAMPAIGN_STATUSES)[number]['value'];

export interface EmailCampaign {
  id: string;
  subject: string;
  audience_description: string | null;
  campaign_id: string | null;
  sent_date: string | null;
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  leads: number;
  conversions: number;
  unsubscribes: number;
  status: EmailCampaignStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Rates are always computed from the raw counts, never stored — same
// spirit as computeTotals() in data/finance.ts being the one place money
// math happens.
export function emailRates(c: Pick<EmailCampaign, 'sent_count' | 'delivered_count' | 'opened_count' | 'clicked_count'>) {
  const pct = (numerator: number, denominator: number) => (denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0);
  return {
    deliveryRate: pct(c.delivered_count, c.sent_count),
    openRate: pct(c.opened_count, c.delivered_count),
    clickRate: pct(c.clicked_count, c.delivered_count),
  };
}

export const REFERRAL_PARTNERSHIP_TYPES = [
  { value: 'referral', label: 'Referral' },
  { value: 'partnership', label: 'Partnership' },
] as const;

export type ReferralPartnershipType = (typeof REFERRAL_PARTNERSHIP_TYPES)[number]['value'];

export const REFERRAL_PARTNERSHIP_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'paused', label: 'Paused' },
] as const;

export type ReferralPartnershipStatus = (typeof REFERRAL_PARTNERSHIP_STATUSES)[number]['value'];

export interface ReferralPartnership {
  id: string;
  type: ReferralPartnershipType;
  referrer_or_partner_name: string;
  campaign_id: string | null;
  status: ReferralPartnershipStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const LANDING_PAGE_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'live', label: 'Live' },
  { value: 'archived', label: 'Archived' },
] as const;

export type LandingPageStatus = (typeof LANDING_PAGE_STATUSES)[number]['value'];

export interface LandingPage {
  id: string;
  page_name: string;
  url_reference: string | null;
  campaign_id: string | null;
  visits: number;
  form_submissions: number;
  status: LandingPageStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function landingPageConversionRate(page: Pick<LandingPage, 'visits' | 'form_submissions'>): number {
  return page.visits > 0 ? Math.round((page.form_submissions / page.visits) * 1000) / 10 : 0;
}
