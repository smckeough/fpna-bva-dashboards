'use client';

import { useState } from 'react';
import type { DashboardRecord, SoftwareVendorRow } from '@/lib/types';
import { fmtValue, fmtVarPct, varClass } from '@/lib/format';

// Duplicates the 'Software BvA Summary' section that appears at the bottom of
// each leader's BvA tab in the FP&A workbook. Vendor rows show current-month
// Actual vs Budget with variance, plus optional month-over-month.
//
// The workbook already produces the row set (top vendors + 'All Other' + 'Total')
// — we render it verbatim and preserve that order by default. Toggling sort
// reorders the vendor rows but keeps All Other / Total pinned to the bottom.

type Props = {
  record: DashboardRecord;
  showMoM?: boolean;
  topN?: number;
};

type SortKey = 'default' | 'actual' | 'variance' | 'name';

export default function SoftwareTable({ record, showMoM = true, topN }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const budgetLoaded = record.budgetLoaded !== false;
  const software = record.software;

  if (!software || !software.vendors?.length) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
        No software spend detail on this record — check that{' '}
        <code>export_month.py</code> found a &quot;Software BvA Summary&quot; on
        the source tab.
      </div>
    );
  }

  const all = software.vendors;
  const [total] = all.filter((v) => v.isTotal);
  const other = all.find((v) => v.isOther);
  const named = all.filter((v) => !v.isTotal && !v.isOther);

  const sortedNamed = [...named];
  if (sortKey === 'actual') {
    sortedNamed.sort((a, b) => (b.mtd.actual ?? 0) - (a.mtd.actual ?? 0));
  } else if (sortKey === 'variance') {
    sortedNamed.sort((a, b) => (b.mtd.varPct ?? 0) - (a.mtd.varPct ?? 0));
  } else if (sortKey === 'name') {
    sortedNamed.sort((a, b) => a.name.localeCompare(b.name));
  }
  const visibleNamed =
    topN && topN > 0 && sortedNamed.length > topN ? sortedNamed.slice(0, topN) : sortedNamed;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <p className="text-xs text-gray-500">
          {named.length} vendor{named.length === 1 ? '' : 's'}
          {topN && sortedNamed.length > topN
            ? ` (top ${topN} shown, rest in All Other)`
            : ''}
        </p>
        <label className="text-xs text-gray-600 inline-flex items-center gap-2">
          Sort by
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded border border-gray-200 bg-white px-2 py-0.5 text-xs"
          >
            <option value="default">Workbook order</option>
            <option value="actual">MTD Actual (high → low)</option>
            <option value="variance">Variance (over → under)</option>
            <option value="name">Vendor name</option>
          </select>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-2 font-medium">Vendor</th>
              <th className="px-4 py-2 font-medium">Department</th>
              <th className="px-4 py-2 font-medium text-right">MTD Actual</th>
              <th className="px-4 py-2 font-medium text-right">Budget</th>
              <th className="px-4 py-2 font-medium text-right">Var %</th>
              {showMoM && (
                <>
                  <th className="px-4 py-2 font-medium text-right">Last Mo</th>
                  <th className="px-4 py-2 font-medium text-right">MoM %</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visibleNamed.map((v) => (
              <VendorRow key={v.name} v={v} showMoM={showMoM} budgetLoaded={budgetLoaded} />
            ))}
            {other && (
              <VendorRow v={other} showMoM={showMoM} budgetLoaded={budgetLoaded} muted />
            )}
            {total && (
              <VendorRow v={total} showMoM={showMoM} budgetLoaded={budgetLoaded} bold />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VendorRow({
  v,
  showMoM,
  budgetLoaded,
  muted,
  bold,
}: {
  v: SoftwareVendorRow;
  showMoM: boolean;
  budgetLoaded: boolean;
  muted?: boolean;
  bold?: boolean;
}) {
  const cls = bold
    ? 'bg-gray-50 font-semibold'
    : muted
      ? 'text-gray-500 italic'
      : '';
  return (
    <tr className={cls}>
      <td className="px-4 py-2 text-gray-800">{v.name}</td>
      <td className="px-4 py-2 text-gray-500 text-xs">{v.department ?? '—'}</td>
      <td className="px-4 py-2 text-right tabular-nums">
        {fmtValue(v.mtd.actual, 'currency')}
      </td>
      <td className="px-4 py-2 text-right tabular-nums text-gray-500">
        {budgetLoaded ? fmtValue(v.mtd.budget, 'currency') : '—'}
      </td>
      <td
        className={`px-4 py-2 text-right tabular-nums font-medium ${
          budgetLoaded ? varClass(v.mtd.varPct) : 'text-gray-400'
        }`}
      >
        {budgetLoaded ? fmtVarPct(v.mtd.varPct) : '—'}
      </td>
      {showMoM && (
        <>
          <td className="px-4 py-2 text-right tabular-nums text-gray-500">
            {fmtValue(v.lastMonthActual ?? null, 'currency')}
          </td>
          {/* MoM is a directional change, not a budget variance — keep it neutral. */}
          <td className="px-4 py-2 text-right tabular-nums text-gray-600">
            {fmtVarPct(v.mom?.pct ?? null)}
          </td>
        </>
      )}
    </tr>
  );
}
