import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getDb() {
  const keyFileName = 'studio-1428739321-e57bb-firebase-adminsdk-fbsvc-d9c6c381f2.json';
  const keyPath = path.resolve(process.cwd(), keyFileName);
  if (!fs.existsSync(keyPath)) return null;

  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
  return getFirestore(app);
}

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

  // 2. Si no está en disco, buscar en Firestore
  const db = getDb();
  if (db) {
    try {
      const doc = await db.collection('projects_gis').doc(projectCode).collection('layers').doc(layerId).get();
      if (doc.exists && doc.data()?.cachedGeoJson) {
        return new NextResponse(doc.data()!.cachedGeoJson, {
          status: 200,
          headers: {
            'Content-Type': 'application/geo+json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
    } catch (e: any) {
      console.error('[API GIS Layer] Error leyendo de Firestore:', e);
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
