'use client';

import { useRef, useState } from 'react';
import { Upload, FlaskConical } from 'lucide-react';
import { importCollectionStatementCsv, importSandboxStatement, type ImportResult } from '@/app/admin/(protected)/merchant-operations/collections/actions';

export default function ImportStatementForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [sandboxFrom, setSandboxFrom] = useState(new Date().toISOString().slice(0, 10));

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubmitting(true);
    setResult(null);
    const formData = new FormData();
    formData.append('file', file);
    const outcome = await importCollectionStatementCsv(formData);
    setSubmitting(false);
    setResult(outcome);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSandboxImport = async () => {
    setSubmitting(true);
    setResult(null);
    const outcome = await importSandboxStatement(sandboxFrom, sandboxFrom);
    setSubmitting(false);
    setResult(outcome);
  };

  return (
    <div className="bg-white border border-[#bfc9c4] p-6 mb-6">
      <h2 className="font-semibold text-[#00342b] mb-1">Import Statement</h2>
      <p className="text-xs text-[#707975] mb-4">
        Manual import only — no live provider API is connected. Sandbox mode generates clearly-synthetic test rows.
      </p>

      <div className="flex flex-wrap items-center gap-6">
        <label className="inline-flex items-center gap-2 text-sm font-medium text-white bg-[#00342b] px-4 py-2.5 hover:bg-[#004d40] transition-colors cursor-pointer disabled:opacity-60">
          <Upload size={14} /> Upload CSV
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCsvUpload} disabled={submitting} className="hidden" />
        </label>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={sandboxFrom}
            onChange={(e) => setSandboxFrom(e.target.value)}
            className="border border-[#bfc9c4] px-2 py-2 text-sm focus:border-[#00342b] focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSandboxImport}
            disabled={submitting}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors disabled:opacity-60"
          >
            <FlaskConical size={14} /> Import Sandbox Data
          </button>
        </div>
      </div>

      {submitting && <p className="text-xs text-[#707975] mt-3">Importing…</p>}

      {result && (
        <div className={`mt-4 text-sm px-3 py-2 border ${result.success ? 'text-[#1b7a3d] bg-[#dcf5e3] border-[#b7e3c4]' : 'text-red-700 bg-red-50 border-red-200'}`}>
          {result.success ? (
            <p>Imported {result.imported} row{result.imported === 1 ? '' : 's'}{result.duplicates ? `, ${result.duplicates} flagged as duplicate` : ''}.</p>
          ) : (
            <p>{result.message}</p>
          )}
          {result.rowErrors && result.rowErrors.length > 0 && (
            <ul className="mt-2 text-xs list-disc pl-5">
              {result.rowErrors.slice(0, 10).map((e, i) => (
                <li key={i}>Row {e.row}: {e.message}</li>
              ))}
              {result.rowErrors.length > 10 && <li>…and {result.rowErrors.length - 10} more.</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
