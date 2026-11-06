const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

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

const TARGET_FOLDERS = [
  { name: 'consultoria_humedales', id: '1Fieu0aPYAkcgPihwJSSDy7ZsUzJ1Unpr' },
  { name: 'RSA_quimica', id: '1dBZsEv__wmKNSF0J6MfqW_Jldlug4qvb' }
];

const GIS_EXTENSIONS = new Set([
  '.shp', '.shx', '.dbf', '.prj', '.cpg', '.sbn', '.sbx', '.xml',
  '.tif', '.tiff', '.tfw', '.ovr', '.dem',
  '.geojson', '.kml', '.kmz', '.gpkg', '.qgz', '.qgs', '.mxd', '.dwg', '.dxf'
]);

const DOC_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf', '.odt', '.ods'
]);

const MEDIA_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.svg', '.mp4', '.avi', '.mov', '.zip', '.rar', '.7z'
]);

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function listAllInFolder(folderId, currentPath = '') {
  let items = [];
  let pageToken = null;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime)',
      pageSize: 1000,
      pageToken: pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const files = res.data.files || [];
    pageToken = res.data.nextPageToken;

    for (const f of files) {
      const itemPath = currentPath ? `${currentPath}/${f.name}` : f.name;
      if (f.mimeType === 'application/vnd.google-apps.folder') {
        const subItems = await listAllInFolder(f.id, itemPath);
        items = items.concat(subItems);
      } else {
        const sizeNum = parseInt(f.size || '0', 10);
        const ext = path.extname(f.name).toLowerCase();
        items.push({
          id: f.id,
          name: f.name,
          path: itemPath,
          mimeType: f.mimeType,
          size: sizeNum,
          ext: ext
        });
      }
    }
  } while (pageToken);

  return items;
}

async function run() {
  console.log('Iniciando cálculo de peso de carpetas en Google Drive...\n');

  let grandTotalBytes = 0;
  let allFiles = [];
  const folderReports = [];

  for (const target of TARGET_FOLDERS) {
    console.log(`Explorando "${target.name}" (${target.id})...`);
    const files = await listAllInFolder(target.id, target.name);
    const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
    grandTotalBytes += totalBytes;
    allFiles = allFiles.concat(files);

    folderReports.push({
      folder: target.name,
      fileCount: files.length,
      bytes: totalBytes,
      formattedSize: formatBytes(totalBytes)
    });
    console.log(`  -> ${files.length} archivos, ${formatBytes(totalBytes)}`);
  }

  // Agrupamiento por categoría y extensión
  let gisBytes = 0;
  let gisCount = 0;
  let docBytes = 0;
  let docCount = 0;
  let mediaBytes = 0;
  let mediaCount = 0;
  let otherBytes = 0;
  let otherCount = 0;

  const extStats = {};

  for (const f of allFiles) {
    const ext = f.ext || '(sin extensión)';
    if (!extStats[ext]) {
      extStats[ext] = { count: 0, bytes: 0 };
    }
    extStats[ext].count += 1;
    extStats[ext].bytes += f.size;

    if (GIS_EXTENSIONS.has(ext)) {
      gisBytes += f.size;
      gisCount += 1;
    } else if (DOC_EXTENSIONS.has(ext)) {
      docBytes += f.size;
      docCount += 1;
    } else if (MEDIA_EXTENSIONS.has(ext)) {
      mediaBytes += f.size;
      mediaCount += 1;
    } else {
      otherBytes += f.size;
      otherCount += 1;
    }
  }

  allFiles.sort((a, b) => b.size - a.size);
  const top10 = allFiles.slice(0, 10);

  const report = {
    summary: {
      totalFiles: allFiles.length,
      grandTotalBytes: grandTotalBytes,
      grandTotalFormatted: formatBytes(grandTotalBytes)
    },
    byFolder: folderReports,
    byCategory: {
      gis: { count: gisCount, bytes: gisBytes, formatted: formatBytes(gisBytes) },
      documental: { count: docCount, bytes: docBytes, formatted: formatBytes(docBytes) },
      mediaOrCompressed: { count: mediaCount, bytes: mediaBytes, formatted: formatBytes(mediaBytes) },
      other: { count: otherCount, bytes: otherBytes, formatted: formatBytes(otherBytes) }
    },
    topExtensions: Object.entries(extStats)
      .sort((a, b) => b[1].bytes - a[1].bytes)
      .map(([ext, s]) => ({ ext, count: s.count, size: formatBytes(s.bytes), bytes: s.bytes })),
    top10LargestFiles: top10.map(f => ({
      name: f.name,
      path: f.path,
      size: formatBytes(f.size),
      bytes: f.size
    }))
  };

  console.log('\n=== RESULTADO COMPLETO ===');
  console.log(JSON.stringify(report, null, 2));

  fs.writeFileSync(path.resolve(__dirname, 'consultoria_weight_report.json'), JSON.stringify(report, null, 2));
}

run().catch(err => {
  console.error('Error calculando pesos:', err);
  process.exit(1);
});

