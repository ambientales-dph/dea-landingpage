import { NextRequest, NextResponse } from 'next/server';
import { syncProjectGisLayers, STANDARDIZED_PROJECTS } from '@/services/gis-service';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectCode = (searchParams.get('projectCode') || '').toUpperCase();
  let folderId = searchParams.get('folderId');

  if (!folderId && STANDARDIZED_PROJECTS[projectCode]) {
    folderId = STANDARDIZED_PROJECTS[projectCode].gisFolderId;
  }

  if (!projectCode || !folderId) {
    return NextResponse.json(
      { error: 'Parámetros obligatorios: projectCode y folderId' },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(data: any) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          console.warn('[Sync Stream] Client closed stream:', e);
        }
      }

      sendEvent({
        status: 'starting',
        projectCode,
        percent: 0,
        message: `Iniciando escaneo de ${projectCode} en Drive...`,
      });

      try {
        const layers = await syncProjectGisLayers(projectCode, folderId!, (progress) => {
          sendEvent({
            status: 'syncing',
            projectCode,
            current: progress.current,
            total: progress.total,
            layerName: progress.layerName,
            percent: progress.percent,
            message: `Procesando capa ${progress.current} de ${progress.total}: ${progress.layerName}`,
          });
        });

        sendEvent({
          status: 'completed',
          projectCode,
          total: layers.length,
          percent: 100,
          message: `Sincronización completada. ${layers.length} capas listas.`,
        });

        controller.close();
      } catch (err: any) {
        console.error(`[Sync Stream] Error en ${projectCode}:`, err);
        sendEvent({
          status: 'error',
          projectCode,
          error: err.message || 'Error durante la sincronización',
        });
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
