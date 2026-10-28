const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

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

async function scanAllCuencas() {
  const rootId = '1rmS38NBDOKDscNo6o0Fplb6_eq0bJC9M';
  const res = await drive.files.list({
    q: `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 100,
    orderBy: 'name',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const folders = res.data.files || [];
  
  const INTEGRATED_CODES = ['RSA', 'RLU', 'RRQ'];
  const results = [];

  for (const f of folders) {
    const codeMatch = f.name.match(/^([A-Z0-9]+)\s*-/);
    const code = codeMatch ? codeMatch[1] : f.name;
    const isIntegrated = INTEGRATED_CODES.includes(code);

    // List projects inside this folder
    const pRes = await drive.files.list({
      q: `'${f.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    const projs = pRes.data.files || [];

    results.push({
      code,
      id: f.id,
      name: f.name,
      projectCount: projs.length,
      status: isIntegrated ? 'INTEGRADA' : (projs.length > 0 ? 'PENDIENTE' : 'VACÍA (0 proyectos)')
    });
  }

  console.log(JSON.stringify(results, null, 2));
  fs.writeFileSync(path.resolve(__dirname, 'cuencas_status.json'), JSON.stringify(results, null, 2));
}

scanAllCuencas().catch(console.error);
