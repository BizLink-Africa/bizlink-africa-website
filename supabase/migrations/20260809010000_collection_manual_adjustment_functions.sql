-- Applying an approved manual adjustment updates other_authorised_adjustment
-- via SQL numeric addition (never "oldValue + newValue" computed in
-- JavaScript) — net_merchant_amount then recomputes automatically since it
-- is a stored generated column. A transaction that is already
-- settlement-eligible can never be adjusted; it would have to be
-- re-reconciled first.

create or replace function apply_collection_manual_adjustment(
  p_adjustment_id uuid,
  p_review_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_adj record;
  v_txn record;
  v_performer text;
begin
  if not has_permission('collections.approve') then
    raise exception 'Missing required permission: collections.approve';
  end if;

  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_adj from collection_manual_adjustments where id = p_adjustment_id for update;
  if not found then
    raise exception 'Manual adjustment not found';
  end if;
  if v_adj.status <> 'pending_approval' then
    raise exception 'This adjustment has already been reviewed';
  end if;

  select * into v_txn from collection_transactions where id = v_adj.transaction_id for update;
  if not found then
    raise exception 'Transaction not found';
  end if;
  if v_txn.settlement_eligibility then
    raise exception 'Cannot adjust a transaction that is already settlement-eligible — it must be re-reconciled first.';
  end if;

  update collection_transactions
    set other_authorised_adjustment = other_authorised_adjustment + v_adj.adjustment_amount
  where id = v_adj.transaction_id;

  update collection_manual_adjustments set
    status = 'approved', approved_by = v_performer, approved_at = now(), review_notes = p_review_notes
  where id = p_adjustment_id;
end;
$$;

create or replace function reject_collection_manual_adjustment(
  p_adjustment_id uuid,
  p_review_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_adj record;
  v_performer text;
begin
  if not has_permission('collections.approve') then
    raise exception 'Missing required permission: collections.approve';
  end if;

  v_performer := coalesce((select email from auth.users where id = auth.uid()), 'unknown');

  select * into v_adj from collection_manual_adjustments where id = p_adjustment_id for update;
  if not found then
    raise exception 'Manual adjustment not found';
  end if;
  if v_adj.status <> 'pending_approval' then
    raise exception 'This adjustment has already been reviewed';
  end if;

  update collection_manual_adjustments set
    status = 'rejected', approved_by = v_performer, approved_at = now(), review_notes = p_review_notes
  where id = p_adjustment_id;
end;
$$;

revoke execute on function apply_collection_manual_adjustment(uuid, text) from public;
grant execute on function apply_collection_manual_adjustment(uuid, text) to authenticated;
revoke execute on function apply_collection_manual_adjustment(uuid, text) from anon;

revoke execute on function reject_collection_manual_adjustment(uuid, text) from public;
grant execute on function reject_collection_manual_adjustment(uuid, text) to authenticated;
revoke execute on function reject_collection_manual_adjustment(uuid, text) from anon;
