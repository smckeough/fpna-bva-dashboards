import type {
  DashboardRecord,
  HeadcountBlock,
  MetricBlock,
  MetricWindow,
  PeriodKey,
} from './types';

// Headcount is a single non-windowed block; every other metric is
// {mtd,qtd,ytd}. This helper returns a MetricWindow-shaped view for either.
export function getWindow(
  record: DashboardRecord,
  metric: string,
  period: PeriodKey,
): MetricWindow | null {
  const raw = record.metrics?.[metric];
  if (!raw) return null;
  if (isHeadcountBlock(raw)) {
    return {
      actual: raw.actual,
      budget: raw.budget,
      varPct: computeVarPct(raw.actual, raw.budget),
    };
  }
  const block = raw as MetricBlock;
  return block[period] ?? null;
}

export function isHeadcountBlock(
  v: HeadcountBlock | MetricBlock,
): v is HeadcountBlock {
  return (
    v != null &&
    typeof v === 'object' &&
    'actual' in v &&
    'budget' in v &&
    !('mtd' in v)
  );
}

function computeVarPct(actual: number | null, budget: number | null): number | null {
  if (actual == null || budget == null || budget === 0) return null;
  return (actual - budget) / budget;
}
