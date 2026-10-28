const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// 1. Cargar .env de portal_dea
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

// Helper para reintentos con backoff exponencial
async function callDriveWithRetry(fn, retries = 5, delay = 1000) {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    if (err.code === 429 || err.code === 403 || err.code === 500 || err.code === 503) {
      await new Promise(r => setTimeout(r, delay));
      return callDriveWithRetry(fn, retries - 1, delay * 2);
    }
    throw err;
  }
}

// Listar archivos de una carpeta recursivamente
async function listFolderRecursively(folderId) {
  let allFiles = [];
  let pageToken = null;

  do {
    const res = await callDriveWithRetry(() =>
      drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, size)',
        pageSize: 1000,
        pageToken: pageToken || undefined,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      })
    );

    const items = res.data.files || [];
    for (const item of items) {
      if (item.mimeType === 'application/vnd.google-apps.folder') {
        const subFiles = await listFolderRecursively(item.id);
        allFiles.push(...subFiles);
      } else {
        allFiles.push({
          id: item.id,
          name: item.name,
          size: item.size ? parseInt(item.size, 10) : 0,
        });
      }
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return allFiles;
}

async function runRasterCalculation() {
  console.log('================================================================');
  console.log('CALCULADORA DE PESO DE RÁSTERES (img y dem) - DRIVE SECUNDARIO');
  console.log('================================================================\n');

  const cuencasStatusPath = path.resolve(__dirname, 'cuencas_status.json');
  if (!fs.existsSync(cuencasStatusPath)) {
    console.error('No se encontró cuencas_status.json');
    return;
  }

  const cuencas = JSON.parse(fs.readFileSync(cuencasStatusPath, 'utf8'));
  const activeCuencas = cuencas.filter(c => c.projectCount > 0);

  console.log(`Se analizarán ${activeCuencas.length} cuencas con proyectos en el Drive...\n`);

  const report = {
    generatedAt: new Date().toISOString(),
    totalCuencas: activeCuencas.length,
    globalSummary: {
      totalImgFiles: 0,
      totalImgBytes: 0,
      totalDemFiles: 0,
      totalDemBytes: 0,
      totalRasterFiles: 0,
      totalRasterBytes: 0,
      totalRasterMB: 0,
      totalRasterGB: 0,
    },
    cuencas: [],
  };

  for (const cuenca of activeCuencas) {
    console.log(`-> Escaneando cuenca [${cuenca.code}] ${cuenca.name}...`);

    // Listar proyectos de la cuenca
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

    const projects = projRes.data.files || [];
    const cuencaData = {
      code: cuenca.code,
      name: cuenca.name,
      id: cuenca.id,
      projectsAnalyzed: projects.length,
      imgFiles: 0,
      imgBytes: 0,
      demFiles: 0,
      demBytes: 0,
      totalFiles: 0,
      totalBytes: 0,
      projects: [],
    };

    for (const proj of projects) {
      // Buscar subcarpetas del proyecto para hallar 'GIS'
      const subRes = await callDriveWithRetry(() =>
        drive.files.list({
          q: `'${proj.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name)',
          pageSize: 50,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        })
      );

      const subFolders = subRes.data.files || [];
      const gisFolder = subFolders.find(sf => sf.name.trim().toLowerCase() === 'gis');

      // Si no hay carpeta GIS, buscamos img/dem en la raíz del proyecto; si hay GIS, buscamos dentro de GIS
      const searchTargetFolderId = gisFolder ? gisFolder.id : proj.id;

      const gisCatsRes = await callDriveWithRetry(() =>
        drive.files.list({
          q: `'${searchTargetFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name)',
          pageSize: 50,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        })
      );

      const cats = gisCatsRes.data.files || [];
      const imgFolder = cats.find(c => {
        const n = c.name.trim().toLowerCase();
        return n === 'img' || n === 'raster' || n === 'ortofoto' || n === 'ortofotos';
      });
      const demFolder = cats.find(c => {
        const n = c.name.trim().toLowerCase();
        return n === 'dem' || n === 'mde';
      });

      let projImgFiles = [];
      let projDemFiles = [];

      if (imgFolder) {
        projImgFiles = await listFolderRecursively(imgFolder.id);
      }
      if (demFolder) {
        projDemFiles = await listFolderRecursively(demFolder.id);
      }

      const imgBytes = projImgFiles.reduce((acc, f) => acc + f.size, 0);
      const demBytes = projDemFiles.reduce((acc, f) => acc + f.size, 0);
      const projTotalFiles = projImgFiles.length + projDemFiles.length;
      const projTotalBytes = imgBytes + demBytes;

      if (projTotalFiles > 0) {
        cuencaData.imgFiles += projImgFiles.length;
        cuencaData.imgBytes += imgBytes;
        cuencaData.demFiles += projDemFiles.length;
        cuencaData.demBytes += demBytes;
        cuencaData.totalFiles += projTotalFiles;
        cuencaData.totalBytes += projTotalBytes;

        cuencaData.projects.push({
          name: proj.name,
          hasGisFolder: Boolean(gisFolder),
          imgFilesCount: projImgFiles.length,
          imgSizeMB: (imgBytes / (1024 * 1024)).toFixed(2),
          demFilesCount: projDemFiles.length,
          demSizeMB: (demBytes / (1024 * 1024)).toFixed(2),
          totalFilesCount: projTotalFiles,
          totalSizeMB: (projTotalBytes / (1024 * 1024)).toFixed(2),
        });

        console.log(`   [+] ${proj.name}: ${projTotalFiles} rásteres (${(projTotalBytes / (1024 * 1024)).toFixed(1)} MB) [img: ${projImgFiles.length}, dem: ${projDemFiles.length}]`);
      }
    }

    report.globalSummary.totalImgFiles += cuencaData.imgFiles;
    report.globalSummary.totalImgBytes += cuencaData.imgBytes;
    report.globalSummary.totalDemFiles += cuencaData.demFiles;
    report.globalSummary.totalDemBytes += cuencaData.demBytes;
    report.globalSummary.totalRasterFiles += cuencaData.totalFiles;
    report.globalSummary.totalRasterBytes += cuencaData.totalBytes;

    report.cuencas.push(cuencaData);
    console.log(`   => Subtotal Cuenca ${cuenca.code}: ${cuencaData.totalFiles} rásteres, ${(cuencaData.totalBytes / (1024 * 1024)).toFixed(2)} MB\n`);
  }

  report.globalSummary.totalRasterMB = (report.globalSummary.totalRasterBytes / (1024 * 1024)).toFixed(2);
  report.globalSummary.totalRasterGB = (report.globalSummary.totalRasterBytes / (1024 * 1024 * 1024)).toFixed(2);

  const reportPath = path.resolve(__dirname, 'raster_sizes_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('================================================================');
  console.log('RESUMEN GLOBAL DE RÁSTERES EN EL DRIVE SECUNDARIO');
  console.log('================================================================');
  console.log(`Total archivos en 'img':     ${report.globalSummary.totalImgFiles} archivos (${(report.globalSummary.totalImgBytes / (1024 * 1024 * 1024)).toFixed(2)} GB)`);
  console.log(`Total archivos en 'dem':     ${report.globalSummary.totalDemFiles} archivos (${(report.globalSummary.totalDemBytes / (1024 * 1024 * 1024)).toFixed(2)} GB)`);
  console.log(`----------------------------------------------------------------`);
  console.log(`TOTAL RÁSTERES:              ${report.globalSummary.totalRasterFiles} archivos`);
  console.log(`PESO TOTAL:                  ${report.globalSummary.totalRasterMB} MB  (~${report.globalSummary.totalRasterGB} GB)`);
  console.log('================================================================');
  console.log(`Reporte detallado guardado en: ${reportPath}`);
}

runRasterCalculation().catch(console.error);
