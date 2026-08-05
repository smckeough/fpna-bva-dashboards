'use client';

import { useState } from 'react';
import type { DashboardRecord } from '@/lib/types';
import { fmtValue, fmtVarPct } from '@/lib/format';

// Commentary section: department-head-facing summary bullets on top, with a
// collapsible "Source notes" panel underneath for finance drilldown.
// Falls back gracefully:
//   - summary present   → show bullets, offer source notes
//   - summary empty     → derive placeholder bullets from top movers
//   - nothing available → don't render at all (parent shell handles it)

type Props = {
  record: DashboardRecord;
  // A static prose body is still supported for one-off templates.
  body?: string;
};

export default function Commentary({ record, body }: Props) {
  const [showSources, setShowSources] = useState(false);
  const c = record.commentary;

  if (body && !c) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-gray-700 whitespace-pre-line">{body}</p>
      </div>
    );
  }

  if (!c) return null;

  const hasSummary = c.summary.length > 0;
  const hasRaw = c.raw.length > 0;
  const hasMovers = c.movers.length > 0;

  // Fallback: if editorial summary hasn't been written yet, derive terse
  // one-liners from top movers so the panel is never blank on new months.
  const derivedBullets = !hasSummary && hasMovers ? deriveFromMovers(c.movers) : [];

  if (!hasSummary && !derivedBullets.length && !hasRaw) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-semibold text-gray-900">Key drivers</h3>
        {!hasSummary && derivedBullets.length > 0 && (
          <span className="text-[10px] uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
            Auto — no editorial pass yet
          </span>
        )}
      </div>
      <ul className="list-disc pl-5 space-y-1.5 text-sm text-gray-800">
        {(hasSummary ? c.summary : derivedBullets).map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>

      {hasRaw && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setShowSources((v) => !v)}
            className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
          >
            <span
              className={`inline-block transition-transform ${showSources ? 'rotate-90' : ''}`}
              aria-hidden
            >
              ▶
            </span>
            {showSources ? 'Hide' : 'Show'} source notes ({c.raw.length})
          </button>
          {showSources && (
            <ul className="mt-2 space-y-1.5 text-xs text-gray-600">
              {c.raw.map((r, i) => (
                <li key={i} className="border-l-2 border-gray-100 pl-3">
                  <span className="font-medium text-gray-800">
                    {r.department ? `${r.department} · ` : ''}
                    {r.account ?? '—'}
                  </span>
                  {r.mtdActual != null && (
                    <span className="text-gray-500">
                      {' '}
                      · {fmtValue(r.mtdActual, 'currency')} MTD
                      {r.momDelta != null && (
                        <>
                          {' '}
                          · MoM {r.momDelta >= 0 ? '+' : ''}
                          {fmtValue(r.momDelta, 'currency')}
                        </>
                      )}
                    </span>
                  )}
                  <div className="mt-0.5 whitespace-pre-line">{r.note}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function deriveFromMovers(
  movers: NonNullable<DashboardRecord['commentary']>['movers'],
): string[] {
  return movers.slice(0, 3).map((m) => {
    const acct = (m.account ?? '').replace(/^[0-9]+\s*/, '') || '(unlabeled)';
    const dept = m.department ? `${m.department} — ` : '';
    const delta = m.momDelta ?? 0;
    const sign = delta >= 0 ? '+' : '';
    const pct = m.momPct != null ? ` (${fmtVarPct(m.momPct)})` : '';
    return `${dept}${acct}: ${sign}${fmtValue(delta, 'currency')} MoM${pct}`;
  });
}
