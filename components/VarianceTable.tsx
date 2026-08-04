import { Fragment } from 'react';
import type { DashboardRecord, PeriodKey } from '@/lib/types';
import { getWindow } from '@/lib/metrics';
import { fmtValue, fmtVarPct, readableMetricName, varClass } from '@/lib/format';

type Props = {
  record: DashboardRecord;
  rows: string[];
  periods: PeriodKey[];
  periodLabels: Record<PeriodKey, string>;
  totalRows?: string[];
  metricLabels?: Record<string, string>;
};

export default function VarianceTable({
  record,
  rows,
  periods,
  periodLabels,
  totalRows,
  metricLabels,
}: Props) {
  const budgetLoaded = record.budgetLoaded !== false;
  const totals = new Set(totalRows ?? []);
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="px-4 py-2 font-medium">Metric</th>
            {periods.map((p) => (
              <th
                key={`${p}-hdr`}
                colSpan={3}
                className="px-4 py-2 font-medium text-center border-l border-gray-200"
              >
                {periodLabels[p] ?? p.toUpperCase()}
              </th>
            ))}
          </tr>
          <tr className="bg-gray-50 text-left text-[11px] text-gray-400">
            <th />
            {periods.map((p) => (
              <Fragment key={`${p}-subhdr`}>
                <th className="px-4 py-1 border-l border-gray-200 text-right font-normal">Actual</th>
                <th className="px-4 py-1 text-right font-normal">Budget</th>
                <th className="px-4 py-1 text-right font-normal">Var %</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => {
            const isTotal = totals.has(row);
            const kind = row === 'headcount' ? 'headcount' : 'currency';
            return (
              <tr key={row} className={isTotal ? 'bg-gray-50 font-semibold' : ''}>
                <td className="px-4 py-2 text-gray-800">
                  {readableMetricName(row, metricLabels)}
                </td>
                {periods.map((p) => {
                  const w = getWindow(record, row, p);
                  return (
                    <Fragment key={`${row}-${p}`}>
                      <td className="px-4 py-2 text-right tabular-nums border-l border-gray-100">
                        {fmtValue(w?.actual ?? null, kind)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-500">
                        {budgetLoaded ? fmtValue(w?.budget ?? null, kind) : '—'}
                      </td>
                      <td
                        className={`px-4 py-2 text-right tabular-nums font-medium ${
                          budgetLoaded ? varClass(w?.varPct ?? null) : 'text-gray-400'
                        }`}
                      >
                        {budgetLoaded ? fmtVarPct(w?.varPct ?? null) : '—'}
                      </td>
                    </Fragment>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
