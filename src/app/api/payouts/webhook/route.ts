import { NextResponse } from 'next/server';
import { SandboxDisbursementAdapter } from '@/lib/payouts/disbursement-adapter';

// Placeholder inbound webhook endpoint for a future live disbursement
// provider. No provider is configured yet, so this only ever exercises
// SandboxDisbursementAdapter.verifyWebhook() — which always reports
// invalid, since sandbox mode has no real signing key to check a signature
// against. A live implementation must verify the signature using the
// provider's documented scheme before trusting anything in the payload,
// and must never update a payout's status from an unverified webhook.
export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get('x-webhook-signature');

  const adapter = new SandboxDisbursementAdapter();
  const result = await adapter.verifyWebhook(payload, signature);

  if (!result.valid) {
    return NextResponse.json({ error: result.reason ?? 'Webhook signature could not be verified.' }, { status: 401 });
  }

  // Unreachable while only SandboxDisbursementAdapter exists — kept so the
  // shape is settled for when a live adapter is implemented.
  return NextResponse.json({ received: true });
}
