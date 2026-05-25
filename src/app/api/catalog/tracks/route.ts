import { NextResponse } from 'next/server';
import { getCatalogRows } from '@/lib/JatuneCatalog';
import { getCorsHeaders } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const artist = url.searchParams.get('artist');

  let rows = getCatalogRows();

  if (status) rows = rows.filter(row => row.estado.toLowerCase() === status.toLowerCase());
  if (artist) rows = rows.filter(row => row.artista.toLowerCase().includes(artist.toLowerCase()));

  return NextResponse.json(
    { ok: true, count: rows.length, tracks: rows },
    { status: 200, headers: getCorsHeaders(request) }
  );
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 200, headers: getCorsHeaders(request) });
}
