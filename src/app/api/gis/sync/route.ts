import { NextRequest, NextResponse } from 'next/server';
import { syncProjectGisLayers } from '@/services/gis-service';

export async function GET(req: NextRequest) {
  return handleSync(req);
}

export async function POST(req: NextRequest) {
  return handleSync(req);
}

async function handleSync(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  let projectCode = searchParams.get('projectCode');
  let folderId = searchParams.get('folderId');

  // Si viene en el body JSON
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      if (body.projectCode) projectCode = body.projectCode;
      if (body.folderId) folderId = body.folderId;
    } catch {}
  }

  if (!projectCode || !folderId) {
    return NextResponse.json(
      { error: 'Parámetros obligatorios: projectCode y folderId' },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  try {
    const layers = await syncProjectGisLayers(projectCode, folderId);
    return NextResponse.json(
      { success: true, projectCode, layerCount: layers.length, layers },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  } catch (err: any) {
    console.error('[API GIS Sync] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Error durante la sincronización GIS' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
