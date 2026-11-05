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

import { getAdminStorage, getAdminFirestore } from '../src/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

async function run() {
  const pdfPath = path.resolve(process.cwd(), 'docs', 'VF_Informe Ambiente Costero_oct26_.pdf');
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`No se encontró el archivo: ${pdfPath}`);
  }

  const stat = fs.statSync(pdfPath);
  const fileName = 'VF_Informe Ambiente Costero_oct26_.pdf';
  const storagePath = `reference_docs/VF_Informe_Ambiente_Costero_oct26_.pdf`;

  const storage = getAdminStorage();
  const db = getAdminFirestore();

  if (!storage || !db) {
    throw new Error('No se pudo inicializar Firebase Admin Storage o Firestore');
  }

  const bucket = storage.bucket();
  const file = bucket.file(storagePath);

  const [exists] = await file.exists();
  let alreadyUploaded = false;
  if (exists) {
    const [meta] = await file.getMetadata();
    if (Number(meta.size) === stat.size) {
      console.log(`El archivo ya existe completo en Firebase Storage (${meta.size} bytes).`);
      alreadyUploaded = true;
    }
  }

  if (!alreadyUploaded) {
    console.log(`Subiendo "${fileName}" (${(stat.size / (1024 * 1024)).toFixed(2)} MB) al bucket ${bucket.name}...`);
    await new Promise<void>((resolve, reject) => {
      const readStream = fs.createReadStream(pdfPath, { highWaterMark: 1024 * 1024 });
      const writeStream = file.createWriteStream({
        resumable: false,
        validation: false,
        metadata: {
          contentType: 'application/pdf',
          cacheControl: 'public, max-age=31536000',
        },
      });

      let uploaded = 0;
      let lastLogPct = 0;
      readStream.on('data', (chunk: Buffer) => {
        uploaded += chunk.length;
        const pct = Math.floor((uploaded / stat.size) * 100);
        if (pct >= lastLogPct + 10) {
          lastLogPct = pct;
          console.log(`Progreso de subida: ${pct}% (${(uploaded / (1024 * 1024)).toFixed(1)} MB)`);
        }
      });

      readStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', () => {
        console.log('Subida a Firebase Storage completada.');
        resolve();
      });

      readStream.pipe(writeStream);
    });
  }

  let downloadUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(storagePath).replace(/%2F/g, '/')}`;

  try {
    await file.makePublic();
    console.log('Archivo marcado como público.');
  } catch (e: any) {
    console.log('Bucket con UBLA activo, generando Signed URL de larga duración...');
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: '01-01-2035',
    });
    downloadUrl = signedUrl;
  }

  const docId = 'vf-informe-ambiente-costero-oct26';
  const docData = {
    id: docId,
    title: 'VF_Informe Ambiente Costero_oct26_.pdf',
    comments: '',
    fileName,
    fileSize: stat.size,
    mimeType: 'application/pdf',
    storagePath,
    downloadUrl,
    uploadedBy: 'Departamento de Estudios Ambientales',
    uploadedByEmail: 'dea@infraestructura.gba.gob.ar',
    createdAt: new Date().toISOString(),
    timestamp: FieldValue.serverTimestamp(),
  };

  await db.collection('reference_documents').doc(docId).set(docData, { merge: true });
  console.log('Documento registrado en Firestore (reference_documents):', docId);

  const existingAct = await db
    .collection('app_activities')
    .where('actionType', '==', 'upload_reference_doc')
    .limit(5)
    .get();

  const alreadyNotified = existingAct.docs.some(d => d.data().detail === fileName || d.data().projectName === fileName);

  if (!alreadyNotified) {
    await db.collection('app_activities').add({
      userId: 'system-dea',
      userName: 'Portal DEA',
      userEmail: 'dea@infraestructura.gba.gob.ar',
      userPhoto: '',
      actionType: 'upload_reference_doc',
      projectName: fileName,
      detail: fileName,
      documentUrl: downloadUrl,
      timestamp: FieldValue.serverTimestamp(),
    });
    console.log('Notificación registrada en app_activities para la campana del Portal.');
  } else {
    console.log('La notificación en app_activities ya existía.');
  }

  console.log('URL de descarga:', downloadUrl);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
