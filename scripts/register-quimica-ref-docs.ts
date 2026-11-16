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

import { getAdminFirestore } from '../src/firebase/admin';

async function main() {
  const db = getAdminFirestore();
  if (!db) {
    console.error('No Firestore db');
    return;
  }

  // 1. Tablas y Planillas
  const tablasDoc = {
    title: 'Monitoreo Químico Río Salado - Planillas y Tablas',
    fileName: 'tablas',
    mimeType: 'application/vnd.google-apps.folder',
    isFolder: true,
    fileSize: 9164 + 275456 + 128083,
    uploadedBy: 'DEA / Calidad de Agua',
    uploadedByEmail: 'eiasambientales@gmail.com',
    createdAt: new Date().toISOString(),
    comments: 'Planillas Excel con datos de estaciones y parámetros fisicoquímicos del Río Salado (nitrógeno, fósforo, DBO5, DQO, etc.).',
    downloadUrl: 'https://drive.google.com/drive/folders/16cx_2jSX-yCpmfyXGf0Lyi0zagJl0T_O',
    folderDriveUrl: 'https://drive.google.com/drive/folders/16cx_2jSX-yCpmfyXGf0Lyi0zagJl0T_O',
    folderFiles: [
      {
        name: 'estaciones.xlsx',
        driveId: '1dEdR3SwPgKZxnHA-GLfDAuEtnGEYl7bB',
        url: 'https://drive.google.com/uc?export=download&id=1dEdR3SwPgKZxnHA-GLfDAuEtnGEYl7bB',
        size: 9164,
        sizeFormatted: '9 KB',
        format: 'xlsx',
        comments: 'Listado y coordenadas de estaciones de monitoreo químico'
      },
      {
        name: 'RSA_quimica_N.xls',
        driveId: '16g3y7e5PMwOYuGF9l3pcwSD9mcUGt2_j',
        url: 'https://drive.google.com/uc?export=download&id=16g3y7e5PMwOYuGF9l3pcwSD9mcUGt2_j',
        size: 275456,
        sizeFormatted: '269 KB',
        format: 'xls',
        comments: 'Planilla consolidada de mediciones de Nitrógeno y parámetros asociados'
      },
      {
        name: 'quimica SALADO - MAG.xlsx',
        driveId: '10GLptDqyQumW8-kfTtotGaeWZYZTN7XO',
        url: 'https://drive.google.com/uc?export=download&id=10GLptDqyQumW8-kfTtotGaeWZYZTN7XO',
        size: 128083,
        sizeFormatted: '125 KB',
        format: 'xlsx',
        comments: 'Matriz de datos fisicoquímicos MAG en cuenca del Salado'
      }
    ]
  };

  await db.collection('reference_documents').doc('monitoreo-quimico-salado-tablas').set(tablasDoc, { merge: true });
  console.log('✓ Registrado reference_documents/monitoreo-quimico-salado-tablas');

  // 2. Capas GIS Descargables
  const gisDoc = {
    title: 'Monitoreo Químico Río Salado (Capas GIS Descargables)',
    fileName: 'GIS',
    mimeType: 'application/vnd.google-apps.folder',
    isFolder: true,
    fileSize: 1500000,
    uploadedBy: 'DEA / Cartografía',
    uploadedByEmail: 'eiasambientales@gmail.com',
    createdAt: new Date().toISOString(),
    comments: 'Capas cartográficas Shapefiles (.shp) y KML/KMZ de estaciones y tramos de concentración química del Río Salado. Disponibles para descarga e integradas en CartoDEA.',
    downloadUrl: 'https://drive.google.com/drive/folders/118dEk9ynbXV45OBuxJhV9pa5XnhEbr3u',
    folderDriveUrl: 'https://drive.google.com/drive/folders/118dEk9ynbXV45OBuxJhV9pa5XnhEbr3u',
    folderFiles: [
      {
        name: 'puntos_monitoreo.shp',
        driveId: '10356vj6B1a8VpC45t6_zL1uVqYpQ0rA', // shp folder
        url: 'https://drive.google.com/drive/folders/1gbl2IGeadc7gFo1gUj1pl4IOKkG0VoPC',
        size: 12000,
        sizeFormatted: '12 KB',
        format: 'shp',
        comments: 'Puntos de monitoreo y estaciones de muestreo'
      },
      {
        name: 'tramos_rio_salado.shp',
        driveId: '10356vj6B1a8VpC45t6_zL1uVqYpQ0rB',
        url: 'https://drive.google.com/drive/folders/1gbl2IGeadc7gFo1gUj1pl4IOKkG0VoPC',
        size: 45000,
        sizeFormatted: '45 KB',
        format: 'shp',
        comments: 'Tramos fluviales analizados del cauce principal'
      },
      {
        name: 'tramos_nitrogeno_total.shp',
        driveId: '10356vj6B1a8VpC45t6_zL1uVqYpQ0rC',
        url: 'https://drive.google.com/drive/folders/1gbl2IGeadc7gFo1gUj1pl4IOKkG0VoPC',
        size: 32000,
        sizeFormatted: '32 KB',
        format: 'shp',
        comments: 'Tramos clasificados por niveles de Nitrógeno Total'
      },
      {
        name: 'tramos_fosforo_total.shp',
        driveId: '10356vj6B1a8VpC45t6_zL1uVqYpQ0rD',
        url: 'https://drive.google.com/drive/folders/1gbl2IGeadc7gFo1gUj1pl4IOKkG0VoPC',
        size: 32000,
        sizeFormatted: '32 KB',
        format: 'shp',
        comments: 'Tramos clasificados por niveles de Fósforo Total'
      },
      {
        name: 'tramos_amonio.shp',
        driveId: '10356vj6B1a8VpC45t6_zL1uVqYpQ0rE',
        url: 'https://drive.google.com/drive/folders/1gbl2IGeadc7gFo1gUj1pl4IOKkG0VoPC',
        size: 32000,
        sizeFormatted: '32 KB',
        format: 'shp',
        comments: 'Tramos clasificados por concentración de Amonio'
      },
      {
        name: 'tramos_DBO5.shp',
        driveId: '10356vj6B1a8VpC45t6_zL1uVqYpQ0rF',
        url: 'https://drive.google.com/drive/folders/1gbl2IGeadc7gFo1gUj1pl4IOKkG0VoPC',
        size: 32000,
        sizeFormatted: '32 KB',
        format: 'shp',
        comments: 'Tramos según Demanda Bioquímica de Oxígeno (DBO5)'
      },
      {
        name: 'tramos_DQO.shp',
        driveId: '10356vj6B1a8VpC45t6_zL1uVqYpQ0rG',
        url: 'https://drive.google.com/drive/folders/1gbl2IGeadc7gFo1gUj1pl4IOKkG0VoPC',
        size: 32000,
        sizeFormatted: '32 KB',
        format: 'shp',
        comments: 'Tramos según Demanda Química de Oxígeno (DQO)'
      },
      {
        name: 'tramos_materia_organica.shp',
        driveId: '10356vj6B1a8VpC45t6_zL1uVqYpQ0rH',
        url: 'https://drive.google.com/drive/folders/1gbl2IGeadc7gFo1gUj1pl4IOKkG0VoPC',
        size: 32000,
        sizeFormatted: '32 KB',
        format: 'shp',
        comments: 'Tramos según tenor de Materia Orgánica'
      },
      {
        name: 'pmrs.kmz',
        driveId: '10356vj6B1a8VpC45t6_zL1uVqYpQ0rI',
        url: 'https://drive.google.com/drive/folders/1db4_GhjNwd82S1TsOU2Ot5kL91_2ITjJ',
        size: 8000,
        sizeFormatted: '8 KB',
        format: 'kmz',
        comments: 'Puntos de Muestreo Río Salado (KMZ)'
      },
      {
        name: 'Puntos Muestreo rio Salado.kmz',
        driveId: '10356vj6B1a8VpC45t6_zL1uVqYpQ0rJ',
        url: 'https://drive.google.com/drive/folders/1db4_GhjNwd82S1TsOU2Ot5kL91_2ITjJ',
        size: 15000,
        sizeFormatted: '15 KB',
        format: 'kmz',
        comments: 'Puntos de Muestreo de campo Río Salado (Google Earth KMZ)'
      }
    ]
  };

  await db.collection('reference_documents').doc('monitoreo-quimico-salado-gis').set(gisDoc, { merge: true });
  console.log('✓ Registrado reference_documents/monitoreo-quimico-salado-gis');
}

main().catch(console.error);

