import { NextRequest, NextResponse } from 'next/server';
import { importCatalogRecords, parseBulkCatalogText } from '@/lib/JatuneCatalog';
import { getCorsHeaders, requireApiKey } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const text = String(body?.text || '');

    if (!text.trim()) {
      return NextResponse.json(
        { ok: false, code: 'EMPTY_PAYLOAD', message: 'Debes enviar contenido en el campo text.' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    const parsed = parseBulkCatalogText(text);

    if (parsed.errors.length > 0) {
      return NextResponse.json(
        { ok: false, code: 'VALIDATION_ERRORS', records: parsed.records, errors: parsed.errors },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    const summary = importCatalogRecords(parsed.records);

    return NextResponse.json(
      { ok: true, summary, imported: parsed.records.length },
      { status: 200, headers: getCorsHeaders(request) }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, code: 'IMPORT_ERROR', message: error?.message || 'Error importando catálogo.' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 200, headers: getCorsHeaders(request) });
}
