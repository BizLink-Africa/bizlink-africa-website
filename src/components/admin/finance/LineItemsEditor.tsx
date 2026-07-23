'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { FEE_FIELDS, formatMoney, type LineItemCategory, type LineItemInput } from '@/data/finance';

interface EditableRow extends LineItemInput {
  key: string;
}

let rowKeySeq = 0;
function newRowKey() {
  rowKeySeq += 1;
  return `row-${rowKeySeq}`;
}

export default function LineItemsEditor({
  initialItems,
  currency,
  readOnly,
  onSave,
}: {
  initialItems: LineItemInput[];
  currency: string;
  readOnly: boolean;
  onSave: (items: LineItemInput[]) => Promise<{ success: boolean; message?: string }>;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<EditableRow[]>(
    initialItems.length > 0
      ? initialItems.map((item) => ({ ...item, key: newRowKey() }))
      : []
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const inputClass = 'w-full border border-[#bfc9c4] px-2 py-1.5 text-sm focus:border-[#00342b] focus:outline-none';

  const addRow = () => {
    setRows((prev) => [...prev, { key: newRowKey(), category: FEE_FIELDS[0].key, description: '', quantity: 1, unit_price: 0 }]);
  };

  const updateRow = (key: string, patch: Partial<LineItemInput>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const total = rows.reduce((sum, r) => sum + r.quantity * r.unit_price, 0);

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await onSave(rows.map(({ category, description, quantity, unit_price }) => ({ category, description, quantity, unit_price })));
    setSaving(false);
    if (result.success) {
      setFeedback({ type: 'success', text: 'Line items saved — totals updated.' });
      router.refresh();
    } else {
      setFeedback({ type: 'error', text: result.message ?? 'Failed to save line items.' });
    }
  };

  if (readOnly && rows.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-[#bfc9c4] p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-[#00342b]">Line Items</h2>
        {!readOnly && (
          <button type="button" onClick={addRow} className="print:hidden inline-flex items-center gap-1.5 text-xs font-medium text-[#00342b] border border-[#00342b] px-3 py-1.5 hover:bg-[#00342b] hover:text-white transition-colors">
            <Plus size={12} /> Add Item
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-[#707975]">No itemized line items — this document uses the fee totals below directly.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-[#bfc9c4] text-left text-xs font-semibold text-[#707975] uppercase tracking-wider">
                <th className="py-2 pr-2">Category</th>
                <th className="py-2 pr-2">Description</th>
                <th className="py-2 pr-2 w-20">Qty</th>
                <th className="py-2 pr-2 w-32">Unit Price</th>
                <th className="py-2 pr-2 w-32 text-right">Line Total</th>
                {!readOnly && <th className="py-2 w-8"></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-[#e5e5e5] last:border-0">
                  <td className="py-2 pr-2">
                    {readOnly ? (
                      FEE_FIELDS.find((f) => f.key === row.category)?.label ?? row.category
                    ) : (
                      <select value={row.category} onChange={(e) => updateRow(row.key, { category: e.target.value as LineItemCategory })} className={inputClass}>
                        {FEE_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    {readOnly ? row.description : (
                      <input value={row.description} onChange={(e) => updateRow(row.key, { description: e.target.value })} className={inputClass} />
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    {readOnly ? row.quantity : (
                      <input type="number" min={0} step="0.01" value={row.quantity} onChange={(e) => updateRow(row.key, { quantity: Number(e.target.value) || 0 })} className={inputClass} />
                    )}
                  </td>
                  <td className="py-2 pr-2 tabular-nums">
                    {readOnly ? formatMoney(row.unit_price, currency) : (
                      <input type="number" min={0} step="0.01" value={row.unit_price} onChange={(e) => updateRow(row.key, { unit_price: Number(e.target.value) || 0 })} className={inputClass} />
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{formatMoney(row.quantity * row.unit_price, currency)}</td>
                  {!readOnly && (
                    <td className="py-2">
                      <button type="button" onClick={() => removeRow(row.key)} className="text-[#707975] hover:text-red-700">
                        <X size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#bfc9c4]">
                <td colSpan={4} className="py-2 font-semibold text-[#00342b]">Line Items Total</td>
                <td className="py-2 text-right font-semibold text-[#00342b] tabular-nums">{formatMoney(total, currency)}</td>
                {!readOnly && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!readOnly && (
        <div className="print:hidden mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-[#00342b] text-white px-4 py-2 text-sm font-medium hover:bg-[#004d40] transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Line Items'}
          </button>
          {feedback && (
            <p className={`text-sm ${feedback.type === 'success' ? 'text-[#1b7a3d]' : 'text-red-700'}`}>{feedback.text}</p>
          )}
        </div>
      )}
    </div>
  );
}
