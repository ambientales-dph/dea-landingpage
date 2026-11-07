import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, getAdminStorage } from '@/firebase/admin';
import { RECURSOS_PROPIOS, type RecursoPropio } from '@/lib/recursos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFormatFromFileName(name: string): 'docx' | 'xlsx' | 'pdf' | 'folder' {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'xlsx';
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) return 'docx';
  return 'docx';
}

async function resolveDownloadUrl(bucket: any, storagePath: string): Promise<string> {
  const file = bucket.file(storagePath);
  let downloadUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(storagePath).replace(/%2F/g, '/')}`;

  try {
    await file.makePublic();
  } catch {
    try {
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: '01-01-2035',
      });
      downloadUrl = signedUrl;
    } catch (signErr) {
      console.warn('[InternalResources] Error firmando URL de lectura:', signErr);
    }
  }

  return downloadUrl;
}

export async function GET() {
  try {
    const db = getAdminFirestore();
    if (!db) {
      return NextResponse.json({ resources: RECURSOS_PROPIOS });
    }

    const coll = db.collection('internal_resources');
    const snap = await coll.get();

    if (snap.empty) {
      // Auto-inicializar colección con los 11 recursos predeterminados
      const batch = db.batch();
      for (const item of RECURSOS_PROPIOS) {
        const ref = coll.doc(item.id);
        batch.set(ref, {
          ...item,
          updatedAt: new Date().toISOString(),
        });
      }
      await batch.commit();
      return NextResponse.json({ resources: RECURSOS_PROPIOS });
    }

    const resources: RecursoPropio[] = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        order: data.order ?? 99,
        section: data.section || 'guias',
        title: data.title || '',
        url: data.url || '',
        isFolder: Boolean(data.isFolder),
        fileName: data.fileName || '',
        format: data.format || (data.isFolder ? 'folder' : 'docx'),
        fileSizeText: data.fileSizeText || '',
        createdAtText: data.createdAtText || '',
        uploadedBy: data.uploadedBy || 'DEA',
        description: data.description || '',
        storagePath: data.storagePath || '',
      };
    });

    resources.sort((a, b) => a.order - b.order);

    return NextResponse.json({ resources });
  } catch (err: any) {
    console.error('[InternalResources GET] Error:', err);
    return NextResponse.json({ resources: RECURSOS_PROPIOS, error: err.message });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const db = getAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: 'Firestore no disponible' }, { status: 500 });
    }

    const body = await req.json();
    const { id, title, description, url } = body;

    if (!id) {
      return NextResponse.json({ error: 'Falta ID del recurso' }, { status: 400 });
    }

    const docRef = db.collection('internal_resources').doc(id);
    const docSnap = await docRef.get();

    const updates: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };
    if (typeof title === 'string' && title.trim()) updates.title = title.trim();
    if (typeof description === 'string') updates.description = description.trim();
    if (typeof url === 'string' && url.trim()) updates.url = url.trim();

    if (!docSnap.exists) {
      // Buscar en los defaults para crearlo
      const fallback = RECURSOS_PROPIOS.find(r => r.id === id) || {
        id,
        order: 99,
        section: 'guias' as const,
        title: title || id,
        url: url || '',
      };
      await docRef.set({
        ...fallback,
        ...updates,
      });
    } else {
      await docRef.update(updates);
    }

    const updatedSnap = await docRef.get();
    return NextResponse.json({ success: true, resource: { id: updatedSnap.id, ...updatedSnap.data() } });
  } catch (err: any) {
    console.error('[InternalResources PATCH] Error:', err);
    return NextResponse.json({ error: err.message || 'Error al actualizar metadatos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getAdminFirestore();
    const storage = getAdminStorage();

    if (!db || !storage) {
      return NextResponse.json({ error: 'Servicios de Firebase Admin no disponibles' }, { status: 500 });
    }

    const bucket = storage.bucket();

    const formData = await req.formData();
    const id = formData.get('id') as string;
    const title = (formData.get('title') as string) || '';
    const description = (formData.get('description') as string) || '';
    const file = formData.get('file') as File | null;

    if (!id) {
      return NextResponse.json({ error: 'Falta el ID del recurso' }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `internal_resources/${Date.now()}_${sanitizedFileName}`;

    const storageFile = bucket.file(storagePath);
    await storageFile.save(buffer, {
      contentType: file.type || 'application/octet-stream',
      resumable: false,
    });

    const downloadUrl = await resolveDownloadUrl(bucket, storagePath);
    const fileSizeText = formatBytes(buffer.length);
    const format = getFormatFromFileName(file.name);

    const now = new Date();
    const createdAtText = now.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const docRef = db.collection('internal_resources').doc(id);
    const docSnap = await docRef.get();

    const updates: Record<string, any> = {
      url: downloadUrl,
      storagePath,
      fileName: file.name,
      fileSizeText,
      format,
      createdAtText,
      isFolder: false,
      updatedAt: now.toISOString(),
    };

    if (title.trim()) updates.title = title.trim();
    if (description.trim()) updates.description = description.trim();

    if (!docSnap.exists) {
      const fallback = RECURSOS_PROPIOS.find(r => r.id === id) || {
        id,
        order: 99,
        section: 'guias' as const,
        title: title || file.name,
        uploadedBy: 'DEA',
      };
      await docRef.set({
        ...fallback,
        ...updates,
      });
    } else {
      await docRef.update(updates);
    }

    const finalSnap = await docRef.get();
    return NextResponse.json({ success: true, resource: { id: finalSnap.id, ...finalSnap.data() } });
  } catch (err: any) {
    console.error('[InternalResources POST] Error subiendo nueva versión:', err);
    return NextResponse.json({ error: err.message || 'Error al subir nueva versión' }, { status: 500 });
  }
}

