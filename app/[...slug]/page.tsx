import { notFound } from 'next/navigation';
import DashboardShell from '@/components/DashboardShell';
import { findDashboard, loadAllMonths, loadBootstrap } from '@/lib/data';

export const dynamic = 'force-dynamic';

type Params = { slug: string[] };

export default async function CatchAllDashboard({
  params,
}: {
  params: Promise<Params>;
}) {
  // Next 16 makes params async — must be awaited before use.
  const { slug } = await params;
  const route = '/' + (slug ?? []).join('/');

  let boot;
  try {
    boot = await loadBootstrap();
  } catch (err: unknown) {
    return (
      <div className="p-10">
        <h1 className="text-lg font-semibold text-gray-900 mb-2">
          Could not load dashboard data
        </h1>
        <p className="text-sm text-red-600">{(err as Error).message}</p>
      </div>
    );
  }

  const { config, index, defaultMonth } = boot;
  const found = findDashboard(config, route);
  if (!found) notFound();

  if (!defaultMonth) {
    return (
      <div className="p-10">
        <h1 className="text-lg font-semibold text-gray-900 mb-2">
          {found.entry.title}
        </h1>
        <p className="text-sm text-amber-700">
          No months available yet. Run{' '}
          <code>scripts/export_month.py</code> against a workbook to add one.
        </p>
      </div>
    );
  }

  // Pre-load every month so historyChart sections have the full trend. Falls
  // back gracefully if some months fail — the trend line just has holes.
  const months = await loadAllMonths(index);
  // Ensure the default month is present even if loadAllMonths couldn't reach
  // the others (e.g. the Finance server timed out on the rest).
  months[index.default!] = defaultMonth;

  return (
    <DashboardShell
      entry={found.entry}
      template={found.template}
      initialData={defaultMonth}
      index={index}
      config={config}
      months={months}
    />
  );
}
