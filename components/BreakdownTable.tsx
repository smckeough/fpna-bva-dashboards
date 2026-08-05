'use client';

import { Fragment, useState } from 'react';
import type {
  DashboardRecord,
  MetricWindow,
  PeriodKey,
  SubCategory,
  SubCategoryBucket,
} from '@/lib/types';
import { getWindow } from '@/lib/metrics';
import { fmtValue, fmtVarPct, readableMetricName, varClass } from '@/lib/format';

// Nested variance table. Three expand levels:
//   1. Metric row       — leader rollup for COGS / People / Non-People / OpEx
//   2. Department row   — one contributing child dept per metric row
//   3. Sub-category row — Software / Contractors / Consulting / Legal / etc.
//                         (only present on Non-People, COGS, OpEx, COGS+Opex —
//                         People and Headcount have no sub-categories.)
//
// Sub-categories carry actuals only (source doesn't include per-category budgets),
// so their Budget and Var% columns render as em-dash.

type Props = {
  record: DashboardRecord;
  childRecords: DashboardRecord[];
  rows: string[];
  periods: PeriodKey[];
  periodLabels: Record<PeriodKey, string>;
  totalRows?: string[];
  metricLabels?: Record<string, string>;
};

// Metric → which sub-category buckets to show under a drilled-in child dept.
// Empty array = no sub-category detail on that row.
const METRIC_TO_SUBCAT_BUCKETS: Record<string, SubCategoryBucket[]> = {
  cogs: ['cogs'],
  nonPeople: ['nonPeople'],
  opex: ['nonPeople'], // People has no sub-cat detail; only Non-People shows
  cogsOpex: ['cogs', 'nonPeople'],
  headcount: [],
  people: [],
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
  const [openMetrics, setOpenMetrics] = useState<Set<string>>(new Set());
  // Key: `${metric}::${deptName}` — tracks which dept rows are further expanded.
  const [openDeptRows, setOpenDeptRows] = useState<Set<string>>(new Set());
  const colSpanTotal = 1 + periods.length * 3;

  function toggleMetric(row: string) {
    setOpenMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(row)) next.delete(row);
      else next.add(row);
      return next;
    });
  }
  function toggleDept(row: string, dept: string) {
    setOpenDeptRows((prev) => {
      const key = `${row}::${dept}`;
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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
            const isOpen = openMetrics.has(row);

            const contributingChildren = childRecords.filter((child) =>
              periods.some((p) => {
                const w = getWindow(child, row, p);
                return w != null && (w.actual != null || w.budget != null);
              }),
            );
            const canExpand = contributingChildren.length > 0;
            const applicableBuckets = METRIC_TO_SUBCAT_BUCKETS[row] ?? [];

            return (
              <Fragment key={row}>
                <tr
                  className={`${isTotal ? 'bg-gray-50 font-semibold' : ''} ${
                    canExpand ? 'cursor-pointer hover:bg-blue-50/40' : ''
                  }`}
                  onClick={canExpand ? () => toggleMetric(row) : undefined}
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
                  contributingChildren.map((child) => {
                    const deptOpen = openDeptRows.has(`${row}::${child.name}`);
                    const applicableSubs =
                      applicableBuckets.length > 0
                        ? Object.entries(child.subCategories ?? {})
                            .filter(([, sc]) => applicableBuckets.includes(sc.metricBucket))
                            // Show any sub-cat that has activity in *either*
                            // actuals or budget in any period — so a budgeted-
                            // but-unspent row still surfaces.
                            .filter(([, sc]) =>
                              (['mtd', 'qtd', 'ytd'] as PeriodKey[]).some((pp) => {
                                const w = subWindow(sc, pp);
                                return (
                                  (w.actual ?? 0) !== 0 ||
                                  (w.budget ?? 0) !== 0
                                );
                              }),
                            )
                        : [];
                    const canDeptExpand = applicableSubs.length > 0;

                    return (
                      <Fragment key={`${row}-${child.name}`}>
                        <tr
                          className={`bg-blue-50/20 ${
                            canDeptExpand ? 'cursor-pointer hover:bg-blue-100/40' : ''
                          }`}
                          onClick={
                            canDeptExpand ? () => toggleDept(row, child.name) : undefined
                          }
                        >
                          <td className="px-4 py-1.5 pl-10 text-xs text-gray-700">
                            <span className="inline-flex items-center gap-2">
                              {canDeptExpand && (
                                <span
                                  className={`inline-block text-gray-400 transition-transform ${
                                    deptOpen ? 'rotate-90' : ''
                                  }`}
                                  aria-hidden
                                >
                                  ▶
                                </span>
                              )}
                              {child.name}
                            </span>
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
                        {deptOpen &&
                          applicableSubs.map(([subId, sc]) => (
                            <tr
                              key={`${row}-${child.name}-${subId}`}
                              className="bg-blue-50/40"
                            >
                              <td className="px-4 py-1 pl-16 text-[11px] text-gray-600">
                                {sc.label}
                                {sc.vendors.length > 0 && (
                                  <span className="ml-1.5 text-gray-400">
                                    ({sc.vendors.length} vendor{sc.vendors.length === 1 ? '' : 's'})
                                  </span>
                                )}
                              </td>
                              {periods.map((p) => {
                                const w = subWindow(sc, p);
                                return (
                                  <Fragment key={`${row}-${child.name}-${subId}-${p}`}>
                                    <td className="px-4 py-1 text-right tabular-nums text-[11px] border-l border-gray-100">
                                      {fmtValue(w.actual, 'currency')}
                                    </td>
                                    <td className="px-4 py-1 text-right tabular-nums text-[11px] text-gray-500">
                                      {fmtValue(w.budget, 'currency')}
                                    </td>
                                    <td
                                      className={`px-4 py-1 text-right tabular-nums text-[11px] font-medium ${varClass(
                                        w.varPct,
                                      )}`}
                                    >
                                      {fmtVarPct(w.varPct)}
                                    </td>
                                  </Fragment>
                                );
                              })}
                            </tr>
                          ))}
                        {deptOpen && !canDeptExpand && (
                          <tr className="bg-blue-50/40">
                            <td
                              colSpan={colSpanTotal}
                              className="px-4 py-1 pl-16 text-[11px] italic text-gray-500"
                            >
                              No sub-category detail for {child.name} in this bucket.
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
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

function subWindow(sc: SubCategory, p: PeriodKey): MetricWindow {
  if (p === 'mtd') return sc.mtd;
  if (p === 'qtd') return sc.qtd;
  return sc.ytd;
}
