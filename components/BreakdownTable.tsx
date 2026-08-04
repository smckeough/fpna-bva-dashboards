'use client';

import { Fragment, useState } from 'react';
import type { DashboardRecord, PeriodKey } from '@/lib/types';
import { getWindow } from '@/lib/metrics';
import { fmtValue, fmtVarPct, readableMetricName, varClass } from '@/lib/format';

// Variance table with expandable metric rows. On the leader dashboards each
// row's numbers are the rollup; expanding the row lists one line per child
// department that contributes to that metric. Nothing else about the layout
// (columns, periods, totals) differs from VarianceTable.

type Props = {
  record: DashboardRecord;
  childRecords: DashboardRecord[]; // resolved child department records
  rows: string[];
  periods: PeriodKey[];
  periodLabels: Record<PeriodKey, string>;
  totalRows?: string[];
  metricLabels?: Record<string, string>;
};

export default function BreakdownTable({
  record,
  childRecords,
  rows,
  periods,
  periodLabels,
  totalRows,
  metricLabels,
}: Props) {
  const budgetLoaded = record.budgetLoaded !== false;
  const totals = new Set(totalRows ?? []);
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const colSpanTotal = 1 + periods.length * 3;

  function toggle(row: string) {
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(row)) next.delete(row);
      else next.add(row);
      return next;
    });
  }

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
                <th className="px-4 py-1 border-l border-gray-200 text-right font-normal">
                  Actual
                </th>
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
            const isOpen = openRows.has(row);

            // A child contributes to this metric if it has a non-null actual in
            // any of the requested periods. Filter dead rows so a leader's
            // detail view isn't polluted with 0/0/— lines from unrelated teams.
            const contributingChildren = childRecords.filter((child) =>
              periods.some((p) => {
                const w = getWindow(child, row, p);
                return (
                  w != null &&
                  (w.actual != null || w.budget != null)
                );
              }),
            );
            const canExpand = contributingChildren.length > 0;

            return (
              <Fragment key={row}>
                <tr
                  className={`${isTotal ? 'bg-gray-50 font-semibold' : ''} ${
                    canExpand ? 'cursor-pointer hover:bg-blue-50/40' : ''
                  }`}
                  onClick={canExpand ? () => toggle(row) : undefined}
                >
                  <td className="px-4 py-2 text-gray-800">
                    <span className="inline-flex items-center gap-2">
                      {canExpand && (
                        <span
                          className={`inline-block text-gray-400 transition-transform ${
                            isOpen ? 'rotate-90' : ''
                          }`}
                          aria-hidden
                        >
                          ▶
                        </span>
                      )}
                      {readableMetricName(row, metricLabels)}
                    </span>
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
                {isOpen &&
                  contributingChildren.map((child) => (
                    <tr key={`${row}-${child.name}`} className="bg-blue-50/20">
                      <td className="px-4 py-1.5 pl-10 text-xs text-gray-700">
                        {child.name}
                      </td>
                      {periods.map((p) => {
                        const cw = getWindow(child, row, p);
                        return (
                          <Fragment key={`${row}-${child.name}-${p}`}>
                            <td className="px-4 py-1.5 text-right tabular-nums text-xs border-l border-gray-100">
                              {fmtValue(cw?.actual ?? null, kind)}
                            </td>
                            <td className="px-4 py-1.5 text-right tabular-nums text-xs text-gray-500">
                              {budgetLoaded ? fmtValue(cw?.budget ?? null, kind) : '—'}
                            </td>
                            <td
                              className={`px-4 py-1.5 text-right tabular-nums text-xs font-medium ${
                                budgetLoaded ? varClass(cw?.varPct ?? null) : 'text-gray-400'
                              }`}
                            >
                              {budgetLoaded ? fmtVarPct(cw?.varPct ?? null) : '—'}
                            </td>
                          </Fragment>
                        );
                      })}
                    </tr>
                  ))}
                {isOpen && !canExpand && (
                  <tr className="bg-blue-50/20">
                    <td
                      colSpan={colSpanTotal}
                      className="px-4 py-1.5 pl-10 text-xs italic text-gray-500"
                    >
                      No contributing children.
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
