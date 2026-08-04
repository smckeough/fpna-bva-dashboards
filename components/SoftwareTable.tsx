'use client';

import { Fragment, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RLineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  DashboardRecord,
  MetricWindow,
  PeriodKey,
  SoftwareVendorRow,
} from '@/lib/types';
import { fmtValue, fmtVarPct, varClass } from '@/lib/format';

// Duplicates the 'Software BvA Summary' section that lives at the bottom of
// each leader's BvA tab. Columns follow the dashboard's active period (MTD /
// QTD / YTD) — the top-level toggle drives this too. Each named vendor row is
// clickable to reveal a 12-month Actual-vs-Budget line for that vendor.

type Props = {
  record: DashboardRecord;
  period: PeriodKey;
  currentMonthKey?: string; // "YYYY-MM" — used as an anchor on the monthly chart
  showMoM?: boolean;
  topN?: number;
};

type SortKey = 'default' | 'actual' | 'variance' | 'name';

const PERIOD_LABELS: Record<PeriodKey, string> = {
  mtd: 'Month',
  qtd: 'Quarter',
  ytd: 'Year',
};

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

export default function SoftwareTable({
  record,
  period,
  currentMonthKey,
  showMoM = true,
  topN,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [openVendors, setOpenVendors] = useState<Set<string>>(new Set());
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
  const total = all.find((v) => v.isTotal);
  const other = all.find((v) => v.isOther);
  const named = all.filter((v) => !v.isTotal && !v.isOther);

  const sortedNamed = [...named];
  if (sortKey === 'actual') {
    sortedNamed.sort(
      (a, b) => (windowFor(b, period)?.actual ?? 0) - (windowFor(a, period)?.actual ?? 0),
    );
  } else if (sortKey === 'variance') {
    sortedNamed.sort(
      (a, b) => (windowFor(b, period)?.varPct ?? 0) - (windowFor(a, period)?.varPct ?? 0),
    );
  } else if (sortKey === 'name') {
    sortedNamed.sort((a, b) => a.name.localeCompare(b.name));
  }
  const visibleNamed =
    topN && topN > 0 && sortedNamed.length > topN
      ? sortedNamed.slice(0, topN)
      : sortedNamed;

  function toggle(name: string) {
    setOpenVendors((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const periodLabel = PERIOD_LABELS[period];
  // MoM only makes sense on the MTD view — hide it otherwise.
  const showMoMCol = showMoM && period === 'mtd';
  const colCount = 5 + (showMoMCol ? 2 : 0); // vendor, dept, actual, budget, var + optional 2

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <p className="text-xs text-gray-500">
          {named.length} vendor{named.length === 1 ? '' : 's'} · {periodLabel} view
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
            <option value="actual">{periodLabel} Actual (high → low)</option>
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
              <th className="px-4 py-2 font-medium text-right">{periodLabel} Actual</th>
              <th className="px-4 py-2 font-medium text-right">Budget</th>
              <th className="px-4 py-2 font-medium text-right">Var %</th>
              {showMoMCol && (
                <>
                  <th className="px-4 py-2 font-medium text-right">Last Mo</th>
                  <th className="px-4 py-2 font-medium text-right">MoM %</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visibleNamed.map((v) => (
              <VendorRow
                key={v.name}
                v={v}
                period={period}
                budgetLoaded={budgetLoaded}
                showMoMCol={showMoMCol}
                expandable
                open={openVendors.has(v.name)}
                onToggle={() => toggle(v.name)}
                colCount={colCount}
                currentMonthKey={currentMonthKey}
              />
            ))}
            {other && (
              <VendorRow
                v={other}
                period={period}
                budgetLoaded={budgetLoaded}
                showMoMCol={showMoMCol}
                muted
                colCount={colCount}
              />
            )}
            {total && (
              <VendorRow
                v={total}
                period={period}
                budgetLoaded={budgetLoaded}
                showMoMCol={showMoMCol}
                bold
                colCount={colCount}
              />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function windowFor(v: SoftwareVendorRow, period: PeriodKey): MetricWindow | null {
  if (period === 'mtd') return v.mtd ?? null;
  if (period === 'qtd') return v.qtd ?? null;
  if (period === 'ytd') return v.ytd ?? null;
  return null;
}

function VendorRow({
  v,
  period,
  budgetLoaded,
  showMoMCol,
  muted,
  bold,
  expandable,
  open,
  onToggle,
  colCount,
  currentMonthKey,
}: {
  v: SoftwareVendorRow;
  period: PeriodKey;
  budgetLoaded: boolean;
  showMoMCol: boolean;
  muted?: boolean;
  bold?: boolean;
  expandable?: boolean;
  open?: boolean;
  onToggle?: () => void;
  colCount: number;
  currentMonthKey?: string;
}) {
  const w = windowFor(v, period);
  const rowCls = bold
    ? 'bg-gray-50 font-semibold'
    : muted
      ? 'text-gray-500 italic'
      : expandable
        ? 'cursor-pointer hover:bg-blue-50/40'
        : '';
  const canExpand =
    expandable &&
    ((v.monthlyActual && v.monthlyActual.length > 0) ||
      (v.monthlyBudget && v.monthlyBudget.length > 0));

  return (
    <Fragment>
      <tr
        className={rowCls}
        onClick={canExpand ? onToggle : undefined}
      >
        <td className="px-4 py-2 text-gray-800">
          <span className="inline-flex items-center gap-2">
            {canExpand && (
              <span
                className={`inline-block text-gray-400 transition-transform ${
                  open ? 'rotate-90' : ''
                }`}
                aria-hidden
              >
                ▶
              </span>
            )}
            {v.name}
          </span>
        </td>
        <td className="px-4 py-2 text-gray-500 text-xs">{v.department ?? '—'}</td>
        <td className="px-4 py-2 text-right tabular-nums">
          {fmtValue(w?.actual ?? null, 'currency')}
        </td>
        <td className="px-4 py-2 text-right tabular-nums text-gray-500">
          {budgetLoaded ? fmtValue(w?.budget ?? null, 'currency') : '—'}
        </td>
        <td
          className={`px-4 py-2 text-right tabular-nums font-medium ${
            budgetLoaded ? varClass(w?.varPct ?? null) : 'text-gray-400'
          }`}
        >
          {budgetLoaded ? fmtVarPct(w?.varPct ?? null) : '—'}
        </td>
        {showMoMCol && (
          <>
            <td className="px-4 py-2 text-right tabular-nums text-gray-500">
              {fmtValue(v.lastMonthActual ?? null, 'currency')}
            </td>
            <td className="px-4 py-2 text-right tabular-nums text-gray-600">
              {fmtVarPct(v.mom?.pct ?? null)}
            </td>
          </>
        )}
      </tr>
      {open && canExpand && (
        <tr className="bg-blue-50/20">
          <td colSpan={colCount} className="px-4 py-3">
            <VendorMonthlyChart v={v} currentMonthKey={currentMonthKey} />
          </td>
        </tr>
      )}
    </Fragment>
  );
}

// The workbook fills future-month cells with 0 for vendors that don't yet have
// a forecast — treat those as absent on the chart. Vendors that DO have a
// forecast (e.g. AWS) get non-zero values in future months and render fine.
function isPresent(n: number | null | undefined): boolean {
  return n != null && !Number.isNaN(n) && n !== 0;
}

function VendorMonthlyChart({
  v,
  currentMonthKey,
}: {
  v: SoftwareVendorRow;
  currentMonthKey?: string;
}) {
  const actualByMonth = new Map(
    (v.monthlyActual ?? []).map((p) => [p.month, p.value]),
  );
  const budgetByMonth = new Map(
    (v.monthlyBudget ?? []).map((p) => [p.month, p.value]),
  );
  const allMonths = Array.from(
    new Set([...actualByMonth.keys(), ...budgetByMonth.keys()]),
  ).sort();

  if (!allMonths.length) {
    return <p className="text-xs text-gray-500 italic">No monthly detail.</p>;
  }

  const data = allMonths.map((m) => {
    const a = actualByMonth.get(m) ?? null;
    const b = budgetByMonth.get(m) ?? null;
    // Squash 0-filled future months to null so the actual line stops cleanly
    // at the last real month for vendors without a forecast.
    return {
      month: m.slice(-2), // MM
      key: m,
      Actual: isPresent(a) ? a : null,
      Budget: isPresent(b) ? b : null,
    };
  });

  return (
    <div className="w-full h-56">
      <ResponsiveContainer>
        <RLineChart data={data} margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
          <CartesianGrid stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: '#4b5563', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis
            tick={{ fill: '#4b5563', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            width={68}
            tickFormatter={(x: number) => USD_TICK.format(x)}
          />
          <Tooltip
            formatter={(x) => (typeof x === 'number' ? USD_TIP.format(x) : String(x ?? ''))}
            labelFormatter={(label, payload) => {
              const p = payload?.[0]?.payload as { key?: string } | undefined;
              return p?.key ?? String(label);
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line
            type="monotone"
            dataKey="Actual"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 2 }}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="Budget"
            stroke="#94a3b8"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={{ r: 2 }}
            connectNulls={false}
            isAnimationActive={false}
          />
          {currentMonthKey && (
            <ReferenceLine
              x={currentMonthKey.slice(-2)}
              stroke="#c0392b"
              strokeDasharray="2 3"
              label={{ value: 'Report', position: 'top', fill: '#c0392b', fontSize: 10 }}
            />
          )}
        </RLineChart>
      </ResponsiveContainer>
    </div>
  );
}
