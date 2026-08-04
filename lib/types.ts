// Shared types for dashboard-data-<YYYY-MM>.json and dashboard-config.json.

export type PeriodKey = 'mtd' | 'qtd' | 'ytd';

export type MetricWindow = {
  actual: number | null;
  budget: number | null;
  varPct: number | null;
};

export type HeadcountBlock = {
  actual: number | null;
  budget: number | null;
  variance: number | null;
};

export type MetricBlock = {
  mtd: MetricWindow;
  qtd: MetricWindow;
  ytd: MetricWindow;
};

export type Metrics = {
  headcount?: HeadcountBlock;
  cogs?: MetricBlock;
  people?: MetricBlock;
  nonPeople?: MetricBlock;
  opex?: MetricBlock;
  cogsOpex?: MetricBlock;
  [k: string]: HeadcountBlock | MetricBlock | undefined;
};

export type DashboardRecord = {
  name: string;
  sourceTab?: string;
  group?: string;
  type: 'Department' | 'Leader' | string;
  budgetLoaded: boolean;
  flags: string[];
  metrics: Metrics;
};

export type DashboardData = {
  meta: {
    reportMonth: string;
    monthSerial?: number;
    source?: string;
    costLens?: string;
    quarantine?: string[];
    reviewFlags?: { name: string; flags: string[] }[];
  };
  departments: DashboardRecord[];
  leaders: DashboardRecord[];
};

export type MonthIndexEntry = {
  key: string; // YYYY-MM
  label: string; // "June 2026"
  source?: string | null;
};

export type MonthIndex = {
  months: MonthIndexEntry[];
  default: string | null;
};

export type MetricKind = 'currency' | 'headcount' | 'count' | 'percent' | 'number';

export type SectionKpiCard = {
  label: string;
  metric: string;
  kind: MetricKind;
  period?: PeriodKey;
};

export type SectionCommon = { type: string; title?: string };

export type Section =
  | (SectionCommon & { type: 'flagBanner' })
  | (SectionCommon & { type: 'kpiCards'; cards: SectionKpiCard[] })
  | (SectionCommon & {
      type: 'varianceTable';
      rows: string[];
      periods?: PeriodKey[];
      totalRows?: string[];
    })
  | (SectionCommon & {
      type: 'barChart';
      metrics: string[];
      period?: PeriodKey;
      series?: ('actual' | 'budget')[];
    })
  | (SectionCommon & {
      type: 'lineChart';
      metric: string;
      series?: ('actual' | 'budget')[];
    })
  | (SectionCommon & { type: 'trendSparkline'; metric: string })
  | (SectionCommon & {
      type: 'historyChart';
      metric: string;
      period?: PeriodKey;
      series?: ('actual' | 'budget')[];
      monthsBack?: number;
    })
  | (SectionCommon & {
      type: 'breakdownTable';
      rows: string[];
      periods?: PeriodKey[];
      totalRows?: string[];
    })
  | (SectionCommon & { type: 'commentary'; body?: string });

export type Template = {
  subtitle?: string;
  sections: Section[];
};

export type DashboardConfigEntry = {
  id: string;
  route: string;
  title: string;
  dataKey: string;
  source: 'departments' | 'leaders';
  template: string;
  group?: string;
  // Names of department records that roll up into this record. Used by
  // breakdownTable sections on leader dashboards to show per-child detail
  // under each metric row.
  children?: string[];
};

export type DashboardConfig = {
  version?: string | number;
  updated?: string;
  theme?: unknown;
  periods: { key: PeriodKey; label: string }[];
  defaultPeriod: PeriodKey;
  palette?: string[];
  metricLabels?: Record<string, string>;
  costLens?: Record<string, unknown>;
  templates: Record<string, Template>;
  dashboards: DashboardConfigEntry[];
};

export function normalizeRoute(route: string): string {
  if (!route) return '/';
  const trimmed = route.startsWith('/') ? route : `/${route}`;
  if (trimmed === '/') return '/';
  return trimmed.replace(/\/+$/, '');
}
