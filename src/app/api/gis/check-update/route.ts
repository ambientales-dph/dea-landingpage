import { NextRequest, NextResponse } from 'next/server';
import { checkProjectHasUpdates } from '@/services/gis-service';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectCode = searchParams.get('projectCode');

  if (!projectCode) {
    return NextResponse.json(
      { error: 'Parámetro obligatorio: projectCode' },
      { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
  }

  try {
    const result = await checkProjectHasUpdates(projectCode);
    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error(`[API check-update] Error para ${projectCode}:`, err);
    return NextResponse.json(
      { error: err.message, projectCode, hasUpdates: false },
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
