import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  DashboardConfig,
  DashboardData,
  DashboardRecord,
} from './types';
import { normalizeRoute } from './types';

// Runtime loader for the two JSON blobs. Behavior depends on the base URL:
//
//   NEXT_PUBLIC_DATA_BASE_URL set to an absolute http(s) URL
//     → fetch with cache: 'no-store' every request. Overwriting either file
//       on the Finance server updates the live app with no redeploy.
//
//   NEXT_PUBLIC_DATA_BASE_URL unset (local dev)
//     → read from public/sample-data/ on disk directly. No port juggling,
//       no self-fetch. The browser can still hit /sample-data/*.json if it
//       needs to.
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
      `Could not read ${filePath}. Place ${fileName} in sample-data/ ` +
        `for local dev, or set NEXT_PUBLIC_DATA_BASE_URL to the Finance-server URL. ` +
        `Underlying error: ${(err as Error).message}`,
    );
  }
}

export async function loadData(): Promise<DashboardData> {
  return loadJson<DashboardData>('dashboard-data.json');
}

export async function loadConfig(): Promise<DashboardConfig> {
  return loadJson<DashboardConfig>('dashboard-config.json');
}

export async function loadBoth(): Promise<{
  data: DashboardData;
  config: DashboardConfig;
}> {
  const [data, config] = await Promise.all([loadData(), loadConfig()]);
  return { data, config };
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
