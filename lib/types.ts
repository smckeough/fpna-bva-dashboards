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

export type MonthlyPoint = { month: string; value: number | null };

export type SoftwareVendorRow = {
  name: string;
  department?: string | null;
  isTotal?: boolean;
  isOther?: boolean;
  mtd: MetricWindow;
  qtd?: MetricWindow | null;
  ytd?: MetricWindow | null;
  lastMonthActual?: number | null;
  mom?: { delta: number | null; pct: number | null };
  monthlyActual?: MonthlyPoint[] | null;
  monthlyBudget?: MonthlyPoint[] | null;
};

export type SoftwareBlock = {
  vendors: SoftwareVendorRow[];
};

export type CommentaryRawNote = {
  class?: string;
  account?: string | null;
  department?: string; // present on leader-level rollups
  mtdActual?: number | null;
  priorActual?: number | null;
  momDelta?: number | null;
  note: string;
};

export type CommentaryMover = {
  account?: string | null;
  department?: string;
  mtdActual?: number | null;
  priorActual?: number | null;
  momDelta?: number | null;
  momPct?: number | null;
};

export type CommentaryBlock = {
  // Editorial summary written for department heads — 2-3 short bullets.
  // Empty until the per-close editorial pass fills it in.
  summary: string[];
  // Verbatim finance notes (with dollar context) that back the summary.
  raw: CommentaryRawNote[];
  // Top MoM $ movers computed automatically from the pivot.
  movers: CommentaryMover[];
  // Leader records carry the department list they roll up.
  children?: string[];
};

export type DashboardRecord = {
  name: string;
  sourceTab?: string;
  group?: string;
  type: 'Department' | 'Leader' | string;
  budgetLoaded: boolean;
  flags: string[];
  metrics: Metrics;
  software?: SoftwareBlock;
  commentary?: CommentaryBlock;
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
  | (SectionCommon & { type: 'commentary'; body?: string })
  | (SectionCommon & {
      type: 'softwareTable';
      // How many vendor rows to show before folding the rest into 'All Other'.
      // Absent = show every row the source has (usually top 15 + All Other + Total).
      topN?: number;
      showMoM?: boolean;
    });

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
