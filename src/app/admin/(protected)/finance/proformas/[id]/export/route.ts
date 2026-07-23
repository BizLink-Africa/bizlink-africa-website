import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/supabase/dal';
import { createClient } from '@/lib/supabase/server';
import { FEE_FIELDS, type ProformaInvoice, type LineItem } from '@/data/finance';

function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvEscape).join(',') + '\r\n';
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('proformas.view');
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();

  const [{ data: proforma, error }, { data: lineItems }] = await Promise.all([
    supabase.from('proforma_invoices').select('*').eq('id', id).single(),
    supabase.from('proforma_line_items').select('*').eq('proforma_id', id).order('created_at', { ascending: true }),
  ]);

  if (error || !proforma) {
    return NextResponse.json({ error: 'Proforma invoice not found' }, { status: 404 });
  }
  const p = proforma as ProformaInvoice;
  const items = (lineItems ?? []) as LineItem[];

  let csv = csvRow([`Proforma Invoice ${p.proforma_number}`]);
  csv += csvRow(['Client', p.client_business_name]);
  csv += csvRow(['Valid Until', p.valid_until ?? '']);
  csv += csvRow(['Status', p.status]);
  csv += '\r\n';

  if (items.length > 0) {
    csv += csvRow(['Line Items']);
    csv += csvRow(['Category', 'Description', 'Quantity', 'Unit Price', 'Line Total']);
    for (const item of items) {
      csv += csvRow([item.category, item.description, item.quantity, item.unit_price, item.line_total]);
    }
    csv += '\r\n';
  }

  csv += csvRow(['Fees']);
  for (const field of FEE_FIELDS) {
    csv += csvRow([field.label, p[field.key]]);
  }
  csv += csvRow(['Subtotal', p.subtotal]);
  csv += csvRow(['Discount', p.discount]);
  csv += csvRow([`Tax (${p.tax_percentage}%)`, p.tax_amount]);
  csv += csvRow(['Total', p.total]);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${p.proforma_number}.csv"`,
    },
  });
}
