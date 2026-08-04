'use client';

import { useState } from 'react';
import type {
  DashboardConfig,
  DashboardConfigEntry,
  DashboardRecord,
  PeriodKey,
  Section,
  Template,
} from '@/lib/types';
import PeriodToggle from './PeriodToggle';
import FlagBanner from './FlagBanner';
import KpiCards from './KpiCards';
import VarianceTable from './VarianceTable';
import BarChart from './BarChart';
import LineChart from './LineChart';
import TrendSparkline from './TrendSparkline';
import Commentary from './Commentary';

type Props = {
  entry: DashboardConfigEntry;
  template: Template;
  record: DashboardRecord;
  config: DashboardConfig;
  reportMonth: string;
};

const DEFAULT_TABLE_PERIODS: PeriodKey[] = ['mtd', 'qtd', 'ytd'];

export default function DashboardShell({
  entry,
  template,
  record,
  config,
  reportMonth,
}: Props) {
  const [period, setPeriod] = useState<PeriodKey>(config.defaultPeriod);
  const periodLabels = Object.fromEntries(
    config.periods.map((p) => [p.key, p.label]),
  ) as Record<PeriodKey, string>;

  return (
    <div className="p-8 max-w-7xl">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
            {entry.source === 'leaders' ? 'Leader' : 'Department'} · {reportMonth}
          </p>
          <h1 className="text-2xl font-semibold text-gray-900">{entry.title}</h1>
          {template.subtitle && (
            <p className="text-sm text-gray-500 mt-1">{template.subtitle}</p>
          )}
        </div>
        <PeriodToggle
          periods={config.periods}
          value={period}
          onChange={setPeriod}
        />
      </header>

      <div className="space-y-6">
        {template.sections.map((section, i) => (
          <SectionView
            key={`${section.type}-${i}`}
            section={section}
            record={record}
            period={period}
            config={config}
            periodLabels={periodLabels}
          />
        ))}
      </div>
    </div>
  );
}

function SectionView({
  section,
  record,
  period,
  config,
  periodLabels,
}: {
  section: Section;
  record: DashboardRecord;
  period: PeriodKey;
  config: DashboardConfig;
  periodLabels: Record<PeriodKey, string>;
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
