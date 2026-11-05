import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getAdminFirestore();
    const snapshot = await db.collection('miscellaneous_cards').get();
    const cards = snapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Sin título',
          desc: data.desc || '',
          url: data.url || '',
          boardId: data.boardId || '',
          boardName: data.boardName || '',
          idList: data.idList || '',
          listName: data.listName || '',
          closed: Boolean(data.closed),
          attachments: data.attachments || [],
          hasReferenceDocs: Boolean(data.hasReferenceDocs),
          createdAt: data.createdAt || '',
          dateLastActivity: data.dateLastActivity || '',
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ cards });
  } catch (error: any) {
    console.error('[MiscellaneousCards GET Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener tarjetas misceláneas.' },
      { status: 500 }
    );
  }
}

