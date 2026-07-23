import 'server-only';
import { Resend } from 'resend';
import { buildInternalNotificationEmail, type InquiryEmailInput } from '@/lib/email/templates';

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? new Resend(apiKey) : null;
}

export type SendEmailResult = { success: true } | { success: false; error: string };

// Generic sender, extracted from the original single-purpose inquiry
// notification below — same soft-fail-if-unconfigured, never-throw contract,
// but takes an arbitrary recipient/subject/body instead of being hardcoded
// to one fixed inquiry template and one fixed address.
export async function sendEmail(input: { to: string; subject: string; html: string; text?: string }): Promise<SendEmailResult> {
  const resend = getResendClient();
  const fromAddress = process.env.RESEND_FROM_EMAIL;

  if (!resend || !fromAddress) {
    const error = 'Resend is not configured (missing RESEND_API_KEY or RESEND_FROM_EMAIL).';
    console.error(error);
    return { success: false, error };
  }

  const { error } = await resend.emails.send({
    from: fromAddress,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  if (error) {
    console.error('Failed to send email', input.to, error);
    return { success: false, error: error.message ?? 'Unknown Resend error.' };
  }

  return { success: true };
}

export type SendInquiryEmailResult = { success: true } | { success: false; error: string };

// Sends the single internal notification to BIZLINK_NOTIFICATION_EMAIL only —
// no CC, no BCC, no other recipients. Never throws — the caller (the
// /api/inquiries route) must keep the saved inquiry regardless of email
// outcome and just record notification_status/notification_error accordingly.
export async function sendInquiryNotificationEmail(
  inquiry: InquiryEmailInput
): Promise<SendInquiryEmailResult> {
  const resend = getResendClient();
  const fromAddress = process.env.RESEND_FROM_EMAIL;
  const notificationEmail = process.env.BIZLINK_NOTIFICATION_EMAIL;

  if (!resend || !fromAddress || !notificationEmail) {
    const error = 'Resend is not configured (missing RESEND_API_KEY, RESEND_FROM_EMAIL, or BIZLINK_NOTIFICATION_EMAIL).';
    console.error(error);
    return { success: false, error };
  }

  const internal = buildInternalNotificationEmail(inquiry);

  const { error } = await resend.emails.send({
    from: fromAddress,
    to: notificationEmail,
    subject: internal.subject,
    html: internal.html,
    text: internal.text,
    replyTo: inquiry.email,
  });

  if (error) {
    console.error('Failed to send internal inquiry notification email', error);
    return { success: false, error: error.message ?? 'Unknown Resend error.' };
  }

  return { success: true };
}
