'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardRecord, PeriodKey } from '@/lib/types';
import { getWindow } from '@/lib/metrics';

type Props = {
  record: DashboardRecord;
  metric: string;
  series: ('actual' | 'budget')[];
  palette?: string[];
  metricLabels?: Record<string, string>;
};

const DEFAULT_PALETTE = ['#2563eb', '#94a3b8'];
const PERIODS: PeriodKey[] = ['mtd', 'qtd', 'ytd'];
const LABELS: Record<PeriodKey, string> = { mtd: 'MTD', qtd: 'QTD', ytd: 'YTD' };
const USD_TIP = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const USD_TICK = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
  style: 'currency',
  currency: 'USD',
});

export default function LineChart({ record, metric, series, palette }: Props) {
  const colors = palette && palette.length >= series.length ? palette : DEFAULT_PALETTE;
  const data = PERIODS.map((p) => {
    const w = getWindow(record, metric, p);
    return {
      name: LABELS[p],
      Actual: w?.actual ?? null,
      Budget: w?.budget ?? null,
    };
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="w-full h-72">
        <ResponsiveContainer>
          <RLineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
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
              <Line type="monotone" dataKey="Actual" stroke={colors[0]} strokeWidth={2} dot={{ r: 3 }} />
            )}
            {series.includes('budget') && (
              <Line type="monotone" dataKey="Budget" stroke={colors[1] ?? '#94a3b8'} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} />
            )}
          </RLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
