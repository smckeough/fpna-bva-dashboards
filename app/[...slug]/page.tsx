import { notFound } from 'next/navigation';
import DashboardShell from '@/components/DashboardShell';
import { findDashboard, findRecord, loadBoth } from '@/lib/data';

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

  let config;
  let data;
  try {
    ({ config, data } = await loadBoth());
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

  const found = findDashboard(config, route);
  if (!found) notFound();

  const record = findRecord(data, found.entry.source, found.entry.dataKey);
  if (!record) {
    return (
      <div className="p-10">
        <h1 className="text-lg font-semibold text-gray-900 mb-2">
          {found.entry.title}
        </h1>
        <p className="text-sm text-amber-700">
          Configured record <span className="font-mono">{found.entry.dataKey}</span>{' '}
          not found in <span className="font-mono">data.{found.entry.source}</span>
          .
        </p>
      </div>
    );
  }

  return (
    <DashboardShell
      entry={found.entry}
      template={found.template}
      record={record}
      config={config}
      reportMonth={data.meta.reportMonth}
    />
  );
}
