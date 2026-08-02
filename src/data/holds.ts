export const SETTLEMENT_HOLD_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'released', label: 'Released' },
] as const;

export type SettlementHoldStatus = (typeof SETTLEMENT_HOLD_STATUSES)[number]['value'];

export const SETTLEMENT_HOLD_STATUS_COLORS: Record<string, string> = {
  active: 'bg-red-100 text-red-700',
  expired: 'bg-orange-100 text-orange-800',
  released: 'bg-[#efeded] text-[#707975]',
};

export const SETTLEMENT_HOLD_EVENT_LABELS: Record<string, string> = {
  placed: 'Hold Placed',
  release_requested: 'Release Requested',
  release_approved: 'Release Approved',
  release_rejected: 'Release Rejected',
};

export interface SettlementHold {
  id: string;
  merchant_id: string;
  transaction_id: string | null;
  batch_id: string | null;
  hold_reason: string;
  hold_amount: string;
  status: SettlementHoldStatus;
  created_by: string;
  placed_at: string;
  expires_at: string | null;
  release_requested_by: string | null;
  release_requested_at: string | null;
  release_request_reason: string | null;
  approved_by: string | null;
  released_at: string | null;
  release_reason: string | null;
  created_at: string;
}

export interface SettlementHoldEvent {
  id: string;
  hold_id: string;
  event_type: string;
  performed_by: string;
  performed_at: string;
  notes: string | null;
}

// Derived, display-only — a hold with expires_at in the past is not
// automatically released (no scheduler exists for that), but it is worth
// flagging distinctly from a genuinely active, unexpired hold.
export function isHoldOverdue(hold: Pick<SettlementHold, 'status' | 'expires_at'>, now: string = new Date().toISOString()): boolean {
  return hold.status === 'active' && hold.expires_at !== null && hold.expires_at < now;
}
