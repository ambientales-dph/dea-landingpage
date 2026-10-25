import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getAdminStorage } from '@/firebase/admin';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectCode = searchParams.get('projectCode');
  const layerId = searchParams.get('layerId');

  if (!projectCode || !layerId) {
    return NextResponse.json(
      { error: 'Parámetros obligatorios: projectCode y layerId' },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  // 1. Intentar servir desde el archivo en disco (public/gis_cache/...)
  const diskPath = path.resolve(process.cwd(), 'public', 'gis_cache', projectCode, `${layerId}.geojson`);
  if (fs.existsSync(diskPath)) {
    const content = fs.readFileSync(diskPath, 'utf8');
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'application/geo+json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  // 2. Si no está en disco local, buscar y descargar desde Firebase Storage
  const storage = getAdminStorage();
  const bucket = storage ? storage.bucket() : null;
  if (bucket) {
    try {
      const file = bucket.file(`gis/${projectCode}/${layerId}.geojson`);
      const [exists] = await file.exists();
      if (exists) {
        const [content] = await file.download();
        return new NextResponse(content, {
          status: 200,
          headers: {
            'Content-Type': 'application/geo+json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
    } catch (e: any) {
      console.error('[API GIS Layer] Error leyendo de Firebase Storage:', e);
    }
  }

  return NextResponse.json(
    { error: 'Capa no encontrada en caché' },
    { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
  );
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
