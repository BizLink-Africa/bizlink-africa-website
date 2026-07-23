import { redirect } from 'next/navigation';

// The single monolithic Settings page was split into the dedicated
// Company/Contract/Finance/Support/Marketing/Technology/Compliance/
// Security/Email/Notification/System settings pages under Administration
// (see NAV_GROUPS['Administration'] in src/data/navigation.ts) — this route
// is kept only so old bookmarks/links to /admin/settings land somewhere
// real instead of 404ing.
export default function SettingsRedirectPage() {
  redirect('/admin/settings/company');
}
