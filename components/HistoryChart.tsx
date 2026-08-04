'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RLineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  DashboardData,
  MonthIndex,
  PeriodKey,
} from '@/lib/types';
import { getWindow } from '@/lib/metrics';
import { readableMetricName } from '@/lib/format';

type Props = {
  metric: string;
  period: PeriodKey;
  series: ('actual' | 'budget')[];
  monthsBack?: number;
  months: Record<string, DashboardData>;
  index: MonthIndex;
  source: 'departments' | 'leaders';
  dataKey: string;
  selectedMonth: string;
  palette?: string[];
  metricLabels?: Record<string, string>;
};

const DEFAULT_PALETTE = ['#2563eb', '#94a3b8'];
const USD_TICK = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
  style: 'currency',
  currency: 'USD',
});
const USD_TIP = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const NUM_TICK = new Intl.NumberFormat('en-US', { notation: 'compact' });
const NUM_TIP = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export default function HistoryChart({
  metric,
  period,
  series,
  monthsBack,
  months,
  index,
  source,
  dataKey,
  selectedMonth,
  palette,
  metricLabels,
}: Props) {
  const colors = palette && palette.length >= 2 ? palette : DEFAULT_PALETTE;

  // Sort months ascending (oldest → newest) for a left-to-right trend.
  const ordered = [...index.months]
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .slice(monthsBack ? -monthsBack : 0);

  const isHeadcount = metric === 'headcount';
  const fmtTick = isHeadcount ? NUM_TICK.format : (v: number) => USD_TICK.format(v);
  const fmtTip = isHeadcount ? NUM_TIP.format : (v: number) => USD_TIP.format(v);

  const data = ordered
    .map((m) => {
      const payload = months[m.key];
      if (!payload) return null;
      const bucket = payload[source] ?? [];
      const rec = bucket.find((r) => r.name === dataKey);
      if (!rec) return null;
      const w = getWindow(rec, metric, period);
      return {
        key: m.key,
        label: m.label,
        Actual: w?.actual ?? null,
        Budget: w?.budget ?? null,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  if (!data.length) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm text-sm text-gray-500">
        No history available for{' '}
        <span className="font-mono">{readableMetricName(metric, metricLabels)}</span>.
      </div>
    );
  }

  const selected = data.find((d) => d.key === selectedMonth);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="w-full h-72">
        <ResponsiveContainer>
          <RLineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#4b5563', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis
              tick={{ fill: '#4b5563', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              tickFormatter={(v: number) => fmtTick(v)}
              width={72}
            />
            <Tooltip
              formatter={(v) => (typeof v === 'number' ? fmtTip(v) : String(v ?? ''))}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {series.includes('actual') && (
              <Line
                type="monotone"
                dataKey="Actual"
                stroke={colors[0]}
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            )}
            {series.includes('budget') && (
              <Line
                type="monotone"
                dataKey="Budget"
                stroke={colors[1] ?? '#94a3b8'}
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            )}
            {selected && selected.Actual != null && (
              <ReferenceDot
                x={selected.label}
                y={selected.Actual}
                r={5}
                fill={colors[0]}
                stroke="#ffffff"
                strokeWidth={2}
              />
            )}
          </RLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
