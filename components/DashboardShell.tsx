'use client';

import { useState } from 'react';
import type {
  DashboardConfig,
  DashboardConfigEntry,
  DashboardData,
  DashboardRecord,
  MonthIndex,
  PeriodKey,
  Section,
  Template,
} from '@/lib/types';
import PeriodToggle from './PeriodToggle';
import MonthPicker from './MonthPicker';
import FlagBanner from './FlagBanner';
import KpiCards from './KpiCards';
import VarianceTable from './VarianceTable';
import BarChart from './BarChart';
import LineChart from './LineChart';
import TrendSparkline from './TrendSparkline';
import HistoryChart from './HistoryChart';
import Commentary from './Commentary';

type Props = {
  entry: DashboardConfigEntry;
  template: Template;
  initialData: DashboardData;
  index: MonthIndex;
  config: DashboardConfig;
  months: Record<string, DashboardData>;
};

const DEFAULT_TABLE_PERIODS: PeriodKey[] = ['mtd', 'qtd', 'ytd'];

export default function DashboardShell({
  entry,
  template,
  initialData,
  index,
  config,
  months,
}: Props) {
  const [period, setPeriod] = useState<PeriodKey>(config.defaultPeriod);
  const [monthKey, setMonthKey] = useState<string>(index.default ?? '');
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Merge freshly-fetched months into the initial history map so newly
  // switched months contribute to the trend line without a full reload.
  const [historyMonths, setHistoryMonths] =
    useState<Record<string, DashboardData>>(months);

  const periodLabels = Object.fromEntries(
    config.periods.map((p) => [p.key, p.label]),
  ) as Record<PeriodKey, string>;

  const record = findRecord(data, entry.source, entry.dataKey);

  async function switchMonth(next: string) {
    if (next === monthKey || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/month/${next}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload: DashboardData = await res.json();
      setData(payload);
      setMonthKey(next);
      setHistoryMonths((prev) => ({ ...prev, [next]: payload }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-7xl">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
            {entry.source === 'leaders' ? 'Leader' : 'Department'} · {data.meta.reportMonth}
          </p>
          <h1 className="text-2xl font-semibold text-gray-900">{entry.title}</h1>
          {template.subtitle && (
            <p className="text-sm text-gray-500 mt-1">{template.subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <MonthPicker
            months={index.months}
            value={monthKey}
            onChange={switchMonth}
            loading={loading}
          />
          <PeriodToggle
            periods={config.periods}
            value={period}
            onChange={setPeriod}
          />
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          Could not load month: {error}
        </div>
      )}

      {!record ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600">
          No record for <span className="font-mono">{entry.dataKey}</span> in{' '}
          <span className="font-mono">{data.meta.reportMonth}</span>.
        </div>
      ) : (
        <div className="space-y-6">
          {template.sections.map((section, i) => (
            <SectionView
              key={`${section.type}-${i}`}
              section={section}
              record={record}
              period={period}
              config={config}
              periodLabels={periodLabels}
              index={index}
              months={historyMonths}
              source={entry.source}
              dataKey={entry.dataKey}
              selectedMonth={monthKey}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function findRecord(
  data: DashboardData,
  source: 'departments' | 'leaders',
  dataKey: string,
): DashboardRecord | null {
  const bucket = data[source] ?? [];
  return bucket.find((r) => r.name === dataKey) ?? null;
}

function SectionView({
  section,
  record,
  period,
  config,
  periodLabels,
  index,
  months,
  source,
  dataKey,
  selectedMonth,
}: {
  section: Section;
  record: DashboardRecord;
  period: PeriodKey;
  config: DashboardConfig;
  periodLabels: Record<PeriodKey, string>;
  index: MonthIndex;
  months: Record<string, DashboardData>;
  source: 'departments' | 'leaders';
  dataKey: string;
  selectedMonth: string;
}) {
  switch (section.type) {
    case 'flagBanner':
      return <FlagBanner record={record} />;
    case 'kpiCards':
      return (
        <div>
          {section.title && (
            <h2 className="text-sm font-semibold text-gray-800 mb-3">
              {section.title}
            </h2>
          )}
          <KpiCards
            cards={section.cards}
            record={record}
            period={period}
            metricLabels={config.metricLabels}
          />
        </div>
      );
    case 'varianceTable':
      return (
        <div>
          {section.title && (
            <h2 className="text-sm font-semibold text-gray-800 mb-3">
              {section.title}
            </h2>
          )}
          <VarianceTable
            record={record}
            rows={section.rows}
            periods={section.periods ?? DEFAULT_TABLE_PERIODS}
            periodLabels={periodLabels}
            totalRows={section.totalRows}
            metricLabels={config.metricLabels}
          />
        </div>
      );
    case 'barChart':
      return (
        <div>
          {section.title && (
            <h2 className="text-sm font-semibold text-gray-800 mb-3">
              {section.title}
            </h2>
          )}
          <BarChart
            record={record}
            metrics={section.metrics}
            period={section.period ?? period}
            series={section.series ?? ['actual', 'budget']}
            palette={config.palette}
            metricLabels={config.metricLabels}
          />
        </div>
      );
    case 'lineChart':
      return (
        <div>
          {section.title && (
            <h2 className="text-sm font-semibold text-gray-800 mb-3">
              {section.title}
            </h2>
          )}
          <LineChart
            record={record}
            metric={section.metric}
            series={section.series ?? ['actual', 'budget']}
            palette={config.palette}
            metricLabels={config.metricLabels}
          />
        </div>
      );
    case 'trendSparkline':
      return (
        <TrendSparkline
          record={record}
          metric={section.metric}
          metricLabels={config.metricLabels}
        />
      );
    case 'historyChart':
      return (
        <div>
          {section.title && (
            <h2 className="text-sm font-semibold text-gray-800 mb-3">
              {section.title}
            </h2>
          )}
          <HistoryChart
            metric={section.metric}
            period={section.period ?? period}
            series={section.series ?? ['actual', 'budget']}
            monthsBack={section.monthsBack}
            months={months}
            index={index}
            source={source}
            dataKey={dataKey}
            selectedMonth={selectedMonth}
            palette={config.palette}
            metricLabels={config.metricLabels}
          />
        </div>
      );
    case 'commentary':
      return <Commentary body={section.body} />;
    default:
      return (
        <div className="rounded-lg border border-dashed border-gray-300 p-4 text-xs text-gray-500">
          Unknown section type:{' '}
          <span className="font-mono">
            {(section as { type: string }).type}
          </span>
        </div>
      );
  }
}
