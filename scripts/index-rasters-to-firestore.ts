import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { getAdminFirestore } from '../src/firebase/admin';

// Cargar .env de portal_dea
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      process.env[key] = val;
    }
  });
}

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth: oauth2Client });

async function callDriveWithRetry(fn: () => Promise<any>, retries = 5, delay = 1000): Promise<any> {
  try {
    return await fn();
  } catch (err: any) {
    if (retries <= 0) throw err;
    if (err.code === 429 || err.code === 403 || err.code === 500 || err.code === 503) {
      await new Promise(r => setTimeout(r, delay));
      return callDriveWithRetry(fn, retries - 1, delay * 2);
    }
    throw err;
  }
}

async function listFolderRecursively(folderId: string): Promise<any[]> {
  let allFiles: any[] = [];
  let pageToken: string | null = null;

  do {
    const res = await callDriveWithRetry(() =>
      drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime)',
        pageSize: 1000,
        pageToken: pageToken || undefined,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      })
    );

    const items = res.data.files || [];
    for (const item of items) {
      if (item.mimeType === 'application/vnd.google-apps.folder') {
        const subFiles = await listFolderRecursively(item.id!);
        allFiles.push(...subFiles);
      } else {
        const lower = (item.name || '').toLowerCase();
        // Ignorar temporales y locks
        if (!lower.endsWith('.lock') && !lower.endsWith('.tmp') && !lower.endsWith('.xml')) {
          allFiles.push({
            id: item.id!,
            name: item.name!,
            size: item.size ? parseInt(item.size, 10) : 0,
            modifiedTime: item.modifiedTime || undefined,
          });
        }
      }
    }
    pageToken = res.data.nextPageToken || null;
  } while (pageToken);

  return allFiles;
}

async function indexAllRasters() {
  console.log('================================================================');
  console.log('INDEXADOR DE RÁSTERES (img y dem) A FIRESTORE (0 MB STORAGE)');
  console.log('================================================================\n');

  const db = getAdminFirestore();
  if (!db) {
    throw new Error('No se pudo conectar con Firestore.');
  }

  const cuencasStatusPath = path.resolve(__dirname, 'cuencas_status.json');
  if (!fs.existsSync(cuencasStatusPath)) {
    throw new Error('No se encontró cuencas_status.json');
  }

  const cuencas: any[] = JSON.parse(fs.readFileSync(cuencasStatusPath, 'utf8'));
  const activeCuencas = cuencas.filter(c => c.projectCount > 0);

  let totalRastersIndexed = 0;
  let totalProjectsWithRasters = 0;

  for (const cuenca of activeCuencas) {
    console.log(`\n-> Procesando cuenca [${cuenca.code}] ${cuenca.name}...`);

    const projRes = await callDriveWithRetry(() =>
      drive.files.list({
        q: `'${cuenca.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 200,
        orderBy: 'name',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      })
    );

    const projects: any[] = projRes.data.files || [];

    for (const proj of projects) {
      // Extraer código de proyecto (ej: RSA013 de 'RSA013 - General Villegas')
      const codeMatch = (proj.name || '').match(/^([a-zA-Z]{2,4}\d{3})/i);
      const projectCode = codeMatch ? codeMatch[1].toUpperCase() : null;
      if (!projectCode) continue;

      // Buscar subcarpeta GIS
      const subRes = await callDriveWithRetry(() =>
        drive.files.list({
          q: `'${proj.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name)',
          pageSize: 50,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        })
      );

      const subFolders: any[] = subRes.data.files || [];
      const gisFolder = subFolders.find(sf => (sf.name || '').trim().toLowerCase() === 'gis');
      if (!gisFolder) continue;

      // Buscar carpetas img y dem dentro de GIS
      const gisCatsRes = await callDriveWithRetry(() =>
        drive.files.list({
          q: `'${gisFolder.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name)',
          pageSize: 50,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        })
      );

      const cats: any[] = gisCatsRes.data.files || [];
      const imgFolder = cats.find(c => {
        const n = (c.name || '').trim().toLowerCase();
        return n === 'img' || n === 'raster' || n === 'ortofoto' || n === 'ortofotos';
      });
      const demFolder = cats.find(c => {
        const n = (c.name || '').trim().toLowerCase();
        return n === 'dem' || n === 'mde';
      });

      if (!imgFolder && !demFolder) continue;

      // Obtener bbox de referencia a partir de las capas vectoriales del proyecto
      const existingLayersSnap = await db.collection('projects_gis').doc(projectCode).collection('layers').get();
      let projectBbox: [number, number, number, number] = [-63.5, -41.0, -56.5, -33.0]; // PBA default

      if (!existingLayersSnap.empty) {
        let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
        existingLayersSnap.docs.forEach(doc => {
          const lData = doc.data();
          if (lData.bbox && Array.isArray(lData.bbox) && lData.bbox.length === 4) {
            const [bMinLon, bMinLat, bMaxLon, bMaxLat] = lData.bbox;
            if (Number.isFinite(bMinLon) && bMinLon < minLon) minLon = bMinLon;
            if (Number.isFinite(bMinLat) && bMinLat < minLat) minLat = bMinLat;
            if (Number.isFinite(bMaxLon) && bMaxLon > maxLon) maxLon = bMaxLon;
            if (Number.isFinite(bMaxLat) && bMaxLat > maxLat) maxLat = bMaxLat;
          }
        });

        if (minLon !== Infinity && minLat !== Infinity) {
          projectBbox = [minLon, minLat, maxLon, maxLat];
        }
      }

      let projRastersCount = 0;

      // Indexar carpeta 'img'
      if (imgFolder) {
        const imgFiles = await listFolderRecursively(imgFolder.id);
        for (const file of imgFiles) {
          const cleanName = path.basename(file.name, path.extname(file.name)).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
          const layerId = `img_${cleanName}`;
          const downloadUrl = `https://drive.google.com/uc?export=download&id=${file.id}`;

          const layerMeta = {
            id: layerId,
            name: file.name,
            title: file.name,
            category: 'img',
            geometryType: 'Raster',
            featureCount: 1,
            bbox: projectBbox,
            sourceProjection: 'EPSG:4326',
            driveFolderId: imgFolder.id,
            driveFileId: file.id,
            downloadUrl,
            sizeBytes: file.size,
            isDownloadOnly: true,
            hasCachedData: false,
            lastModifiedDrive: file.modifiedTime || new Date().toISOString(),
            lastSync: new Date().toISOString(),
            projectCode,
          };

          await db.collection('projects_gis').doc(projectCode).collection('layers').doc(layerId).set(layerMeta);
          projRastersCount++;
          totalRastersIndexed++;
        }
      }

      // Indexar carpeta 'dem'
      if (demFolder) {
        const demFiles = await listFolderRecursively(demFolder.id);
        for (const file of demFiles) {
          const cleanName = path.basename(file.name, path.extname(file.name)).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
          const layerId = `dem_${cleanName}`;
          const downloadUrl = `https://drive.google.com/uc?export=download&id=${file.id}`;

          const layerMeta = {
            id: layerId,
            name: file.name,
            title: file.name,
            category: 'dem',
            geometryType: 'Raster',
            featureCount: 1,
            bbox: projectBbox,
            sourceProjection: 'EPSG:4326',
            driveFolderId: demFolder.id,
            driveFileId: file.id,
            downloadUrl,
            sizeBytes: file.size,
            isDownloadOnly: true,
            hasCachedData: false,
            lastModifiedDrive: file.modifiedTime || new Date().toISOString(),
            lastSync: new Date().toISOString(),
            projectCode,
          };

          await db.collection('projects_gis').doc(projectCode).collection('layers').doc(layerId).set(layerMeta);
          projRastersCount++;
          totalRastersIndexed++;
        }
      }

      if (projRastersCount > 0) {
        totalProjectsWithRasters++;
        console.log(`   [OK] ${projectCode} (${proj.name}): ${projRastersCount} rásteres indexados en Firestore.`);
      }
    }
  }

  console.log('\n================================================================');
  console.log('INDEXACIÓN COMPLETADA EXITOSAMENTE');
  console.log(`Proyectos con rásteres: ${totalProjectsWithRasters}`);
  console.log(`Total rásteres registrados en Firestore: ${totalRastersIndexed}`);
  console.log('Almacenamiento en Firebase Storage consumido: 0 MB');
  console.log('================================================================');
}

indexAllRasters().catch(console.error);
