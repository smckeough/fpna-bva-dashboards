'use client';

import { Line, LineChart as RLineChart, ResponsiveContainer } from 'recharts';
import type { DashboardRecord, PeriodKey } from '@/lib/types';
import { getWindow } from '@/lib/metrics';
import { readableMetricName } from '@/lib/format';

type Props = {
  record: DashboardRecord;
  metric: string;
  metricLabels?: Record<string, string>;
};

const PERIODS: PeriodKey[] = ['mtd', 'qtd', 'ytd'];

export default function TrendSparkline({ record, metric, metricLabels }: Props) {
  const data = PERIODS.map((p) => ({ name: p, v: getWindow(record, metric, p)?.actual ?? 0 }));
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">
        {readableMetricName(metric, metricLabels)} trend
      </p>
      <div className="w-full h-16">
        <ResponsiveContainer>
          <RLineChart data={data}>
            <Line type="monotone" dataKey="v" stroke="#2563eb" strokeWidth={2} dot={false} />
          </RLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
