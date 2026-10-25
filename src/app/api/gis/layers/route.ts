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

  const db = getDb();
  if (!db) {
    return NextResponse.json(
      { error: 'No se pudo inicializar la base de datos' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  try {
    let docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];

    if (projectCode && projectCode.toUpperCase() !== 'ALL') {
      const snap = await db.collection('projects_gis').doc(projectCode).collection('layers').get();
      docs = snap.docs;
    } else {
      const snap = await db.collectionGroup('layers').get();
      docs = snap.docs;
    }

    const layers = docs.map(doc => {
      const data = doc.data();
      // Omitir cachedGeoJson pesado en la lista general de metadata
      const { cachedGeoJson, ...metadata } = data;
      const layerId = metadata.id || doc.id;
      const pCode = metadata.projectCode || doc.ref.parent?.parent?.id || projectCode || 'GENERAL';

      return {
        ...metadata,
        id: layerId,
        projectCode: pCode,
        category: metadata.category || 'shp',
        downloadUrl: `/api/gis/layer?projectCode=${encodeURIComponent(pCode)}&layerId=${encodeURIComponent(layerId)}`,
      };
    });

    // Agrupar por categoría para el panel de CartoDEA
    const grouped: Record<string, any[]> = {
      shp: [],
      json: [],
      kml: [],
      img: [],
      dem: [],
    };

    for (const l of layers) {
      const cat = l.category || 'shp';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(l);
    }

    return NextResponse.json(
      {
        projectCode,
        totalLayers: layers.length,
        layers,
        grouped,
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
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
