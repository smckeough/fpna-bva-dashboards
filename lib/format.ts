import type { MetricKind } from './types';

const usd0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const num0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const num1 = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function fmtValue(v: number | null | undefined, kind: MetricKind): string {
  if (v == null || Number.isNaN(v)) return '—';
  switch (kind) {
    case 'currency':
      return usd0.format(v);
    case 'headcount':
    case 'count':
    case 'number':
      return num0.format(v);
    case 'percent':
      return `${num1.format(v * 100)}%`;
    default:
      return num0.format(v);
  }
}

export function fmtVarPct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  const pct = v * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${num1.format(pct)}%`;
}

// Cost lens: for cost/expense metrics, positive varPct means actual > budget,
// which is unfavorable ("red"). Negative varPct is favorable ("green").
// Headcount inverts this depending on team convention, but the platform's
// default lens treats all cost lines the same way.
export function varClass(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return 'text-gray-500';
  if (v > 0) return 'text-red-600';
  if (v < 0) return 'text-emerald-600';
  return 'text-gray-500';
}

export function readableMetricName(
  metric: string,
  labels?: Record<string, string>,
): string {
  if (labels && labels[metric]) return labels[metric];
  return metric
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
