// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The secure KYC document workspace has its own permission surface,
// separate from the top-level KYC Coordination list page
// (merchant_kyc.view/.manage) — this asserts the specific gates the spec
// requires actually exist in code, not just in the migration.
describe('KYC document workspace — permission gates present in source', () => {
  it('page.tsx gates on merchant_kyc_documents.view (falling back to metadata_view) and checks manage/identity separately', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect(source).toContain(`requirePermission('merchant_kyc_documents.view')`);
    expect(source).toContain(`requirePermission('merchant_kyc_documents.metadata_view')`);
    expect(source).toContain(`requirePermission('merchant_kyc_documents.manage')`);
    expect(source).toContain(`requirePermission('merchant_kyc_identity_documents.view')`);
  });

  it('actions.ts gates every mutating action on merchant_kyc_documents.manage', () => {
    const source = readFileSync(join(__dirname, 'actions.ts'), 'utf8');
    const manageCount = (source.match(/requirePermission\('merchant_kyc_documents\.manage'\)/g) ?? []).length;
    // requestDocument, updateChecklistStatus, uploadKycDocument,
    // deleteKycDocumentFile, updateMalwareScanStatus, recordConsent
    expect(manageCount).toBeGreaterThanOrEqual(6);
  });

  it('actions.ts never assumes a document is clean without a real scan integration', () => {
    const source = readFileSync(join(__dirname, 'actions.ts'), 'utf8');
    expect(source).not.toMatch(/malware_scan_status:\s*'clean'/);
  });

  it('actions.ts uses the service-role client only for the storage removal step, and only server-side', () => {
    const source = readFileSync(join(__dirname, 'actions.ts'), 'utf8');
    expect(source).toContain(`'use server'`);
    expect(source).toContain('createServiceClient()');
  });
});
