import { NextRequest, NextResponse } from 'next/server';
import { createSunoWorkspace } from '@/lib/SunoWorkspace';
import { getWorkspaceRows, updateWorkspaceStatus } from '@/lib/JatuneCatalog';
import { getCorsHeaders, requireApiKey } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const unauthorized = requireApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));
    const requestedAlbumId = body?.album_id ? Number(body.album_id) : null;

    const candidates = getWorkspaceRows()
      .filter((workspace) => workspace.tipo === 'Álbum' || workspace.tipo === 'EP')
      .filter((workspace) => workspace.workspace_status !== 'Creado')
      .filter((workspace) => requestedAlbumId ? workspace.album_id === requestedAlbumId : true);

    if (candidates.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          code: 'NO_WORKSPACE_CANDIDATE',
          message: 'No hay workspaces de tipo Álbum o EP pendientes de sincronizar con Suno.',
        },
        { status: 404, headers: getCorsHeaders(request) }
      );
    }

    const workspace = candidates[0];
    updateWorkspaceStatus(workspace.album_id, { workspace_status: 'Sincronizar', workspace_error: undefined });

    try {
      const result = await createSunoWorkspace(workspace.workspace_name);
      updateWorkspaceStatus(workspace.album_id, {
        workspace_status: 'Creado',
        suno_workspace_id: result.url || workspace.workspace_name,
        workspace_error: undefined,
      });

      return NextResponse.json(
        {
          ok: true,
          workspace: {
            album_id: workspace.album_id,
            workspace_name: workspace.workspace_name,
            tipo: workspace.tipo,
            artista: workspace.artista,
            status: 'Creado',
            result,
          },
        },
        { status: 200, headers: getCorsHeaders(request) }
      );
    } catch (error: any) {
      updateWorkspaceStatus(workspace.album_id, {
        workspace_status: 'Error',
        workspace_error: error?.message || 'No fue posible sincronizar el workspace con Suno.',
      });
      throw error;
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        code: 'SUNO_WORKSPACE_SYNC_FAILED',
        message: error?.message || 'No fue posible sincronizar el workspace con Suno.',
      },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 200, headers: getCorsHeaders(request) });
}
