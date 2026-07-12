-- Tracks the Resend error message when the CEO notification email fails to
-- send, so the Super Admin dashboard can surface why notification_status
-- is 'failed' without needing to check server logs.

alter table website_leads
  add column if not exists notification_error text;
