export interface ModuleAvailable<T> {
  available: true;
  data: T;
}

export interface ModuleUnavailable {
  available: false;
  moduleLabel: string;
  reason: string;
}

// Every dashboard data source returns one of these — never fabricated
// numbers for a module that doesn't exist yet. Components render an honest
// "not connected" state for the unavailable case instead of a zero that
// could be mistaken for a real zero.
export type ModuleResult<T> = ModuleAvailable<T> | ModuleUnavailable;

export function unavailable(moduleLabel: string, reason: string): ModuleUnavailable {
  return { available: false, moduleLabel, reason };
}

export interface Kpi {
  key: string;
  label: string;
  value: number | string;
  href?: string;
  accent?: 'default' | 'danger' | 'warning' | 'success';
}

export interface ActionItem {
  id: string;
  title: string;
  detail: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  href: string;
}

export interface TrendPoint {
  label: string;
  value: number;
}

export type DateRangeKey = '7d' | '30d' | '90d' | 'ytd';

export const DATE_RANGE_OPTIONS: { value: DateRangeKey; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'ytd', label: 'Year to date' },
];

export function resolveDateRange(key: DateRangeKey): { from: Date; label: string } {
  const now = new Date();
  switch (key) {
    case '7d':
      return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), label: 'Last 7 days' };
    case '90d':
      return { from: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), label: 'Last 90 days' };
    case 'ytd':
      return { from: new Date(now.getFullYear(), 0, 1), label: 'Year to date' };
    case '30d':
    default:
      return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), label: 'Last 30 days' };
  }
}
