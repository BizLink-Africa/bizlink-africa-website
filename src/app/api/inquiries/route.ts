import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendInquiryNotificationEmail } from '@/lib/email/resend';
import { inquirySchema, MERCHANT_SOLUTION_VALUE } from '@/lib/validation/inquiry';
import { getPostHogClient } from '@/lib/posthog-server';

// Public route, no auth barrier — cap submissions per IP to stop spam/abuse
// (each submission does a DB insert and sends a real email via Resend).
const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_SUBMISSIONS = 5;

// The public enquiry form is the only legitimate caller of this route — it
// always submits same-origin, so this exists purely as an explicit,
// documented allow-list rather than relying on implicit browser preflight
// behavior. Never echo back an arbitrary Origin; only ever one of these
// exact values.
const ALLOWED_ORIGINS = new Set(['https://bizlinkafrica.net', 'https://www.bizlinkafrica.net']);
if (process.env.NODE_ENV !== 'production') {
  ALLOWED_ORIGINS.add('http://localhost:3000');
}

function corsHeaders(origin: string | null): HeadersInit {
  return origin && ALLOWED_ORIGINS.has(origin)
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : {};
}

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  return forwardedFor?.split(',')[0]?.trim() || 'unknown';
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  // A same-origin browser POST never sends an Origin header that fails this
  // check; this only rejects a cross-origin request that got past (or
  // skipped) preflight, e.g. a "simple" request with a form-encoded body.
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return NextResponse.json({ success: false, message: 'Invalid request origin.' }, { status: 403 });
  }
  const responseHeaders = corsHeaders(origin);
  const jsonResponse = (body: Record<string, unknown>, status = 200) =>
    NextResponse.json(body, { status, headers: responseHeaders });
  const badRequest = (message: string) => jsonResponse({ success: false, message }, 400);
  const tooManyRequests = (message: string) => jsonResponse({ success: false, message }, 429);
  const genericSuccess = () =>
    jsonResponse({
      success: true,
      message: 'Thank you for reaching out. Our team will review your application and contact you shortly.',
    });

  const ipAddress = getClientIp(request);
  const supabase = createServiceClient();

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count: recentSubmissions } = await supabase
    .from('inquiry_submission_log')
    .select('id', { count: 'exact', head: true })
    .eq('ip_address', ipAddress)
    .gte('created_at', windowStart);

  if ((recentSubmissions ?? 0) >= RATE_LIMIT_MAX_SUBMISSIONS) {
    return tooManyRequests('Too many submissions. Please try again later.');
  }

  await supabase.from('inquiry_submission_log').insert({ ip_address: ipAddress });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body.');
  }

  // Honeypot: a hidden field real users never see or fill (visually hidden
  // off-screen on the form). Any value here means an automated submission —
  // pretend success without persisting or emailing anyone, so the bot gets
  // no signal to adapt against.
  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    return genericSuccess();
  }

  const parsed = inquirySchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return badRequest(firstIssue?.message ?? 'Please check the form and try again.');
  }
  const data = parsed.data;

  // Prevent duplicate rapid submissions (e.g. double-clicking submit).
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: recentDuplicate } = await supabase
    .from('website_leads')
    .select('id')
    .eq('email', data.email)
    .eq('business_name', data.businessName)
    .gte('created_at', twoMinutesAgo)
    .limit(1)
    .maybeSingle();

  if (recentDuplicate) {
    return jsonResponse({
      success: true,
      message: 'Your inquiry has already been received. Our team will be in touch shortly.',
    });
  }

  // Merchant preliminary fields are only ever persisted alongside the
  // Merchant Payment Infrastructure solution — never on unrelated inquiries.
  const isMerchantApplication = data.requestedSolution.includes(MERCHANT_SOLUTION_VALUE);

  const { data: inserted, error: insertError } = await supabase
    .from('website_leads')
    .insert({
      full_name: data.fullName,
      business_name: data.businessName,
      email: data.email,
      phone: data.phone,
      business_type: data.businessType,
      location: data.location,
      requested_solution: data.requestedSolution,
      message: data.message || null,
      preferred_contact_method: data.preferredContactMethod || null,
      consent_given: data.consentGiven,
      status: 'new',
      notification_status: 'pending',
      merchant_business_registration_status: isMerchantApplication ? data.merchantBusinessRegistrationStatus || null : null,
      merchant_business_type: isMerchantApplication ? data.merchantBusinessType || null : null,
      merchant_monthly_volume_range: isMerchantApplication ? data.merchantMonthlyVolumeRange || null : null,
      merchant_settlement_destination: isMerchantApplication ? data.merchantSettlementDestination || null : null,
      merchant_current_collection_method: isMerchantApplication ? data.merchantCurrentCollectionMethod || null : null,
      merchant_business_locations_count: isMerchantApplication ? data.merchantBusinessLocationsCount ?? null : null,
      merchant_golive_timeline: isMerchantApplication ? data.merchantGoLiveTimeline || null : null,
      merchant_accuracy_confirmed: isMerchantApplication ? data.merchantAccuracyConfirmed === true : false,
    })
    // created_at is server-generated (db default now()), never client-supplied — the audit-friendly submission timestamp.
    .select('id, created_at')
    .single();

  if (insertError || !inserted) {
    console.error('Failed to save inquiry', insertError);
    return jsonResponse(
      { success: false, message: 'Something went wrong submitting your inquiry. Please try again.' },
      500
    );
  }

  // Capture server-side analytics — best-effort, must not affect the response.
  const distinctId = request.headers.get('x-posthog-distinct-id');
  const posthogClient = getPostHogClient();
  if (posthogClient && distinctId) {
    posthogClient.identify({
      distinctId,
      properties: { submitted_inquiry: true },
    });
    posthogClient.capture({
      distinctId,
      event: 'inquiry_received',
      properties: {
        solutions_requested: data.requestedSolution,
        preferred_contact_method: data.preferredContactMethod || null,
        has_message: (data.message ?? '').length > 0,
        is_merchant_payment_infrastructure: isMerchantApplication,
      },
    });
    await posthogClient.flush();
  }

  // The inquiry is saved. Everything from here on is best-effort — email
  // failures must not lose the lead or fail the request for the client.
  const emailResult = await sendInquiryNotificationEmail({
    fullName: data.fullName,
    businessName: data.businessName,
    email: data.email,
    phone: data.phone,
    businessType: data.businessType,
    location: data.location,
    requestedSolution: data.requestedSolution,
    message: data.message ?? '',
    preferredContactMethod: data.preferredContactMethod ?? '',
    createdAt: new Date(inserted.created_at),
  });

  const { error: updateError } = await supabase
    .from('website_leads')
    .update({
      notification_status: emailResult.success ? 'sent' : 'failed',
      notification_error: emailResult.success ? null : emailResult.error,
    })
    .eq('id', inserted.id);

  if (updateError) {
    console.error('Failed to update notification_status for inquiry', inserted.id, updateError);
  }

  return jsonResponse({
    success: true,
    message: 'Thank you for reaching out. Our team will review your application and contact you shortly.',
  });
}
