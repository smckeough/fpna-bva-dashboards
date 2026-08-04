import type { DashboardRecord } from '@/lib/types';

const FLAG_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  BUDGET_NOT_LOADED: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-900',
    label: 'Budget not loaded — variances suppressed.',
  },
  HC_ACTUAL_MISSING: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-900',
    label: 'Headcount actual missing.',
  },
  REVIEW_LARGE_VARIANCE: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-900',
    label: 'Large variance — please review.',
  },
};

export default function FlagBanner({ record }: { record: DashboardRecord }) {
  const flags = record.flags ?? [];
  if (!flags.length && record.budgetLoaded !== false) return null;

  const shown = new Set(flags);
  if (record.budgetLoaded === false) shown.add('BUDGET_NOT_LOADED');

  return (
    <div className="space-y-2">
      {[...shown].map((flag) => {
        const style = FLAG_STYLES[flag] ?? {
          bg: 'bg-gray-50',
          border: 'border-gray-300',
          text: 'text-gray-800',
          label: flag,
        };
        return (
          <div
            key={flag}
            className={`rounded-lg border px-4 py-2 text-sm ${style.bg} ${style.border} ${style.text}`}
          >
            <span className="font-medium">{style.label}</span>
            {style.label === flag ? null : (
              <span className="ml-2 text-xs text-gray-500 font-mono">{flag}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
