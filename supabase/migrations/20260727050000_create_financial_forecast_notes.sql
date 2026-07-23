-- Financial Forecasting: the forecast NUMBERS (revenue/expense/cash-flow/
-- receivables) are computed live from real invoices/expenses data at
-- render time (trailing-3-month average, projected forward) — never
-- stored, so they can never drift from what actually happened. This table
-- only persists the qualitative "Scenario Notes" a CFO/CEO attaches to a
-- given forecast period.

insert into permissions (id, module, description) values
  ('forecasting.view', 'forecasting', 'View financial forecasts'),
  ('forecasting.manage', 'forecasting', 'Add scenario notes to financial forecasts')
on conflict (id) do nothing;

create table if not exists financial_forecast_notes (
  id uuid primary key default gen_random_uuid(),
  period text not null,
  scenario_notes text not null,
  created_by text,
  created_at timestamp with time zone not null default now()
);

alter table financial_forecast_notes enable row level security;
create policy "forecasting.view can select financial_forecast_notes" on financial_forecast_notes for select to authenticated using (has_permission('forecasting.view'));
create policy "forecasting.manage can insert financial_forecast_notes" on financial_forecast_notes for insert to authenticated with check (has_permission('forecasting.manage'));

insert into role_permissions (role_id, permission_id) values
  ('super_admin', 'forecasting.view'), ('super_admin', 'forecasting.manage'),
  ('cfo', 'forecasting.view'), ('cfo', 'forecasting.manage'),
  ('ceo', 'forecasting.view')
on conflict do nothing;
