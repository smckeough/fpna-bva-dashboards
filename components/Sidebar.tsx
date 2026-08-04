'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { DashboardConfigEntry } from '@/lib/types';

type Props = {
  dashboards: DashboardConfigEntry[];
};

export default function Sidebar({ dashboards }: Props) {
  const pathname = usePathname();
  const grouped = dashboards.reduce<Record<string, DashboardConfigEntry[]>>(
    (acc, d) => {
      const bucket = d.source === 'leaders' ? 'Leaders' : 'Departments';
      (acc[bucket] ??= []).push(d);
      return acc;
    },
    {},
  );

  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 bg-white h-screen sticky top-0 overflow-y-auto">
      <div className="px-5 py-5 border-b border-gray-200">
        <Link href="/" className="block">
          <p className="text-sm font-semibold text-gray-900">FP&amp;A</p>
          <p className="text-xs text-gray-500">Budget vs Actual</p>
        </Link>
      </div>
      <nav className="py-2 text-sm">
        {Object.entries(grouped).map(([bucket, items]) => (
          <div key={bucket} className="py-2">
            <p className="px-5 py-1 text-[11px] uppercase tracking-wide text-gray-400">
              {bucket}
            </p>
            {items.map((d) => {
              const active = pathname === d.route;
              return (
                <Link
                  key={d.id}
                  href={d.route}
                  className={
                    'block px-5 py-1.5 transition-colors ' +
                    (active
                      ? 'bg-blue-50 text-blue-700 font-medium border-l-2 border-blue-600'
                      : 'text-gray-700 hover:bg-gray-50 border-l-2 border-transparent')
                  }
                >
                  {d.title}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
