import type { HealthStatus } from './systemHealth';

export interface DatabaseHealthMetric {
  id: string;
  metric_name: string;
  value: number | null;
  unit: string | null;
  status: HealthStatus;
  recorded_at: string;
}
