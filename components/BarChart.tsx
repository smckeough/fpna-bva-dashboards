'use client';

import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardRecord, PeriodKey } from '@/lib/types';
import { getWindow } from '@/lib/metrics';
import { readableMetricName } from '@/lib/format';

type Props = {
  record: DashboardRecord;
  metrics: string[];
  period: PeriodKey;
  series: ('actual' | 'budget')[];
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

export default function BarChart({
  record,
  metrics,
  period,
  series,
  palette,
  metricLabels,
}: Props) {
  const colors = palette && palette.length >= series.length ? palette : DEFAULT_PALETTE;
  const data = metrics.map((m) => {
    const w = getWindow(record, m, period);
    const row: Record<string, string | number | null> = {
      name: readableMetricName(m, metricLabels),
    };
    if (series.includes('actual')) row.Actual = w?.actual ?? null;
    if (series.includes('budget')) row.Budget = w?.budget ?? null;
    return row;
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="w-full h-72">
        <ResponsiveContainer>
          <RBarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#4b5563', fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
            <YAxis
              tick={{ fill: '#4b5563', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              tickFormatter={(v: number) => USD_TICK.format(v)}
              width={72}
            />
            <Tooltip formatter={(v) => (typeof v === 'number' ? USD_TIP.format(v) : String(v ?? ''))} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {series.includes('actual') && (
              <Bar dataKey="Actual" fill={colors[0]} radius={[4, 4, 0, 0]} />
            )}
            {series.includes('budget') && (
              <Bar dataKey="Budget" fill={colors[1] ?? '#94a3b8'} radius={[4, 4, 0, 0]} />
            )}
          </RBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
