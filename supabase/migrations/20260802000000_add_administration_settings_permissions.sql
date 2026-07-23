-- Administration: one view/manage permission pair per settings group that
-- doesn't already have one (Finance/Support/Technology settings already
-- have their own from earlier modules — reused as-is, not duplicated here).
-- Plus notifications.view/manage for the new in-app notification center.

insert into permissions (id, module, description) values
  ('company.settings.view', 'settings', 'View company settings'),
  ('company.settings.manage', 'settings', 'Change company settings'),
  ('contract.settings.view', 'settings', 'View contract settings'),
  ('contract.settings.manage', 'settings', 'Change contract settings'),
  ('marketing.settings.view', 'settings', 'View marketing settings'),
  ('marketing.settings.manage', 'settings', 'Change marketing settings'),
  ('compliance.settings.view', 'settings', 'View compliance settings'),
  ('compliance.settings.manage', 'settings', 'Change compliance settings'),
  ('security.settings.view', 'settings', 'View security settings'),
  ('security.settings.manage', 'settings', 'Change security settings'),
  ('email.settings.view', 'settings', 'View email settings'),
  ('email.settings.manage', 'settings', 'Change email settings'),
  ('notification.settings.view', 'settings', 'View notification settings'),
  ('notification.settings.manage', 'settings', 'Change notification settings'),
  ('system.settings.view', 'settings', 'View system settings'),
  ('system.settings.manage', 'settings', 'Change system settings'),
  ('notifications.view', 'notifications', 'View in-app notifications'),
  ('notifications.manage', 'notifications', 'Broadcast in-app notifications')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id)
  select 'super_admin', id from permissions
  where id in (
    'company.settings.view', 'company.settings.manage',
    'contract.settings.view', 'contract.settings.manage',
    'marketing.settings.view', 'marketing.settings.manage',
    'compliance.settings.view', 'compliance.settings.manage',
    'security.settings.view', 'security.settings.manage',
    'email.settings.view', 'email.settings.manage',
    'notification.settings.view', 'notification.settings.manage',
    'system.settings.view', 'system.settings.manage',
    'notifications.view', 'notifications.manage'
  )
  and id not in (select permission_id from role_permissions where role_id = 'super_admin')
on conflict do nothing;

-- CEO: broad view visibility (same "exec sees everything" pattern as every
-- other module), plus manage on Company Settings specifically (identity/
-- branding/registration is an executive decision, same tier as
-- policies.manage already granted to CEO).
insert into role_permissions (role_id, permission_id) values
  ('ceo', 'company.settings.view'), ('ceo', 'company.settings.manage'),
  ('ceo', 'contract.settings.view'),
  ('ceo', 'marketing.settings.view'),
  ('ceo', 'compliance.settings.view'),
  ('ceo', 'security.settings.view'),
  ('ceo', 'email.settings.view'),
  ('ceo', 'notification.settings.view'),
  ('ceo', 'system.settings.view'),
  ('operations', 'contract.settings.view'), ('operations', 'contract.settings.manage'),
  ('marketing', 'marketing.settings.view'), ('marketing', 'marketing.settings.manage'),
  ('compliance_security', 'compliance.settings.view'), ('compliance_security', 'compliance.settings.manage'),
  ('compliance_security', 'security.settings.view'), ('compliance_security', 'security.settings.manage'),
  ('cto', 'email.settings.view'), ('cto', 'system.settings.view'), ('cto', 'system.settings.manage')
on conflict do nothing;

-- notifications.view: every existing role gets it — an in-app inbox of
-- items relevant to you is not a privileged capability, unlike every other
-- permission in this migration. notifications.manage (broadcasting) stays
-- restricted to super_admin/ceo above.
insert into role_permissions (role_id, permission_id) values
  ('cfo', 'notifications.view'), ('cto', 'notifications.view'), ('operations', 'notifications.view'),
  ('customer_support', 'notifications.view'), ('marketing', 'notifications.view'),
  ('compliance_security', 'notifications.view'), ('ceo', 'notifications.view')
on conflict do nothing;
