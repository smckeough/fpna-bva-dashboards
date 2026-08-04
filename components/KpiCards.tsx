import type {
  DashboardRecord,
  PeriodKey,
  SectionKpiCard,
} from '@/lib/types';
import { getWindow } from '@/lib/metrics';
import { fmtValue, fmtVarPct, varClass } from '@/lib/format';

type Props = {
  cards: SectionKpiCard[];
  record: DashboardRecord;
  period: PeriodKey;
  metricLabels?: Record<string, string>;
};

export default function KpiCards({ cards, record, period }: Props) {
  const budgetLoaded = record.budgetLoaded !== false;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => {
        const p = card.period ?? period;
        const w = getWindow(record, card.metric, p);
        const actual = w?.actual ?? null;
        const budget = w?.budget ?? null;
        const varPct = w?.varPct ?? null;
        return (
          <div
            key={`${card.metric}-${i}`}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
              {card.label}
            </p>
            <p className="text-2xl font-semibold text-gray-900">
              {fmtValue(actual, card.kind)}
            </p>
            {budgetLoaded ? (
              <p className="mt-1 text-xs text-gray-500">
                Budget {fmtValue(budget, card.kind)}
                <span className={`ml-2 font-medium ${varClass(varPct)}`}>
                  {fmtVarPct(varPct)}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-400 italic">no budget</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
