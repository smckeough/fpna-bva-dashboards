'use client';

import type { PeriodKey } from '@/lib/types';

type Props = {
  periods: { key: PeriodKey; label: string }[];
  value: PeriodKey;
  onChange: (p: PeriodKey) => void;
};

export default function PeriodToggle({ periods, value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm">
      {periods.map((p) => {
        const active = p.key === value;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange(p.key)}
            className={
              (active
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-50') +
              ' rounded-md px-3 py-1 font-medium transition-colors'
            }
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
