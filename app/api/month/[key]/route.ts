import { NextResponse } from 'next/server';
import { loadMonth } from '@/lib/data';

export const dynamic = 'force-dynamic';

// Client-side month switch fetches from this endpoint so it doesn't have to
// go through the server-rendered dashboard route. The server reads the
// per-month JSON (from disk in dev, from NEXT_PUBLIC_DATA_BASE_URL in prod)
// and returns it as-is.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  try {
    const payload = await loadMonth(key);
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 404 },
    );
  }
}
