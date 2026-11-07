import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, getAdminStorage } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { WHITELIST } from '@/lib/auth-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let corsConfigured = false;

async function ensureBucketCors(bucket: any) {
  if (corsConfigured) return;
  try {
    await bucket.setCorsConfiguration([
      {
        origin: ['*'],
        method: ['GET', 'PUT', 'POST', 'HEAD', 'DELETE', 'OPTIONS'],
        responseHeader: [
          'Content-Type',
          'Authorization',
          'Content-Length',
          'User-Agent',
          'x-goog-resumable',
        ],
        maxAgeSeconds: 3600,
      },
    ]);
    corsConfigured = true;
  } catch (e) {
    console.warn('[ReferenceDocs] No se pudo configurar CORS automáticamente:', e);
  }
}

export interface ReferenceFolderFile {
  name: string;
  url: string;
  size: number;
  sizeFormatted?: string;
  format?: string;
  comments?: string;
  driveId?: string;
}

export interface ReferenceDocument {
  id: string;
  title: string;
  comments: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  downloadUrl: string;
  uploadedBy: string;
  uploadedByEmail: string;
  createdAt: string;
  isFolder?: boolean;
  folderDriveUrl?: string;
  folderFiles?: ReferenceFolderFile[];
}

export async function GET() {
  try {
    const db = getAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: 'Firestore Admin no disponible' }, { status: 500 });
    }

    const snap = await db.collection('reference_documents').get();
    const docs: ReferenceDocument[] = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title || '',
        comments: data.comments || '',
        fileName: data.fileName || '',
        fileSize: data.fileSize || 0,
        mimeType: data.mimeType || (data.isFolder ? 'application/vnd.google-apps.folder' : 'application/octet-stream'),
        storagePath: data.storagePath || '',
        downloadUrl: data.downloadUrl || data.url || '',
        uploadedBy: data.uploadedBy || 'Usuario DEA',
        uploadedByEmail: data.uploadedByEmail || '',
        createdAt: data.createdAt || new Date().toISOString(),
        isFolder: Boolean(data.isFolder),
        folderDriveUrl: data.folderDriveUrl || data.url || '',
        folderFiles: data.folderFiles || [],
      };
    });

    docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ documents: docs });
  } catch (err: any) {
    console.error('[ReferenceDocs GET] Error:', err);
    return NextResponse.json({ error: err.message || 'Error al obtener documentos' }, { status: 500 });
  }
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
      console.warn('[ReferenceDocs] Error firmando URL de lectura:', signErr);
    }
  }

  return downloadUrl;
}

async function registerDocumentAndNotify(params: {
  bucket: any;
  storagePath: string;
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  title?: string;
  comments?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userPhoto?: string;
  overwriteDocId?: string;
  previousStoragePath?: string;
}) {
  const db = getAdminFirestore();
  if (!db) throw new Error('Firestore Admin no disponible');

  const authorizedUser = params.userEmail
    ? WHITELIST.find(u => u.email.toLowerCase() === params.userEmail!.toLowerCase())
    : undefined;
  const realName = authorizedUser?.name || params.userName || 'Usuario DEA';

  const cleanTitle = (params.title || '').trim();
  const cleanComments = (params.comments || '').trim();
  const displayLabel = cleanTitle || params.fileName;

  const docRef = params.overwriteDocId
    ? db.collection('reference_documents').doc(params.overwriteDocId)
    : db.collection('reference_documents').doc();
  const nowIso = new Date().toISOString();

  const docData: ReferenceDocument & { timestamp: any } = {
    id: docRef.id,
    title: cleanTitle,
    comments: cleanComments,
    fileName: params.fileName,
    fileSize: params.fileSize,
    mimeType: params.mimeType || 'application/pdf',
    storagePath: params.storagePath,
    downloadUrl: params.downloadUrl,
    uploadedBy: realName,
    uploadedByEmail: params.userEmail || '',
    createdAt: nowIso,
    timestamp: FieldValue.serverTimestamp(),
  };

  await docRef.set(docData);

  if (
    params.overwriteDocId &&
    params.previousStoragePath &&
    params.previousStoragePath !== params.storagePath
  ) {
    try {
      await params.bucket.file(params.previousStoragePath).delete();
    } catch (e) {
      console.warn('[ReferenceDocs] No se pudo borrar archivo previo al sobreescribir:', e);
    }
  }

  // Registrar notificación para la campana del Portal
  await db.collection('app_activities').add({
    userId: params.userId || 'portal-user',
    userName: realName,
    userEmail: params.userEmail || '',
    userPhoto: params.userPhoto || '',
    actionType: 'upload_reference_doc',
    projectName: displayLabel,
    detail: cleanComments ? `${params.fileName} — ${cleanComments}` : params.fileName,
    documentUrl: params.downloadUrl,
    timestamp: FieldValue.serverTimestamp(),
  });

  const { timestamp, ...serializableDoc } = docData;
  return serializableDoc;
}

export async function POST(req: NextRequest) {
  try {
    const storage = getAdminStorage();
    const db = getAdminFirestore();
    if (!storage || !db) {
      return NextResponse.json({ error: 'Firebase Admin no disponible' }, { status: 500 });
    }

    const bucket = storage.bucket();
    const contentTypeHeader = req.headers.get('content-type') || '';

    if (contentTypeHeader.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
      }

      const title = (formData.get('title') as string) || '';
      const comments = (formData.get('comments') as string) || '';
      const userId = (formData.get('userId') as string) || '';
      const userName = (formData.get('userName') as string) || '';
      const userEmail = (formData.get('userEmail') as string) || '';
      const userPhoto = (formData.get('userPhoto') as string) || '';
      const customFileName = (formData.get('customFileName') as string) || file.name;
      const overwriteDocId = (formData.get('overwriteDocId') as string) || undefined;
      const previousStoragePath = (formData.get('previousStoragePath') as string) || undefined;

      const safeFileName = customFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `reference_docs/${Date.now()}_${safeFileName}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const bucketFile = bucket.file(storagePath);
      await bucketFile.save(buffer, {
        contentType: file.type || 'application/pdf',
        resumable: false,
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });

      const downloadUrl = await resolveDownloadUrl(bucket, storagePath);
      const savedDoc = await registerDocumentAndNotify({
        bucket,
        storagePath,
        downloadUrl,
        fileName: customFileName,
        fileSize: file.size,
        mimeType: file.type || 'application/pdf',
        title,
        comments,
        userId,
        userName,
        userEmail,
        userPhoto,
        overwriteDocId,
        previousStoragePath,
      });

      return NextResponse.json({ success: true, document: savedDoc });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'get-upload-url') {
      await ensureBucketCors(bucket);
      const rawFileName = body.fileName || 'documento.pdf';
      const mimeType = body.mimeType || 'application/pdf';
      const safeFileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `reference_docs/${Date.now()}_${safeFileName}`;

      const file = bucket.file(storagePath);
      const [uploadUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 45 * 60 * 1000,
        contentType: mimeType,
      });

      return NextResponse.json({ uploadUrl, storagePath });
    }

    if (action === 'finalize-upload') {
      const {
        storagePath,
        fileName,
        fileSize,
        mimeType,
        title,
        comments,
        userId,
        userName,
        userEmail,
        userPhoto,
        overwriteDocId,
        previousStoragePath,
      } = body;

      if (!storagePath || !fileName) {
        return NextResponse.json({ error: 'Faltan datos del archivo subido' }, { status: 400 });
      }

      const downloadUrl = await resolveDownloadUrl(bucket, storagePath);
      const savedDoc = await registerDocumentAndNotify({
        bucket,
        storagePath,
        downloadUrl,
        fileName,
        fileSize: Number(fileSize) || 0,
        mimeType: mimeType || 'application/pdf',
        title,
        comments,
        userId,
        userName,
        userEmail,
        userPhoto,
        overwriteDocId,
        previousStoragePath,
      });

      return NextResponse.json({ success: true, document: savedDoc });
    }

    if (action === 'delete') {
      const { id, storagePath } = body;
      if (!id) {
        return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
      }
      await db.collection('reference_documents').doc(id).delete();
      if (storagePath) {
        try {
          await bucket.file(storagePath).delete();
        } catch (e) {
          console.warn('[ReferenceDocs] No se pudo borrar el objeto de Storage:', e);
        }
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (err: any) {
    console.error('[ReferenceDocs POST] Error:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}

