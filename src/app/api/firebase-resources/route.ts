import { NextRequest, NextResponse } from 'next/server';
import { getAdminApp, getAdminFirestore, getAdminStorage } from '@/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'studio-1428739321-e57bb';
const OWNER_EMAIL = 'ambientales.dph@gmail.com';

// Límites oficiales de la Capa Gratuita (No-Cost Tier) de Firebase
const LIMITS = {
  firestoreStorageBytes: 1024 * 1024 * 1024, // 1 GiB
  firebaseStorageBytes: 5 * 1024 * 1024 * 1024, // 5 GiB
  dailyReads: 50000,
  dailyWrites: 20000,
  dailyDeletes: 20000,
};

interface CollectionStat {
  name: string;
  label: string;
  docCount: number;
  bytes: number;
}

// Caché de 5 minutos para el escaneo de tamaño de colecciones de Firestore
// (evita consumir lecturas de documentos cada vez que se abre el panel)
let cachedFirestoreBreakdown: {
  timestamp: number;
  totalBytes: number;
  totalDocs: number;
  collections: CollectionStat[];
} | null = null;

const COLLECTION_LABELS: Record<string, string> = {
  projects: 'Proyectos y Obras (Migrados de Trello)',
  miscellaneous_cards: 'Tarjetas Misceláneas (Biblioteca)',
  reference_documents: 'Documentación de Referencia (Metadatos)',
  project_boards: 'Tableros, Listas y Etiquetas',
  timeline_projects: 'Línea de Tiempo (Proyectos e Hitos)',
  timeline_categories: 'Categorías de Línea de Tiempo',
  app_activities: 'Bitácora de Actividades y Notificaciones',
  mail_alerts: 'Radar de Correos y Alertas de Gmail',
  notificaciones_obras: 'Notificaciones de Obras (Data Bus)',
  projects_gis: 'Capas Cartográficas Vinculadas (CartoDEA)',
  feedback: 'Sugerencias y Reportes de Usuarios',
};

async function computeFirestoreBreakdown(forceRefresh: boolean = false) {
  const now = Date.now();
  if (!forceRefresh && cachedFirestoreBreakdown && now - cachedFirestoreBreakdown.timestamp < 5 * 60 * 1000) {
    return cachedFirestoreBreakdown;
  }

  const db = getAdminFirestore();
  if (!db) {
    throw new Error('No se pudo inicializar Firestore Admin.');
  }

  const rootCollections = await db.listCollections();
  const collectionsStats: CollectionStat[] = [];
  let totalBytes = 0;
  let totalDocs = 0;

  for (const colRef of rootCollections) {
    const colName = colRef.id;
    const snap = await colRef.get();
    let colBytes = 0;
    let colDocs = snap.size;

    for (const docSnap of snap.docs) {
      // Estimación de tamaño en Firestore: JSON serializado + ~128 bytes de metadatos/ruta + factor 1.25 de índices
      const rawJsonBytes = Buffer.byteLength(JSON.stringify(docSnap.data()), 'utf8') + 128;
      colBytes += Math.round(rawJsonBytes * 1.25);

      if (colName === 'timeline_projects') {
        const msSnap = await docSnap.ref.collection('milestones').get();
        colDocs += msSnap.size;
        for (const msDoc of msSnap.docs) {
          const msBytes = Buffer.byteLength(JSON.stringify(msDoc.data()), 'utf8') + 128;
          colBytes += Math.round(msBytes * 1.25);
        }
      }
    }

    totalBytes += colBytes;
    totalDocs += colDocs;

    collectionsStats.push({
      name: colName,
      label: COLLECTION_LABELS[colName] || colName,
      docCount: colDocs,
      bytes: colBytes,
    });
  }

  collectionsStats.sort((a, b) => b.bytes - a.bytes);

  cachedFirestoreBreakdown = {
    timestamp: now,
    totalBytes,
    totalDocs,
    collections: collectionsStats,
  };

  return cachedFirestoreBreakdown;
}

async function fetchCloudMonitoringOperations() {
  const app = getAdminApp();
  if (!app || !app.options.credential) {
    throw new Error('Credenciales de Firebase Admin no disponibles.');
  }

  const tokenRes = await app.options.credential.getAccessToken();
  const token = tokenRes.access_token;

  const now = new Date();
  // Consultamos los últimos 7 días completos hasta ahora
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  // Preparar mapa de los últimos 7 días en formato YYYY-MM-DD (hora local Argentina UTC-3)
  const dailyMap = new Map<string, { date: string; label: string; reads: number; writes: number; deletes: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const key = `${yyyy}-${mm}-${dd}`;
    const label = d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    dailyMap.set(key, { date: key, label, reads: 0, writes: 0, deletes: 0 });
  }

  const todayKey = Array.from(dailyMap.keys()).pop()!;

  const metrics: { type: string; field: 'reads' | 'writes' | 'deletes' }[] = [
    { type: 'firestore.googleapis.com/document/read_count', field: 'reads' },
    { type: 'firestore.googleapis.com/document/write_count', field: 'writes' },
    { type: 'firestore.googleapis.com/document/delete_count', field: 'deletes' },
  ];

  await Promise.all(
    metrics.map(async ({ type, field }) => {
      const url =
        `https://monitoring.googleapis.com/v3/projects/${PROJECT_ID}/timeSeries` +
        `?filter=${encodeURIComponent(`metric.type="${type}"`)}` +
        `&interval.startTime=${sevenDaysAgo.toISOString()}` +
        `&interval.endTime=${now.toISOString()}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      if (!res.ok) return;
      const data = await res.json();

      for (const ts of data.timeSeries || []) {
        for (const pt of ts.points || []) {
          const val = Number(pt.value?.int64Value || pt.value?.doubleValue || 0);
          const endTimeStr = pt.interval?.endTime || pt.interval?.startTime;
          if (!endTimeStr) continue;
          const ptDate = new Date(endTimeStr);
          const yyyy = ptDate.getFullYear();
          const mm = String(ptDate.getMonth() + 1).padStart(2, '0');
          const dd = String(ptDate.getDate()).padStart(2, '0');
          const key = `${yyyy}-${mm}-${dd}`;
          const entry = dailyMap.get(key);
          if (entry) {
            entry[field] += val;
          }
        }
      }
    })
  );

  // Consultar también firestore.googleapis.com/storage/data_and_index_storage_bytes si Google Cloud lo reporta
  let cloudReportedFirestoreBytes: number | null = null;
  try {
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const storageMetricUrl =
      `https://monitoring.googleapis.com/v3/projects/${PROJECT_ID}/timeSeries` +
      `?filter=${encodeURIComponent('metric.type="firestore.googleapis.com/storage/data_and_index_storage_bytes"')}` +
      `&interval.startTime=${twoDaysAgo.toISOString()}` +
      `&interval.endTime=${now.toISOString()}`;
    const stRes = await fetch(storageMetricUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (stRes.ok) {
      const stData = await stRes.json();
      let latestBytes = 0;
      for (const ts of stData.timeSeries || []) {
        const latestPoint = ts.points?.[0];
        if (latestPoint) {
          latestBytes += Number(latestPoint.value?.int64Value || latestPoint.value?.doubleValue || 0);
        }
      }
      if (latestBytes > 0) cloudReportedFirestoreBytes = latestBytes;
    }
  } catch {
    // Ignorar si no hay puntos recientes de esa métrica
  }

  const history = Array.from(dailyMap.values());
  const todayStats = dailyMap.get(todayKey) || { date: todayKey, label: 'Hoy', reads: 0, writes: 0, deletes: 0 };

  return {
    today: todayStats,
    history,
    cloudReportedFirestoreBytes,
  };
}

async function fetchStorageUsage() {
  const storage = getAdminStorage();
  if (!storage) {
    throw new Error('No se pudo inicializar Firebase Storage Admin.');
  }

  const bucket = storage.bucket();
  const [files] = await bucket.getFiles();

  let totalBytes = 0;
  const folderMap = new Map<string, { folder: string; label: string; fileCount: number; bytes: number }>();

  const FOLDER_LABELS: Record<string, string> = {
    gis: 'Capas Cartográficas y Archivos SIG (CartoDEA / GIS)',
    reference_docs: 'Documentación de Referencia (Biblioteca)',
    project_attachments: 'Adjuntos de Proyectos (Migrados de Trello)',
    '(raíz)': 'Archivos en raíz del Bucket',
  };

  for (const f of files) {
    const size = Number(f.metadata?.size || 0);
    // Ignorar marcadores de carpeta vacíos de 0 bytes que terminan en /
    if (size === 0 && f.name.endsWith('/')) continue;

    totalBytes += size;
    const prefix = f.name.includes('/') ? f.name.split('/')[0] : '(raíz)';
    if (!folderMap.has(prefix)) {
      folderMap.set(prefix, {
        folder: prefix,
        label: FOLDER_LABELS[prefix] || `Carpeta /${prefix}`,
        fileCount: 0,
        bytes: 0,
      });
    }
    const item = folderMap.get(prefix)!;
    item.fileCount += 1;
    item.bytes += size;
  }

  const folders = Array.from(folderMap.values()).sort((a, b) => b.bytes - a.bytes);

  return {
    bucketName: bucket.name,
    totalBytes,
    totalFiles: folders.reduce((acc, f) => acc + f.fileCount, 0),
    folders,
  };
}

export async function GET(request: NextRequest) {
  try {
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1';

    const [firestoreBreakdown, monitoringData, storageUsage] = await Promise.all([
      computeFirestoreBreakdown(forceRefresh),
      fetchCloudMonitoringOperations(),
      fetchStorageUsage(),
    ]);

    const effectiveFirestoreBytes = Math.max(
      firestoreBreakdown.totalBytes,
      monitoringData.cloudReportedFirestoreBytes || 0
    );

    return NextResponse.json({
      account: {
        ownerEmail: OWNER_EMAIL,
        projectId: PROJECT_ID,
        tierName: 'Capa Sin Costo (Spark / Blaze Free Tier)',
        quotaResetInfo: 'Reinicio diario a las 00:00 PT (04:00 / 05:00 hs Argentina)',
      },
      limits: LIMITS,
      firestore: {
        usedBytes: effectiveFirestoreBytes,
        estimatedCollectionsBytes: firestoreBreakdown.totalBytes,
        cloudReportedBytes: monitoringData.cloudReportedFirestoreBytes,
        remainingBytes: Math.max(0, LIMITS.firestoreStorageBytes - effectiveFirestoreBytes),
        limitBytes: LIMITS.firestoreStorageBytes,
        totalDocs: firestoreBreakdown.totalDocs,
        collections: firestoreBreakdown.collections,
        lastScannedAt: new Date(firestoreBreakdown.timestamp).toISOString(),
      },
      storage: {
        bucketName: storageUsage.bucketName,
        usedBytes: storageUsage.totalBytes,
        remainingBytes: Math.max(0, LIMITS.firebaseStorageBytes - storageUsage.totalBytes),
        limitBytes: LIMITS.firebaseStorageBytes,
        totalFiles: storageUsage.totalFiles,
        folders: storageUsage.folders,
      },
      operations: {
        today: {
          date: monitoringData.today.date,
          reads: {
            used: monitoringData.today.reads,
            limit: LIMITS.dailyReads,
            remaining: Math.max(0, LIMITS.dailyReads - monitoringData.today.reads),
          },
          writes: {
            used: monitoringData.today.writes,
            limit: LIMITS.dailyWrites,
            remaining: Math.max(0, LIMITS.dailyWrites - monitoringData.today.writes),
          },
          deletes: {
            used: monitoringData.today.deletes,
            limit: LIMITS.dailyDeletes,
            remaining: Math.max(0, LIMITS.dailyDeletes - monitoringData.today.deletes),
          },
        },
        history7Days: monitoringData.history,
      },
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[FirebaseResources API Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Error al consultar métricas de recursos Firebase.' },
      { status: 500 }
    );
  }
}
