import Link from 'next/link';
import { loadBoth } from '@/lib/data';
import type { DashboardConfigEntry } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let config;
  let data;
  try {
    ({ config, data } = await loadBoth());
  } catch (err) {
    return (
      <div className="p-10">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">
          FP&amp;A · Budget vs Actual
        </h1>
        <p className="text-sm text-red-600 mt-4">
          Could not load dashboard-config.json / dashboard-data.json:{' '}
          {(err as Error).message}
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Set <code>NEXT_PUBLIC_DATA_BASE_URL</code> to the Finance-server URL
          hosting these files, or place them in <code>public/sample-data/</code>{' '}
          for local dev.
        </p>
      </div>
    );
  }

  const grouped: Record<string, DashboardConfigEntry[]> = {};
  for (const d of config.dashboards) {
    const bucket = d.source === 'leaders' ? 'Leaders' : 'Departments';
    (grouped[bucket] ??= []).push(d);
  }

  return (
    <div className="p-10">
      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
        {data.meta.reportMonth}
      </p>
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">
        FP&amp;A · Budget vs Actual
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        {config.dashboards.length} dashboards · source{' '}
        <span className="font-mono">{data.meta.source ?? 'n/a'}</span>
      </p>
      {Object.entries(grouped).map(([bucket, items]) => (
        <section key={bucket} className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">{bucket}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((d) => (
              <Link
                key={d.id}
                href={d.route}
                className="block bg-white rounded-xl border border-gray-200 px-6 py-5 hover:border-blue-400 hover:shadow-sm transition-all"
              >
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  {d.title}
                </p>
                <p className="text-xs text-gray-500 font-mono">{d.route}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
