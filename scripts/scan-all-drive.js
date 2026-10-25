const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const envPath = path.resolve(__dirname, '..', '.env');
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

const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth: oauth2Client });

const rootFolderId = '1H0f7lTJFCVMD1jiIkcOqxI1L2HC14weD';

async function scanAllDrive() {
  console.log('Iniciando inventario completo de EIAS AMBIENTALES...');
  const res = await drive.files.list({
    q: `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 100,
    orderBy: 'name',
  });
  const basins = res.data.files || [];
  console.log(`\nEncontradas ${basins.length} cuencas principales.\n`);

  const summary = {
    totalBasins: basins.length,
    standardizedProjects: [],
    skippedProjects: [],
  };

  for (const b of basins) {
    process.stdout.write(`Escaneando [${b.name}]... `);
    const pRes = await drive.files.list({
      q: `'${b.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 100,
      orderBy: 'name',
    });
    const projects = pRes.data.files || [];
    let stdCount = 0;

    for (const p of projects) {
      const sfRes = await drive.files.list({
        q: `'${p.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 50,
      });
      const subFolders = sfRes.data.files || [];
      const gisFolder = subFolders.find(sf => sf.name.trim().toLowerCase() === 'gis');

      if (gisFolder) {
        stdCount++;
        summary.standardizedProjects.push({
          basinName: b.name,
          projectName: p.name,
          projectId: p.id,
          gisFolderId: gisFolder.id,
        });
      } else {
        summary.skippedProjects.push({
          basinName: b.name,
          projectName: p.name,
        });
      }
    }

    console.log(`${projects.length} proyectos (${stdCount} con /GIS)`);
  }

  console.log('\n=========================================');
  console.log('RESUMEN DE ESTANDARIZACIÓN DE DRIVE:');
  console.log(`- Total proyectos con /GIS (estandarizados): ${summary.standardizedProjects.length}`);
  console.log(`- Total proyectos sin /GIS (omitidos): ${summary.skippedProjects.length}`);
  console.log('=========================================\n');

  console.log('PROYECTOS LISTOS PARA INDEXAR:');
  summary.standardizedProjects.forEach(sp => {
    console.log(` [${sp.basinName}] -> ${sp.projectName} (GIS id: ${sp.gisFolderId})`);
  });

  fs.writeFileSync(
    path.resolve(__dirname, 'inventario_gis_drive.json'),
    JSON.stringify(summary, null, 2),
    'utf8'
  );
  console.log('\nInventario guardado en scripts/inventario_gis_drive.json');
}

scanAllDrive().catch(console.error);
