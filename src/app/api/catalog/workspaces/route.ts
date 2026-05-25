import { NextResponse } from 'next/server';
import { getWorkspaceRows } from '@/lib/JatuneCatalog';
import { getCorsHeaders } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');

  let workspaces = getWorkspaceRows();
  if (status) {
    workspaces = workspaces.filter(workspace => workspace.workspace_status.toLowerCase() === status.toLowerCase());
  }

  return NextResponse.json(
    { ok: true, count: workspaces.length, workspaces },
    { status: 200, headers: getCorsHeaders(request) }
  );
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 200, headers: getCorsHeaders(request) });
}
