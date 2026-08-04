'use client';

import type { MonthIndexEntry } from '@/lib/types';

type Props = {
  months: MonthIndexEntry[];
  value: string;
  onChange: (key: string) => void;
  loading?: boolean;
};

export default function MonthPicker({ months, value, onChange, loading }: Props) {
  if (!months.length) return null;
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-gray-500">Month</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1 font-medium text-gray-900 shadow-sm disabled:opacity-50"
      >
        {months.map((m) => (
          <option key={m.key} value={m.key}>
            {m.label}
          </option>
        ))}
      </select>
      {loading && <span className="text-xs text-gray-400">loading…</span>}
    </label>
  );
}
