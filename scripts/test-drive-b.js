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

const rsaFolderId = '1kLDUItmcVXG92tg9oXr47sZhKmaQ16It'; // RSA - CUENCA RÍO SALADO

async function scanRsaDriveB() {
  try {
    console.log('Escaneando Cuenca RSA en Drive B (ID: ' + rsaFolderId + ')...');
    const projRes = await drive.files.list({
      q: `'${rsaFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 200,
      orderBy: 'name',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const projs = projRes.data.files || [];
    console.log(`\n=== Total de proyectos encontrados en RSA: ${projs.length} ===`);

    const projectsWithGis = [];
    const projectsWithoutGis = [];

    for (const p of projs) {
      const subRes = await drive.files.list({
        q: `'${p.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 50,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      const subFolders = subRes.data.files || [];
      const gisFolder = subFolders.find(sf => sf.name.trim().toLowerCase() === 'gis');
      if (gisFolder) {
        // Inspeccionar qué subcarpetas hay dentro de /GIS
        const gisContentRes = await drive.files.list({
          q: `'${gisFolder.id}' in parents and trashed = false`,
          fields: 'files(id, name, mimeType, size)',
          pageSize: 100,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });
        const gisItems = gisContentRes.data.files || [];
        const categories = gisItems
          .filter(f => f.mimeType === 'application/vnd.google-apps.folder')
          .map(f => f.name.toLowerCase());

        projectsWithGis.push({
          id: p.id,
          name: p.name,
          gisFolderId: gisFolder.id,
          categories,
        });
        console.log(` [GIS DETECTADO] ${p.name} -> subcarpetas: [${categories.join(', ')}]`);
      } else {
        projectsWithoutGis.push(p.name);
      }
    }

    console.log(`\n==============================================`);
    console.log(`RESUMEN RSA (DRIVE B):`);
    console.log(`- Proyectos con /GIS: ${projectsWithGis.length}`);
    console.log(`- Proyectos sin /GIS: ${projectsWithoutGis.length}`);
    console.log(`==============================================`);

    fs.writeFileSync(
      path.resolve(__dirname, 'inventario_rsa_drive_b.json'),
      JSON.stringify({ rsaFolderId, projectsWithGis, total: projs.length }, null, 2),
      'utf8'
    );
    console.log('Guardado en scripts/inventario_rsa_drive_b.json');
  } catch (err) {
    console.error('Error al escanear RSA:', err.message);
  }
}

scanRsaDriveB();
