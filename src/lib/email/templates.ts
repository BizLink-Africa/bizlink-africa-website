import 'server-only';
import { REQUESTED_SOLUTIONS, PREFERRED_CONTACT_METHODS, labelFor } from '@/data/inquiries';

export interface InquiryEmailInput {
  fullName: string;
  businessName: string;
  email: string;
  phone: string;
  businessType: string;
  location: string;
  requestedSolution: string[];
  message: string;
  preferredContactMethod: string;
  createdAt: Date;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatSolutions(values: string[]): string {
  return values.length
    ? values.map((value) => labelFor(REQUESTED_SOLUTIONS, value)).join(', ')
    : 'Not specified';
}

function formatDate(date: Date): string {
  return date.toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Dar_es_Salaam',
  });
}

export function buildInternalNotificationEmail(inquiry: InquiryEmailInput) {
  const solutions = formatSolutions(inquiry.requestedSolution);
  const contactMethod = labelFor(PREFERRED_CONTACT_METHODS, inquiry.preferredContactMethod);
  const submittedAt = formatDate(inquiry.createdAt);

  const rows: Array<[string, string]> = [
    ['Full Name', inquiry.fullName],
    ['Business Name', inquiry.businessName],
    ['Email', inquiry.email],
    ['Phone/WhatsApp', inquiry.phone],
    ['Location', inquiry.location],
    ['Business Type / Service Offered', inquiry.businessType],
    ['Requested Solution', solutions],
    ['Preferred Contact Method', contactMethod],
    ['Date Submitted', submittedAt],
  ];

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1b1c1c; max-width: 560px; margin: 0 auto;">
      <div style="background:#00342b; color:#fff; padding:20px 24px;">
        <h1 style="margin:0; font-size:18px;">New BizLink Africa Inquiry</h1>
      </div>
      <div style="padding:24px; border:1px solid #bfc9c4; border-top:none;">
        <table style="width:100%; border-collapse:collapse; font-size:14px;">
          ${rows
            .map(
              ([label, value]) => `
            <tr>
              <td style="padding:6px 0; color:#707975; vertical-align:top; width:220px;">${escapeHtml(label)}</td>
              <td style="padding:6px 0;">${escapeHtml(value)}</td>
            </tr>`
            )
            .join('')}
        </table>
        <div style="margin-top:16px;">
          <p style="color:#707975; font-size:13px; margin:0 0 4px;">Message</p>
          <p style="white-space:pre-wrap; margin:0;">${escapeHtml(inquiry.message || 'No additional message provided.')}</p>
        </div>
      </div>
    </div>
  `;

  const text = [
    'New BizLink Africa Inquiry',
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    'Message:',
    inquiry.message || 'No additional message provided.',
  ].join('\n');

  return {
    subject: `New BizLink Africa Inquiry: ${inquiry.businessName}`,
    html,
    text,
  };
}

export interface ExecutiveDecisionEmailInput {
  itemTitle: string;
  actionType: string;
  decidedBy: string;
  comment: string | null;
  href: string;
}

export function buildExecutiveDecisionEmail(input: ExecutiveDecisionEmailInput) {
  // input.href is always an /admin/... dashboard link — this must resolve
  // on the admin host, not the public marketing site (see src/proxy.ts:
  // the public host 404s every /admin/* path after host separation).
  const siteUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3000';
  const html = `
    <div style="font-family: Arial, sans-serif; color: #1b1c1c; max-width: 560px; margin: 0 auto;">
      <div style="background:#00342b; color:#fff; padding:20px 24px;">
        <h1 style="margin:0; font-size:18px;">Executive Decision Recorded</h1>
      </div>
      <div style="padding:24px; border:1px solid #bfc9c4; border-top:none;">
        <p style="margin:0 0 12px;"><strong>${escapeHtml(input.itemTitle)}</strong></p>
        <p style="margin:0 0 12px; color:#707975;">Action: ${escapeHtml(input.actionType)} — by ${escapeHtml(input.decidedBy)}</p>
        ${input.comment ? `<p style="margin:0 0 16px; white-space:pre-wrap;">${escapeHtml(input.comment)}</p>` : ''}
        <a href="${siteUrl}${input.href}" style="color:#00342b;">View record</a>
      </div>
    </div>
  `;
  const text = [
    'Executive Decision Recorded',
    input.itemTitle,
    `Action: ${input.actionType} — by ${input.decidedBy}`,
    input.comment ?? '',
    `${siteUrl}${input.href}`,
  ].join('\n');

  return {
    subject: `Executive Decision: ${input.itemTitle}`,
    html,
    text,
  };
}
