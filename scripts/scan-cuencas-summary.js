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

// Lista de cuencas de alto interés
const CANDIDATE_CUENCAS = [
  { code: 'RLU', id: '1Lq372G1fzdm5fEyoBw1hJgG2NSpqx0ET', name: 'RLU - CUENCA RÍO LUJAN' },
  { code: 'RRQ', id: '15zKUw4kgfR4WIpCZZp_IE5bFtV-6kXzZ', name: 'RRQ - CUENCA RIO RECONQUISTA' },
  { code: 'MAR', id: '1TlPdQLyQUxIUeBtMJydE1ucVsO8RwMpR', name: 'MAR - CUENCA MATANZA-RIACHUELO' },
  { code: 'RAR', id: '13cYT3lU8gN93Gpm9JcQiG0JdrPzvKsUI', name: 'RAR - CUENCA RÍO ARECO' },
  { code: 'ARR', id: '1-UDl3ZniJ-NrT51vlzJfOtmV7rhqD7Yf', name: 'ARR - CUENCA RIOS ARRECIFES Y BARADERO' },
  { code: 'RSB', id: '1D_L7UfEX_tnXHYnClCp_8puEZP5v7U9P', name: 'RSB - CUENCA SAMBOROMBON' },
  { code: 'MCH', id: '1pmy1TiQYW2A5P5iXPv-PzYrAo7sWlYJR', name: 'MCH - CUENCA MAR CHIQUITA' },
  { code: 'QQG', id: '1KdfS4brvjQ4vXsxgOBeOAf7-PebIE4w2', name: 'QQG - CUENCA QUEQUÉN GRANDE' },
];

async function scanCandidates() {
  console.log('Escaneando cuencas candidatas en Drive B...\n');
  for (const c of CANDIDATE_CUENCAS) {
    try {
      const res = await drive.files.list({
        q: `'${c.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 100,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      const projs = res.data.files || [];
      console.log(`- ${c.name}: ${projs.length} proyectos encontrados.`);
    } catch (e) {
      console.error(`Error en ${c.name}:`, e.message);
    }
  }
}

scanCandidates().catch(console.error);
