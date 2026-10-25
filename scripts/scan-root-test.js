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

const rootFolderId = '1H0f7lTJFCVMD1jiIkcOqxI1L2HC14weD';

async function scanRoot() {
  console.log('Consultando carpeta madre EIAS AMBIENTALES:', rootFolderId);
  const res = await drive.files.list({
    q: `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name, modifiedTime)',
    pageSize: 100,
    orderBy: 'name',
  });
  const folders = res.data.files || [];
  console.log(`\n=== TOTAL DE CARPETAS DE CUENCAS: ${folders.length} ===`);
  folders.forEach((f, idx) => {
    console.log(`${idx + 1}. [${f.id}] ${f.name}`);
  });

  // Tomar de muestra RSA (Cuenca Río Salado)
  const rsa = folders.find(f => f.name.toUpperCase().startsWith('RSA'));
  if (rsa) {
    console.log(`\n--- MUESTRA: Escaneando proyectos dentro de "${rsa.name}" ---`);
    const projRes = await drive.files.list({
      q: `'${rsa.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 50,
      orderBy: 'name',
    });
    const projects = projRes.data.files || [];
    console.log(`Total proyectos en RSA: ${projects.length}`);

    for (const p of projects.slice(0, 15)) {
      const subRes = await drive.files.list({
        q: `'${p.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
      });
      const subFolders = subRes.data.files || [];
      const gisFolder = subFolders.find(sf => sf.name.trim().toLowerCase() === 'gis');
      console.log(` * ${p.name.padEnd(25)} -> ¿Tiene /GIS?: ${gisFolder ? 'SI (id: ' + gisFolder.id + ')' : 'NO'}`);
    }
  }
}

scanRoot().catch(e => console.error('Error escaneando root:', e));
