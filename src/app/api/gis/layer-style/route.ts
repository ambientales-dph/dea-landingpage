import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectCode, layerId, assignedStyleId, assignedStyleOptions } = body;

    if (!projectCode || !layerId) {
      return NextResponse.json(
        { error: 'projectCode y layerId son obligatorios' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const db = getAdminFirestore();
    if (!db) {
      return NextResponse.json(
        { error: 'No se pudo inicializar la base de datos Firestore' },
        { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const layerDocRef = db.collection('projects_gis').doc(projectCode).collection('layers').doc(layerId);
    const docSnap = await layerDocRef.get();

    const updateData: Record<string, any> = {
      assignedStyleId: assignedStyleId || null,
      updatedAt: new Date().toISOString(),
    };

    if (assignedStyleOptions) {
      updateData.assignedStyleOptions = assignedStyleOptions;
    }

    if (docSnap.exists) {
      await layerDocRef.update(updateData);
    } else {
      await layerDocRef.set(updateData, { merge: true });
    }

    return NextResponse.json(
      { success: true, projectCode, layerId, assignedStyleId },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  } catch (error: any) {
    console.error('[API layer-style] Error guardando estilo de capa:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

