'use client';

import { Printer, Download } from 'lucide-react';

// Printing/Download use the browser's own print-to-PDF (no PDF library in
// this codebase — every other "export" here is a CSV route, same idiom
// used for Download). The detail page's print:hidden classes hide the
// Actions/Activity History sections and every editor's controls so what
// prints is just the client/fee/line-item breakdown.
export default function ProformaPrintButton({ proformaId }: { proformaId: string }) {
  return (
    <div className="print:hidden flex items-center gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-1.5 hover:bg-[#00342b] hover:text-white transition-colors"
      >
        <Printer size={12} /> Print
      </button>
      <a
        href={`/admin/finance/proformas/${proformaId}/export`}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-1.5 hover:bg-[#00342b] hover:text-white transition-colors"
      >
        <Download size={12} /> Download CSV
      </a>
    </div>
  );
}
