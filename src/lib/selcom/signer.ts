import 'server-only';
import { createSign } from 'node:crypto';
import { SelcomSigningError } from './errors';
import type { OrderedFields } from './types';

// RSA-SHA256 request signing, implemented directly against the documented
// algorithm at https://developer.selcom.business/ (Authorization section) —
// no third-party Selcom SDK is used (see README note in client.ts for why).
//
// Documented algorithm, verbatim from the docs' Node.js example:
//   signing_string = "timestamp=" + timestamp + "&field1=value1&field2=value2&..."
//   digest = Base64( RSA_SHA256(signing_string, PrivateKey) )
//   signed-fields: <field1>,<field2>,...   (comma-separated, in signing order)
//
// `timestamp` is always first and is never itself listed in `signed-fields`
// — only the fields that follow it in the signing string are.

// ISO 8601 UTC with milliseconds, e.g. "2026-05-27T06:01:03.273Z" — exactly
// what Date#toISOString() already produces, matching the docs' example
// value byte-for-byte. Takes an optional `now` purely so tests can assert
// against a fixed instant instead of the wall clock.
export function generateTimestamp(now: Date = new Date()): string {
  return now.toISOString();
}

// Builds the exact signing string from timestamp + the SAME ordered field
// list that also becomes the request body/query — see OrderedFields' doc
// comment in types.ts for why this is what makes field order "exactly
// match the request payload" structurally, not just by convention.
export function buildSigningString(timestamp: string, fields: OrderedFields): string {
  const pairs = fields.map(([key, value]) => `${key}=${value}`).join('&');
  return `timestamp=${timestamp}&${pairs}`;
}

// "signed-fields" header value: the field names only (no timestamp), comma
// separated, in the same order used to build the signing string.
export function buildSignedFieldsHeader(fields: OrderedFields): string {
  return fields.map(([key]) => key).join(',');
}

// Signs `signingString` with the configured RSA private key, returning the
// Base64-encoded signature (the `digest` header value). Mirrors the docs'
// Node.js example (`crypto.createSign('RSA-SHA256')` /
// `sign.sign(privateKey, 'base64')`) exactly, rather than reimplementing
// the primitive a different way.
//
// Never logs or includes `signingString` or `privateKeyPem` in a thrown
// error — a signing failure is almost always a malformed key, and the
// caller only needs to know that, not see the inputs.
export function signRequest(signingString: string, privateKeyPem: string, correlationId?: string): string {
  try {
    const sign = createSign('RSA-SHA256');
    sign.update(signingString, 'utf8');
    return sign.sign(privateKeyPem, 'base64');
  } catch {
    throw new SelcomSigningError('Failed to sign the Selcom request. Check SELCOM_RSA_PRIVATE_KEY.', correlationId);
  }
}

export interface SelcomAuthHeaders {
  'api-key': string;
  timestamp: string;
  digest: string;
  'signed-fields': string;
  'content-type': string;
  accept: string;
  [key: string]: string;
}

// Produces the complete, documented header set for one signed request.
// Building it from the same `fields`/`timestamp` used for the signing
// string (rather than re-deriving them) is what guarantees the digest and
// the headers can never drift apart within a single call.
export function buildSignedRequestHeaders(params: {
  apiKey: string;
  privateKeyPem: string;
  fields: OrderedFields;
  timestamp?: string;
  correlationId?: string;
}): SelcomAuthHeaders {
  const timestamp = params.timestamp ?? generateTimestamp();
  const signingString = buildSigningString(timestamp, params.fields);
  const digest = signRequest(signingString, params.privateKeyPem, params.correlationId);

  return {
    'api-key': params.apiKey,
    timestamp,
    digest,
    'signed-fields': buildSignedFieldsHeader(params.fields),
    'content-type': 'application/json',
    accept: 'application/json',
  };
}
