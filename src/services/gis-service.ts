// Polyfill para Node.js donde 'self' no está definido (requerido por shpjs)
if (typeof (globalThis as any).self === 'undefined') {
  (globalThis as any).self = globalThis;
}

import { google } from 'googleapis';
import proj4 from 'proj4';
import { kml } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// ---------------------------------------------------------------------------
// 1. Inicialización de Firebase Admin (Firestore + Storage)
// ---------------------------------------------------------------------------
const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'studio-1428739321-e57bb.firebasestorage.app';

let adminDb: FirebaseFirestore.Firestore | null = null;
let adminStorage: ReturnType<typeof getStorage> | null = null;

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const keyFileName = 'studio-1428739321-e57bb-firebase-adminsdk-fbsvc-d9c6c381f2.json';
  const keyPath = path.resolve(process.cwd(), keyFileName);

  if (fs.existsSync(keyPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    return initializeApp({
      credential: cert(serviceAccount),
      storageBucket: STORAGE_BUCKET,
    });
  } else {
    console.warn(`[GIS] No se encontró el archivo de credenciales Admin en ${keyPath}`);
    return null;
  }
}

function getAdminFirestore() {
  if (adminDb) return adminDb;
  const app = getAdminApp();
  if (app) {
    adminDb = getFirestore(app);
  }
  return adminDb;
}

function getAdminStorage() {
  if (adminStorage) return adminStorage;
  const app = getAdminApp();
  if (app) {
    adminStorage = getStorage(app);
  }
  return adminStorage;
}

// ---------------------------------------------------------------------------
// 2. Google Drive Client (100% READ-ONLY)
// ---------------------------------------------------------------------------
let driveClient: ReturnType<typeof google.drive> | null = null;

function getDriveClient() {
  if (driveClient) return driveClient;
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  driveClient = google.drive({ version: 'v3', auth: oauth2Client });
  return driveClient;
}


// ---------------------------------------------------------------------------
// 3. Definición de Proyecciones Cartográficas Frecuentes en PBA
// ---------------------------------------------------------------------------
// POSGAR 2007 Faja 5 (EPSG:5347)
proj4.defs(
  'POSGAR2007_5',
  '+proj=tmerc +lat_0=-90 +lon_0=-60 +k=1 +x_0=5500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'
);

// POSGAR 2007 Faja 6 (EPSG:5348)
proj4.defs(
  'POSGAR2007_6',
  '+proj=tmerc +lat_0=-90 +lon_0=-57 +k=1 +x_0=6500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'
);

// Campo Inchauspe Faja 5 (EPSG:22185)
proj4.defs(
  'INCHAUSPE_5',
  '+proj=tmerc +lat_0=-90 +lon_0=-60 +k=1 +x_0=5500000 +y_0=0 +ellps=intl +towgs84=-148,136,90,0,0,0,0 +units=m +no_defs'
);

// Campo Inchauspe Faja 6 (EPSG:22186)
proj4.defs(
  'INCHAUSPE_6',
  '+proj=tmerc +lat_0=-90 +lon_0=-57 +k=1 +x_0=6500000 +y_0=0 +ellps=intl +towgs84=-148,136,90,0,0,0,0 +units=m +no_defs'
);

// ---------------------------------------------------------------------------
// 4. Interfaces y Tipos
// ---------------------------------------------------------------------------
export interface GisLayerMetadata {
  id: string;
  name: string;
  title: string;
  category: 'shp' | 'json' | 'kml' | 'img' | 'dem';
  geometryType: string;
  featureCount: number;
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  sourceProjection: string;
  driveFolderId: string;
  lastModifiedDrive?: string;
  lastSync: string;
  storagePath?: string;
  downloadUrl?: string;
  hasCachedData?: boolean;
}

export interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string | null;
  size?: string | null;
}

// Carpetas permitidas
const ALLOWED_CATEGORIES = new Set(['shp', 'json', 'geojson', 'kml', 'img', 'dem']);

// Carpetas explícitamente ignoradas
const IGNORED_CATEGORIES = new Set(['tabla', 'tablas', 'reportes', 'dwg', 'lyr', 'pdf', 'mapas']);

// ---------------------------------------------------------------------------
// 5. Utilidades Geográficas
// ---------------------------------------------------------------------------
export function detectProjection(prjText: string): string {
  if (!prjText) return 'EPSG:4326';
  const upper = prjText.toUpperCase();
  if (upper.includes('POSGAR') && (upper.includes('ZONE_5') || upper.includes('ARGENTINA_5') || upper.includes('FAJA_5') || upper.includes('FAJA 5'))) {
    return 'POSGAR2007_5';
  }
  if (upper.includes('POSGAR') && (upper.includes('ZONE_6') || upper.includes('ARGENTINA_6') || upper.includes('FAJA_6') || upper.includes('FAJA 6'))) {
    return 'POSGAR2007_6';
  }
  if (upper.includes('INCHAUSPE') && (upper.includes('FAJA_5') || upper.includes('FAJA 5') || upper.includes('ZONE_5') || upper.includes('ZONE 5'))) {
    return 'INCHAUSPE_5';
  }
  if (upper.includes('INCHAUSPE') && (upper.includes('FAJA_6') || upper.includes('FAJA 6') || upper.includes('ZONE_6') || upper.includes('ZONE 6'))) {
    return 'INCHAUSPE_6';
  }
  if (upper.includes('WGS_1984') || upper.includes('WGS84')) {
    return 'EPSG:4326';
  }
  if (upper.includes('POSGAR')) {
    return 'POSGAR2007_5';
  }
  return 'EPSG:4326';
}

export function reprojectCoordinates(coords: any, fromProj: string): any {
  if (!coords) return coords;
  if (typeof coords[0] === 'number') {
    const [x, y] = coords;
    // Si ya parece WGS84 (lon: -180..180, lat: -90..90) no reproyectar
    if (x >= -180 && x <= 180 && y >= -90 && y <= 90) {
      return [x, y];
    }
    
    // Auto-detección inteligente si no había .prj pero las coordenadas están en metros
    let effectiveProj = fromProj;
    if (effectiveProj === 'EPSG:4326') {
      if (x >= 5000000 && x < 6000000) {
        effectiveProj = 'POSGAR2007_5';
      } else if (x >= 6000000 && x < 7000000) {
        effectiveProj = 'POSGAR2007_6';
      }
    }

    try {
      const [lon, lat] = proj4(effectiveProj, 'EPSG:4326', [x, y]);
      return [lon, lat];
    } catch {
      return [x, y];
    }
  } else if (Array.isArray(coords)) {
    return coords.map((c: any) => reprojectCoordinates(c, fromProj));
  }
  return coords;
}

export function computeBBox(coordinates: any): [number, number, number, number] {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;

  function walk(c: any) {
    if (!c) return;
    if (typeof c[0] === 'number') {
      const [lon, lat] = c;
      if (typeof lon === 'number' && !isNaN(lon) && typeof lat === 'number' && !isNaN(lat)) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    } else if (Array.isArray(c)) {
      for (const item of c) walk(item);
    }
  }

  walk(coordinates);

  if (minLon === Infinity || minLat === Infinity) {
    return [-65, -41, -56, -33]; // Fallback PBA bounds
  }

  return [minLon, minLat, maxLon, maxLat];
}

// ---------------------------------------------------------------------------
// 6. Funciones de Lectura Segura de Google Drive (READ-ONLY)
// ---------------------------------------------------------------------------
async function downloadBuffer(fileId: string): Promise<Buffer> {
  const res = await getDriveClient().files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
  return Buffer.from(res.data as ArrayBuffer);
}

export async function listDriveFolder(folderId: string): Promise<DriveItem[]> {
  const res = await getDriveClient().files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, modifiedTime, size)',
    pageSize: 1000,
  });
  return (res.data.files || []).map(f => ({
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType!,
    modifiedTime: f.modifiedTime,
    size: f.size,
  }));
}

/**
 * Localiza la subcarpeta GIS dentro de la carpeta raíz del proyecto de forma case-insensitive
 */
export async function findGisFolderId(rootOrGisFolderId: string): Promise<string> {
  // Primero verificar si la carpeta proporcionada ya es la carpeta GIS
  const info = await getDriveClient().files.get({ fileId: rootOrGisFolderId, fields: 'name' });
  if (info.data.name && info.data.name.trim().toLowerCase() === 'gis') {
    return rootOrGisFolderId;
  }

  // Si es la raíz del proyecto, buscar la subcarpeta GIS
  const contents = await listDriveFolder(rootOrGisFolderId);
  const gisFolder = contents.find(
    f => f.mimeType === 'application/vnd.google-apps.folder' && f.name.trim().toLowerCase() === 'gis'
  );

  if (!gisFolder) {
    throw new Error('No se encontró una subcarpeta "GIS" dentro del proyecto.');
  }

  return gisFolder.id;
}

// ---------------------------------------------------------------------------
// 7. Motor de Compilación y Procesamiento Geoespacial
// ---------------------------------------------------------------------------

/**
 * Escanea la carpeta GIS e identifica todas las capas disponibles
 */
export async function scanGisFolderStructure(projectRootOrGisId: string) {
  const gisFolderId = await findGisFolderId(projectRootOrGisId);
  const rootContents = await listDriveFolder(gisFolderId);

  const subdirectories = rootContents.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
  const resultCategories: Record<string, { folderId: string; files: DriveItem[] }> = {};

  for (const dir of subdirectories) {
    const normalizedName = dir.name.trim().toLowerCase();
    if (IGNORED_CATEGORIES.has(normalizedName)) continue;
    if (ALLOWED_CATEGORIES.has(normalizedName)) {
      const files = await listDriveFolder(dir.id);
      resultCategories[normalizedName] = { folderId: dir.id, files };
    }
  }

  return { gisFolderId, categories: resultCategories };
}

/**
 * Convierte un grupo de archivos Shapefile en un GeoJSON estandarizado en WGS84
 */
export async function compileShapefileLayer(
  layerBaseName: string,
  shpFileId: string,
  dbfFileId?: string,
  prjFileId?: string
): Promise<{ geojson: any; bbox: [number, number, number, number]; sourceProjection: string }> {
  const shpBuf = await downloadBuffer(shpFileId);
  const dbfBuf = dbfFileId ? await downloadBuffer(dbfFileId) : null;
  const prjText = prjFileId ? (await downloadBuffer(prjFileId)).toString('utf8') : '';

  const proj = detectProjection(prjText);

  // Carga dinámica de shpjs para compatibilidad Node
  // @ts-ignore
  const shpModule: any = await import('shpjs');
  const parseShp = shpModule.parseShp || (shpModule.default && shpModule.default.parseShp);
  const parseDbf = shpModule.parseDbf || (shpModule.default && shpModule.default.parseDbf);
  const combine = shpModule.combine || (shpModule.default && shpModule.default.combine);

  const geometries = parseShp(shpBuf, prjText);
  const attributes = dbfBuf ? parseDbf(dbfBuf) : [];
  const geojson: any = combine([geometries, attributes]);

  // Reproyección a WGS84 (EPSG:4326) con auto-detección de fajas si estaban en metros
  for (const feat of geojson.features || []) {
    if (feat.geometry?.coordinates) {
      feat.geometry.coordinates = reprojectCoordinates(feat.geometry.coordinates, proj);
    }
  }

  const allCoords = (geojson.features || []).map((f: any) => f.geometry?.coordinates);
  const bbox = computeBBox(allCoords);

  return { geojson, bbox, sourceProjection: proj };
}

/**
 * Convierte un archivo KML o KMZ a GeoJSON
 */
export async function compileKmlLayer(fileId: string, fileName: string): Promise<{ geojson: any; bbox: [number, number, number, number] }> {
  const buf = await downloadBuffer(fileId);
  let kmlText = '';

  if (fileName.toLowerCase().endsWith('.kmz')) {
    const zip = await JSZip.loadAsync(buf);
    const kmlEntry = Object.keys(zip.files).find(name => name.toLowerCase().endsWith('.kml'));
    if (kmlEntry) {
      kmlText = await zip.files[kmlEntry].async('text');
    }
  } else {
    kmlText = buf.toString('utf8');
  }

  const doc = new DOMParser().parseFromString(kmlText, 'text/xml');
  const geojson: any = kml(doc);

  const allCoords = (geojson.features || []).map((f: any) => f.geometry?.coordinates);
  const bbox = computeBBox(allCoords);

  return { geojson, bbox };
}

/**
 * Lee un archivo GeoJSON directamente desde Drive
 */
export async function compileJsonLayer(fileId: string): Promise<{ geojson: any; bbox: [number, number, number, number] }> {
  const buf = await downloadBuffer(fileId);
  const geojson = JSON.parse(buf.toString('utf8'));

  const allCoords = (geojson.features || []).map((f: any) => f.geometry?.coordinates);
  const bbox = computeBBox(allCoords);

  return { geojson, bbox };
}

// ---------------------------------------------------------------------------
// 8. Carga a Firebase Storage (Sin límite de tamaño)
// ---------------------------------------------------------------------------

/**
 * Guarda el archivo GeoJSON directamente en Firebase Storage bajo gis/{projectCode}/{layerId}.geojson
 * y retorna la ruta y la URL de consumo (pública o firmada).
 * Nunca guarda el contenido vectorial en Firestore para evitar el límite de 1MB por documento.
 */
export async function uploadGeoJsonToStorage(
  projectCode: string,
  layerId: string,
  geojson: any
): Promise<{ storagePath: string; downloadUrl: string }> {
  const storage = getAdminStorage();
  const storagePath = `gis/${projectCode}/${layerId}.geojson`;
  const relativeFallbackUrl = `/gis_cache/${projectCode}/${layerId}.geojson`;

  if (!storage) {
    console.warn('[GIS Storage] Firebase Storage no disponible. Usando fallback local.');
    return { storagePath, downloadUrl: relativeFallbackUrl };
  }

  try {
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    const content = typeof geojson === 'string' ? geojson : JSON.stringify(geojson);

    await file.save(content, {
      contentType: 'application/geo+json; charset=utf-8',
      resumable: false,
      metadata: {
        cacheControl: 'public, max-age=3600',
      },
    });

    let downloadUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    try {
      await file.makePublic();
    } catch {
      // Si el bucket tiene UBLA habilitado (Uniform Bucket-Level Access),
      // generamos una URL de acceso firmada o fallback
      try {
        const [signedUrl] = await file.getSignedUrl({
          action: 'read',
          expires: '01-01-2035',
        });
        downloadUrl = signedUrl;
      } catch {
        downloadUrl = `/api/gis/layer?projectCode=${projectCode}&layerId=${layerId}`;
      }
    }

    return { storagePath, downloadUrl };
  } catch (err: any) {
    console.error(`[GIS Storage] Error al subir ${layerId} a Firebase Storage:`, err.message);
    return { storagePath, downloadUrl: relativeFallbackUrl };
  }
}

export const STANDARDIZED_PROJECTS: Record<string, { name: string; gisFolderId: string }> = {
  'RSA063': {
    name: 'Saneamiento Loteo Chacra 196 - Gral. La Madrid',
    gisFolderId: '1D5GCJnuhq4rodPSveZbps9vAAMNkaZpd',
  },
  'RSA060': {
    name: 'Restitución terraplén de defensa Carhué',
    gisFolderId: '13s8GT_nVCAFAh6OEHZ-Yz_jH3xrxJixY',
  },
  'RSA062': {
    name: 'Coronel Suárez',
    gisFolderId: '10_nJgUZfeXro-K-fHZeGZXYMzG6tzQ8Y',
  },
  'RSA069': {
    name: 'Entubamiento Canal Llambías - Trenque Lauquen',
    gisFolderId: '1hGeYDRM3KahzS_YWq61W9CD1cE1ipGfn',
  },
  'MAR013': {
    name: 'Prueba CC - Cuenca Matanza-Riachuelo',
    gisFolderId: '1zLNmYe1qlMFzZ99G6Le0RUpQ09lBqV9T',
  },
};

export type GisSyncProgressCallback = (progress: {
  current: number;
  total: number;
  layerName: string;
  percent: number;
}) => void;

// ---------------------------------------------------------------------------
// 9. Sincronización Completa y Persistencia (Storage + Metadatos en Firestore)
// ---------------------------------------------------------------------------
export async function syncProjectGisLayers(
  projectCode: string,
  projectFolderId: string,
  onProgress?: GisSyncProgressCallback
): Promise<GisLayerMetadata[]> {
  console.log(`[GIS Sync] Iniciando sincronización de capas para proyecto: ${projectCode}`);
  const { categories } = await scanGisFolderStructure(projectFolderId);
  const compiledLayers: GisLayerMetadata[] = [];
  const db = getAdminFirestore();

  // Contar capas candidatas para la barra de progreso progresiva
  let totalCandidates = 0;
  if (categories['shp']) {
    const rawGroups: Record<string, boolean> = {};
    for (const f of categories['shp'].files) {
      if (f.name.toLowerCase().endsWith('.shp')) {
        const base = path.basename(f.name, path.extname(f.name));
        rawGroups[base] = true;
      }
    }
    totalCandidates += Object.keys(rawGroups).length;
  }
  const candidateJsonCat = categories['json'] || categories['geojson'];
  if (candidateJsonCat) {
    for (const f of candidateJsonCat.files) {
      const lower = f.name.toLowerCase();
      if (lower.endsWith('.geojson') || lower.endsWith('.json')) totalCandidates++;
    }
  }
  if (categories['kml']) {
    for (const f of categories['kml'].files) {
      const lower = f.name.toLowerCase();
      if (lower.endsWith('.kml') || lower.endsWith('.kmz')) totalCandidates++;
    }
  }
  const totalItems = Math.max(totalCandidates, 1);
  let processedItems = 0;

  // 1. Procesar Shapefiles (/shp)
  if (categories['shp']) {
    const { folderId, files } = categories['shp'];
    // Agrupar archivos por nombre base (ignorando extensiones)
    const groups: Record<string, { shp?: DriveItem; dbf?: DriveItem; prj?: DriveItem }> = {};

    for (const f of files) {
      const lower = f.name.toLowerCase();
      // Ignorar bloqueos y auxiliares
      if (lower.endsWith('.lock') || lower.endsWith('.tmp') || lower.endsWith('.xml') || lower.endsWith('.sbn') || lower.endsWith('.sbx')) {
        continue;
      }
      const ext = path.extname(f.name).toLowerCase();
      const base = path.basename(f.name, path.extname(f.name));

      if (!groups[base]) groups[base] = {};
      if (ext === '.shp') groups[base].shp = f;
      if (ext === '.dbf') groups[base].dbf = f;
      if (ext === '.prj') groups[base].prj = f;
    }

    for (const [baseName, group] of Object.entries(groups)) {
      if (!group.shp) continue; // Requiere .shp
      try {
        console.log(`[GIS Sync] Compilando Shapefile: ${baseName}...`);
        const { geojson, bbox, sourceProjection } = await compileShapefileLayer(
          baseName,
          group.shp.id,
          group.dbf?.id,
          group.prj?.id
        );

        const layerId = baseName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

        // A. Subir GeoJSON a Firebase Storage (Sin límite de tamaño)
        const { storagePath, downloadUrl } = await uploadGeoJsonToStorage(projectCode, layerId, geojson);

        // B. Réplica en disco local para desarrollo
        const cacheDir = path.resolve(process.cwd(), 'public', 'gis_cache', projectCode);
        if (!fs.existsSync(cacheDir)) {
          fs.mkdirSync(cacheDir, { recursive: true });
        }
        const geoJsonPath = path.join(cacheDir, `${layerId}.geojson`);
        fs.writeFileSync(geoJsonPath, JSON.stringify(geojson), 'utf8');

        const layerMeta: GisLayerMetadata = {
          id: layerId,
          name: baseName,
          title: baseName.replace(/_/g, ' '),
          category: 'shp',
          geometryType: geojson.features?.[0]?.geometry?.type || 'Geometry',
          featureCount: geojson.features?.length || 0,
          bbox,
          sourceProjection,
          driveFolderId: folderId,
          lastModifiedDrive: group.shp.modifiedTime || undefined,
          lastSync: new Date().toISOString(),
          storagePath,
          downloadUrl,
          hasCachedData: true,
        };

        // C. Guardar exclusivamente metadatos en Firestore (NUNCA el GeoJSON pesado)
        if (db) {
          const docRef = db.collection('projects_gis').doc(projectCode).collection('layers').doc(layerMeta.id);
          await docRef.set(layerMeta);
        }

        compiledLayers.push(layerMeta);
        processedItems++;
        if (onProgress) {
          onProgress({
            current: processedItems,
            total: totalItems,
            layerName: `${baseName}.shp`,
            percent: Math.round((processedItems / totalItems) * 100),
          });
        }
      } catch (err: any) {
        console.error(`[GIS Sync] Error compilando ${baseName}:`, err.message);
      }
    }
  }

  // 2. Procesar GeoJSON (/json o /geojson)
  const jsonCat = categories['json'] || categories['geojson'];
  if (jsonCat) {
    const { folderId, files } = jsonCat;
    for (const f of files) {
      if (!f.name.toLowerCase().endsWith('.geojson') && !f.name.toLowerCase().endsWith('.json')) continue;
      const baseName = path.basename(f.name, path.extname(f.name));
      try {
        console.log(`[GIS Sync] Compilando GeoJSON: ${f.name}...`);
        const { geojson, bbox } = await compileJsonLayer(f.id);
        const layerId = baseName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

        // A. Subir GeoJSON a Firebase Storage
        const { storagePath, downloadUrl } = await uploadGeoJsonToStorage(projectCode, layerId, geojson);

        // B. Réplica en disco local
        const cacheDir = path.resolve(process.cwd(), 'public', 'gis_cache', projectCode);
        if (!fs.existsSync(cacheDir)) {
          fs.mkdirSync(cacheDir, { recursive: true });
        }
        const geoJsonPath = path.join(cacheDir, `${layerId}.geojson`);
        fs.writeFileSync(geoJsonPath, JSON.stringify(geojson), 'utf8');

        const layerMeta: GisLayerMetadata = {
          id: layerId,
          name: baseName,
          title: baseName.replace(/_/g, ' '),
          category: 'json',
          geometryType: geojson.features?.[0]?.geometry?.type || 'Geometry',
          featureCount: geojson.features?.length || 0,
          bbox,
          sourceProjection: 'EPSG:4326',
          driveFolderId: folderId,
          lastModifiedDrive: f.modifiedTime || undefined,
          lastSync: new Date().toISOString(),
          storagePath,
          downloadUrl,
          hasCachedData: true,
        };

        // C. Guardar únicamente metadatos en Firestore
        if (db) {
          const docRef = db.collection('projects_gis').doc(projectCode).collection('layers').doc(layerMeta.id);
          await docRef.set(layerMeta);
        }

        compiledLayers.push(layerMeta);
        processedItems++;
        if (onProgress) {
          onProgress({
            current: processedItems,
            total: totalItems,
            layerName: f.name,
            percent: Math.round((processedItems / totalItems) * 100),
          });
        }
      } catch (err: any) {
        console.error(`[GIS Sync] Error procesando JSON ${f.name}:`, err.message);
      }
    }
  }

  // 3. Procesar KML / KMZ (/kml)
  if (categories['kml']) {
    const { folderId, files } = categories['kml'];
    for (const f of files) {
      const lower = f.name.toLowerCase();
      if (!lower.endsWith('.kml') && !lower.endsWith('.kmz')) continue;
      const baseName = path.basename(f.name, path.extname(f.name));
      try {
        console.log(`[GIS Sync] Compilando KML: ${f.name}...`);
        const { geojson, bbox } = await compileKmlLayer(f.id, f.name);
        const layerId = baseName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

        // A. Subir GeoJSON a Firebase Storage
        const { storagePath, downloadUrl } = await uploadGeoJsonToStorage(projectCode, layerId, geojson);

        // B. Réplica en disco local
        const cacheDir = path.resolve(process.cwd(), 'public', 'gis_cache', projectCode);
        if (!fs.existsSync(cacheDir)) {
          fs.mkdirSync(cacheDir, { recursive: true });
        }
        const geoJsonPath = path.join(cacheDir, `${layerId}.geojson`);
        fs.writeFileSync(geoJsonPath, JSON.stringify(geojson), 'utf8');

        const layerMeta: GisLayerMetadata = {
          id: layerId,
          name: baseName,
          title: baseName.replace(/_/g, ' '),
          category: 'kml',
          geometryType: geojson.features?.[0]?.geometry?.type || 'Geometry',
          featureCount: geojson.features?.length || 0,
          bbox,
          sourceProjection: 'EPSG:4326',
          driveFolderId: folderId,
          lastModifiedDrive: f.modifiedTime || undefined,
          lastSync: new Date().toISOString(),
          storagePath,
          downloadUrl,
          hasCachedData: true,
        };

        // C. Guardar únicamente metadatos en Firestore
        if (db) {
          const docRef = db.collection('projects_gis').doc(projectCode).collection('layers').doc(layerMeta.id);
          await docRef.set(layerMeta);
        }

        compiledLayers.push(layerMeta);
        processedItems++;
        if (onProgress) {
          onProgress({
            current: processedItems,
            total: totalItems,
            layerName: f.name,
            percent: Math.round((processedItems / totalItems) * 100),
          });
        }
      } catch (err: any) {
        console.error(`[GIS Sync] Error procesando KML ${f.name}:`, err.message);
      }
    }
  }

  // Actualizar metadatos de sincronización a nivel proyecto raíz
  if (db) {
    await db.collection('projects_gis').doc(projectCode).set({
      projectCode,
      gisFolderId: projectFolderId,
      lastSync: new Date().toISOString(),
      layerCount: compiledLayers.length,
    }, { merge: true });
  }

  console.log(`[GIS Sync] Sincronización completada. Total de capas: ${compiledLayers.length}`);
  return compiledLayers;
}

/**
 * Verifica si la carpeta GIS de un proyecto en Google Drive tuvo modificaciones
 * comparando con la fecha de lastSync en Firestore.
 */
export async function checkProjectHasUpdates(projectCode: string): Promise<{
  projectCode: string;
  hasUpdates: boolean;
  driveModifiedTime?: string;
  lastSync?: string;
  gisFolderId?: string;
  reason?: string;
}> {
  const pCode = projectCode.toUpperCase();
  const db = getAdminFirestore();

  let gisFolderId: string | null = null;
  let lastSync: string | null = null;

  if (db) {
    const projDoc = await db.collection('projects_gis').doc(pCode).get();
    if (projDoc.exists) {
      const data = projDoc.data();
      gisFolderId = data?.gisFolderId || null;
      lastSync = data?.lastSync || null;
    }

    if (!lastSync || !gisFolderId) {
      const layersSnap = await db.collection('projects_gis').doc(pCode).collection('layers').limit(5).get();
      if (!layersSnap.empty) {
        const firstLayer = layersSnap.docs[0].data();
        if (!gisFolderId) gisFolderId = firstLayer.driveFolderId || null;
        if (!lastSync) lastSync = firstLayer.lastSync || null;
      }
    }
  }

  if (!gisFolderId && STANDARDIZED_PROJECTS[pCode]) {
    gisFolderId = STANDARDIZED_PROJECTS[pCode].gisFolderId;
  }

  if (!gisFolderId) {
    return { projectCode: pCode, hasUpdates: false, reason: 'No se encontró carpeta GIS en Drive' };
  }

  try {
    const drive = getDriveClient();
    const folderRes = await drive.files.get({
      fileId: gisFolderId,
      fields: 'id, name, modifiedTime',
      supportsAllDrives: true,
    });

    const driveModifiedTime = folderRes.data.modifiedTime || null;

    if (!lastSync) {
      return { projectCode: pCode, hasUpdates: true, driveModifiedTime: driveModifiedTime || undefined, gisFolderId };
    }

    if (driveModifiedTime && new Date(driveModifiedTime) > new Date(lastSync)) {
      return { projectCode: pCode, hasUpdates: true, driveModifiedTime, lastSync, gisFolderId };
    }

    // Verificar si algún archivo hijo se modificó después del último sync
    const query = `'${gisFolderId}' in parents and trashed = false and modifiedTime > '${lastSync}'`;
    const listRes = await drive.files.list({
      q: query,
      pageSize: 1,
      fields: 'files(id, name, modifiedTime)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (listRes.data.files && listRes.data.files.length > 0) {
      return {
        projectCode: pCode,
        hasUpdates: true,
        driveModifiedTime: listRes.data.files[0].modifiedTime || undefined,
        lastSync,
        gisFolderId,
      };
    }

    return { projectCode: pCode, hasUpdates: false, driveModifiedTime: driveModifiedTime || undefined, lastSync, gisFolderId };
  } catch (err: any) {
    console.error(`[GIS Check Update] Error verificando Drive para ${pCode}:`, err.message);
    return { projectCode: pCode, hasUpdates: false, reason: err.message };
  }
}

/**
 * Obtiene el GeoJSON compilado de una capa específica (desde disco local o Firebase Storage)
 */
export async function getLayerGeoJson(projectCode: string, layerId: string): Promise<any | null> {
  // 1. Intentar desde disco local (desarrollo local)
  const diskPath = path.resolve(process.cwd(), 'public', 'gis_cache', projectCode, `${layerId}.geojson`);
  if (fs.existsSync(diskPath)) {
    try {
      return JSON.parse(fs.readFileSync(diskPath, 'utf8'));
    } catch (e: any) {
      console.warn(`[GIS] Error leyendo de disco local ${diskPath}:`, e.message);
    }
  }

  // 2. Intentar desde Firebase Storage (en la nube)
  const storage = getAdminStorage();
  if (storage) {
    try {
      const bucket = storage.bucket();
      const file = bucket.file(`gis/${projectCode}/${layerId}.geojson`);
      const [exists] = await file.exists();
      if (exists) {
        const [buf] = await file.download();
        return JSON.parse(buf.toString('utf8'));
      }
    } catch (e: any) {
      console.error('[GIS] Error leyendo de Firebase Storage:', e.message);
    }
  }

  return null;
}
