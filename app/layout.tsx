import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import { loadConfig } from '@/lib/data';

export const metadata: Metadata = {
  title: 'FP&A · Budget vs Actual',
  description: 'Medallion FP&A Budget vs Actual dashboards',
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let dashboards: Awaited<ReturnType<typeof loadConfig>>['dashboards'] = [];
  try {
    const config = await loadConfig();
    dashboards = config.dashboards;
  } catch {
    // Data source unreachable at boot — sidebar stays empty, index page still
    // renders a helpful error. Individual dashboard pages will surface the
    // fetch error themselves.
  }
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-row bg-gray-50">
        <Sidebar dashboards={dashboards} />
        <main className="flex-1 min-w-0">{children}</main>
      </body>
    </html>
  );
}
