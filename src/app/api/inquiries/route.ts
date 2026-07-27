import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendInquiryNotificationEmail } from '@/lib/email/resend';
import { REQUESTED_SOLUTIONS, PREFERRED_CONTACT_METHODS } from '@/data/inquiries';
import { getPostHogClient } from '@/lib/posthog-server';

const VALID_SOLUTIONS = new Set<string>(REQUESTED_SOLUTIONS.map((s) => s.value));
const VALID_CONTACT_METHODS = new Set<string>(PREFERRED_CONTACT_METHODS.map((m) => m.value));

const MAX_TEXT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 5000;

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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
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

  const fullName = typeof body.fullName === 'string' ? body.fullName.trim().slice(0, MAX_TEXT_LENGTH) : '';
  const businessName = typeof body.businessName === 'string' ? body.businessName.trim().slice(0, MAX_TEXT_LENGTH) : '';
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, MAX_TEXT_LENGTH) : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, MAX_TEXT_LENGTH) : '';
  const businessType = typeof body.businessType === 'string' ? body.businessType.trim().slice(0, MAX_TEXT_LENGTH) : '';
  const location = typeof body.location === 'string' ? body.location.trim().slice(0, MAX_TEXT_LENGTH) : '';
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, MAX_MESSAGE_LENGTH) : '';
  const preferredContactMethod = typeof body.preferredContactMethod === 'string' ? body.preferredContactMethod : '';
  const requestedSolution = Array.isArray(body.requestedSolution)
    ? body.requestedSolution.filter((v): v is string => typeof v === 'string')
    : [];
  const consentGiven = body.consentGiven === true;

  // Server-side validation of every required field — the public form must
  // never be trusted to have enforced this itself.
  if (
    !isNonEmptyString(fullName) ||
    !isNonEmptyString(businessName) ||
    !isNonEmptyString(email) ||
    !isNonEmptyString(phone) ||
    !isNonEmptyString(businessType) ||
    !isNonEmptyString(location)
  ) {
    return badRequest('Please fill in all required fields.');
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return badRequest('Please provide a valid email address.');
  }

  if (requestedSolution.length === 0 || !requestedSolution.every((s) => VALID_SOLUTIONS.has(s))) {
    return badRequest('Please select at least one solution you need.');
  }

  if (preferredContactMethod && !VALID_CONTACT_METHODS.has(preferredContactMethod)) {
    return badRequest('Invalid preferred contact method.');
  }

  if (!consentGiven) {
    return badRequest('Please confirm BizLink Africa may contact you about your inquiry.');
  }

  // Prevent duplicate rapid submissions (e.g. double-clicking submit).
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: recentDuplicate } = await supabase
    .from('website_leads')
    .select('id')
    .eq('email', email)
    .eq('business_name', businessName)
    .gte('created_at', twoMinutesAgo)
    .limit(1)
    .maybeSingle();

  if (recentDuplicate) {
    return jsonResponse({
      success: true,
      message: 'Your inquiry has already been received. Our team will be in touch shortly.',
    });
  }

  const { data: inserted, error: insertError } = await supabase
    .from('website_leads')
    .insert({
      full_name: fullName,
      business_name: businessName,
      email,
      phone,
      business_type: businessType,
      location,
      requested_solution: requestedSolution,
      message: message || null,
      preferred_contact_method: preferredContactMethod || null,
      consent_given: consentGiven,
      status: 'new',
      notification_status: 'pending',
    })
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
        solutions_requested: requestedSolution,
        preferred_contact_method: preferredContactMethod || null,
        has_message: message.length > 0,
      },
    });
    await posthogClient.flush();
  }

  // The inquiry is saved. Everything from here on is best-effort — email
  // failures must not lose the lead or fail the request for the client.
  const emailResult = await sendInquiryNotificationEmail({
    fullName,
    businessName,
    email,
    phone,
    businessType,
    location,
    requestedSolution,
    message,
    preferredContactMethod,
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
