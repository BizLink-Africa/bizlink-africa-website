import 'server-only';
import { createHash } from 'crypto';

// Not a substitute for hashing the actual rendered policy documents (those
// live as page content, not a versioned document store) — a reproducible,
// auditable fingerprint of exactly which versions a merchant accepted.
export function computeDocumentHash(termsVersion: string, privacyVersion: string): string {
  return createHash('sha256').update(`${termsVersion}:${privacyVersion}`).digest('hex');
}
