import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
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

import { uploadGeoJsonToStorage } from '../src/services/gis-service';

async function run() {
  const geojson = JSON.parse(fs.readFileSync('public/gis_cache/RSB001/cuencas.geojson', 'utf8'));
  const res = await uploadGeoJsonToStorage('RSB001', 'cuencas', geojson);
  console.log('Upload result:', res);
}

run().catch(console.error);
