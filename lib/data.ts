import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  DashboardConfig,
  DashboardData,
  DashboardRecord,
  MonthIndex,
} from './types';
import { normalizeRoute } from './types';

// Runtime loader for the three JSON blobs the app depends on:
//
//   dashboard-config.json                  — layout config (rare changes)
//   dashboard-data-index.json              — list of months + default
//   dashboard-data-<YYYY-MM>.json          — one file per closed month
//
// Behavior:
//   NEXT_PUBLIC_DATA_BASE_URL is an absolute http(s) URL
//     → fetch with cache: 'no-store' every request. Overwriting either file
//       on the Finance server updates the live app with no redeploy.
//
//   NEXT_PUBLIC_DATA_BASE_URL unset (local dev)
//     → read from sample-data/ on disk directly. No self-fetch, no port
//       juggling.
//
// Both branches disable caching so overwriting a file always wins.

const LOCAL_DIR = path.join(process.cwd(), 'sample-data');

function absoluteBase(): string | null {
  const raw = process.env.NEXT_PUBLIC_DATA_BASE_URL;
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

async function loadJson<T>(fileName: string): Promise<T> {
  const base = absoluteBase();
  if (base) {
    const url = `${base}/${fileName}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  }
  const filePath = path.join(LOCAL_DIR, fileName);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch (err) {
    throw new Error(
      `Could not read ${filePath}. Place ${fileName} in sample-data/ for local ` +
        `dev, or set NEXT_PUBLIC_DATA_BASE_URL to the Finance-server URL. ` +
        `Underlying error: ${(err as Error).message}`,
    );
  }
}

export async function loadConfig(): Promise<DashboardConfig> {
  return loadJson<DashboardConfig>('dashboard-config.json');
}

export async function loadIndex(): Promise<MonthIndex> {
  return loadJson<MonthIndex>('dashboard-data-index.json');
}

export async function loadMonth(monthKey: string): Promise<DashboardData> {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error(`Invalid month key: ${JSON.stringify(monthKey)} (expected YYYY-MM)`);
  }
  return loadJson<DashboardData>(`dashboard-data-${monthKey}.json`);
}

export async function loadBootstrap(): Promise<{
  config: DashboardConfig;
  index: MonthIndex;
  defaultMonth: DashboardData | null;
}> {
  const [config, index] = await Promise.all([loadConfig(), loadIndex()]);
  const defaultKey = index.default;
  const defaultMonth = defaultKey ? await loadMonth(defaultKey) : null;
  return { config, index, defaultMonth };
}

// Load every month referenced by the index. Used server-side for pages that
// render a historyChart section — trend lines need the full series. Files are
// small (~40KB), and both branches of loadJson disable caching, so this stays
// fresh on every request.
export async function loadAllMonths(
  index: MonthIndex,
): Promise<Record<string, DashboardData>> {
  const entries = await Promise.all(
    index.months.map(async (m) => {
      try {
        return [m.key, await loadMonth(m.key)] as const;
      } catch {
        return null;
      }
    }),
  );
  return Object.fromEntries(entries.filter((e) => e !== null));
}

export function findDashboard(
  config: DashboardConfig,
  route: string,
):
  | {
      entry: DashboardConfig['dashboards'][number];
      template: DashboardConfig['templates'][string];
    }
  | null {
  const target = normalizeRoute(route);
  const entry = config.dashboards.find(
    (d) => normalizeRoute(d.route) === target,
  );
  if (!entry) return null;
  const template = config.templates[entry.template];
  if (!template) return null;
  return { entry, template };
}

export function findRecord(
  data: DashboardData,
  source: 'departments' | 'leaders',
  dataKey: string,
): DashboardRecord | null {
  const bucket = data[source] ?? [];
  return bucket.find((r) => r.name === dataKey) ?? null;
}
