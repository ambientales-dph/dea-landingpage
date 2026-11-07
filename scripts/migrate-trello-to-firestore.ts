import fs from 'fs';
import path from 'path';
import { getAdminFirestore, getAdminStorage } from '../src/firebase/admin';
import { CUENCAS, extractFieldFromDesc } from '../src/lib/cuencas';

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

const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_API_TOKEN = process.env.TRELLO_API_TOKEN;
const BASE_URL = 'https://api.trello.com/1';

async function trelloFetch(url: string) {
  const separator = url.includes('?') ? '&' : '?';
  const fullUrl = `${BASE_URL}${url}${separator}key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`;
  const res = await fetch(fullUrl);
  if (!res.ok) {
    throw new Error(`Trello error ${res.status} on ${url}`);
  }
  return res.json();
}

async function downloadTrelloAttachment(attUrl: string): Promise<Buffer> {
  // Intentar con header Authorization OAuth (requerido por Trello para /download/)
  const authHeader = `OAuth oauth_consumer_key="${TRELLO_API_KEY}", oauth_token="${TRELLO_API_TOKEN}"`;
  let res = await fetch(attUrl, {
    headers: {
      Authorization: authHeader,
    },
  });
  if (!res.ok) {
    const sep = attUrl.includes('?') ? '&' : '?';
    res = await fetch(`${attUrl}${sep}key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`);
  }
  if (!res.ok) {
    throw new Error(`Failed to download attachment ${attUrl}: HTTP ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function uploadBufferToStorage(
  bucket: any,
  storagePath: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const file = bucket.file(storagePath);
  await new Promise<void>((resolve, reject) => {
    const stream = file.createWriteStream({
      resumable: false,
      validation: false,
      metadata: {
        contentType: contentType || 'application/octet-stream',
      },
    });
    stream.on('error', reject);
    stream.on('finish', () => resolve());
    stream.end(buffer);
  });
  try {
    await file.makePublic();
  } catch (e) {
    console.warn(`Could not makePublic on ${storagePath}:`, e);
  }
  return `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(storagePath).replace(/%2F/g, '/')}`;
}

// Tarjetas vacías o de plantilla que se descartan de la colección projects / miscellaneous_cards
const DISCARDED_PROJECT_CARD_IDS = new Set([
  '696fb5461cd1dc96a49bfbe2', // Nombre del proyecto (XXX000) - Plantilla en METODOLOGÍA
  '685c2941234b1f8de728328a', // RSA101 - Archivada vacía
  '6984ddc91abad28c0e4549d0', // Qpeot (MAR011) - Archivada vacía de prueba
  '62c6de17702eda2b71a7b1f0', // Puentes Ferroviarios –rio Luján (Pilar, Exaltación de La Cruz, Luján) - Vacía sin código
  '62c6e8e8c3d8757c3c5c89f2', // Puentes Viales río Lujan - Vacía sin código
]);

// Normalización explícita para las 4 tarjetas de proyecto con código fuera de formato
const NORMALIZED_LOOSE_NAMES: Record<string, string> = {
  '66e977908b31ce8f200401c0': 'D P en Cuenca Vergara (Villa Tesei-Hurlingam) (RRQ020)',
  '63763f74b2c5e100df1b7cc5': 'Desagües pluviales en el sector sur de la localidad de Coronel Pringles (QQG001)',
  '63dbd7cb8217ae5f805dd15a': 'TERRAPLÉN DE DEFENSA DE LA LOCALIDAD DE PEHUAJÓ (ALTEO Y CONFORMACIÓN SECTOR NOROESTE) (RSA006)',
  '618959e2145ce24bf4ab231c': 'Desagües Pluviales en Máximo Paz y Puentes en calle Combate de Los Pozos y Suiza sobre arroyo Cañuelas (PLUVIAL) (MAR003)',
};

// Las 5 tarjetas no-proyecto cuyos archivos adjuntos también se incorporan a Documentación de Referencia
const REFERENCE_DOC_SOURCE_CARDS = new Set([
  '6537b496565dfd3b967edcf7', // Reglamento Operativo del Programa (“ROP”)
  '634995e5dcdeed058c8d7830', // MANUAL DE PROCEDIMIENTOS SALVAGUARDAS VF
  '68d1725ae71c24ca193ce195', // Matriz de Impactos y cálculo de VIA (modelo)
  '620666ba55a56b68223f1d86', // Informes (PLANILLAS Y ACTAS)
  '620666a11226712eca5d781c', // Reuniones (SEGUIMIENTO DE OBRAS)
]);

function getTrelloObjectCreationDate(trelloId: string): string {
  const timestampHex = trelloId.substring(0, 8);
  const timestampSeconds = parseInt(timestampHex, 16);
  if (isNaN(timestampSeconds)) return new Date().toISOString();
  return new Date(timestampSeconds * 1000).toISOString();
}

function parseStructuredFields(desc: string) {
  return {
    estado: extractFieldFromDesc(desc, '·ESTADO') || extractFieldFromDesc(desc, 'ESTADO') || 'Sin iniciar',
    partido: extractFieldFromDesc(desc, '·PARTIDO') || extractFieldFromDesc(desc, 'PARTIDO') || '',
    referencia: extractFieldFromDesc(desc, '·REFERENCIA GEOGRÁFICA') || extractFieldFromDesc(desc, 'REFERENCIA GEOGRÁFICA') || '',
    extension: extractFieldFromDesc(desc, '·EXTENSIÓN (Ha o Km)') || extractFieldFromDesc(desc, 'EXTENSIÓN (Ha o Km)') || '',
    poblacion: extractFieldFromDesc(desc, '·POBLACIÓN BENEFICIADA') || extractFieldFromDesc(desc, 'POBLACION BENEFICIADA') || '',
    presupuesto: extractFieldFromDesc(desc, '·PRESUPUESTO') || extractFieldFromDesc(desc, 'MONTO OBRA') || '',
    financiamiento: extractFieldFromDesc(desc, '·FINANCIAMIENTO') || extractFieldFromDesc(desc, 'Financiamiento') || '',
    diagnostico: extractFieldFromDesc(desc, '·Diagnóstico ambiental-socioeconómico') || extractFieldFromDesc(desc, 'Diagnóstico ambiental-socioeconómico') || '',
    sig: extractFieldFromDesc(desc, '·Información SIG-imágenes') || extractFieldFromDesc(desc, 'Información SIG-imágenes') || '',
    dron: extractFieldFromDesc(desc, '·Información LIDAR/vuelos Dron') || extractFieldFromDesc(desc, 'Información LIDAR/vuelos Dron') || '',
    seguimiento: extractFieldFromDesc(desc, '·Seguimiento de obra') || '',
    proyectista: extractFieldFromDesc(desc, '·Proyectista') || extractFieldFromDesc(desc, 'PROYECTISTA') || '',
    expediente: extractFieldFromDesc(desc, '·EXPEDIENTE') || extractFieldFromDesc(desc, 'EXPTE') || '',
    providencia: extractFieldFromDesc(desc, '·PROVIDENCIA') || '',
    resolucion: extractFieldFromDesc(desc, '·RESOLUCIÓN') || extractFieldFromDesc(desc, 'RESOL. DIA') || '',
    fechaDia: extractFieldFromDesc(desc, '·FECHA DIA') || extractFieldFromDesc(desc, 'FECHA DIA') || '',
    contratista: extractFieldFromDesc(desc, '·CONTRATISRA') || extractFieldFromDesc(desc, 'CONTRATISTA') || '',
    respAmbiental: extractFieldFromDesc(desc, '·RESPONSABLE AMBIENTAL') || '',
    otroDrive: extractFieldFromDesc(desc, '·Otro Drive de trabajo') || extractFieldFromDesc(desc, 'Drive de trabajo') || '',
    driveProyectista: extractFieldFromDesc(desc, '·Drive del proyectista') || '',
    coordinadas: extractFieldFromDesc(desc, '·COORDINADAS') || '',
  };
}

async function runMigration() {
  const db = getAdminFirestore();
  const storage = getAdminStorage();
  const bucket = storage.bucket();

  console.log('1. Consultando tableros de Trello...');
  const boards = await trelloFetch('/members/me/boards?fields=id,name,closed,url,shortLink');

  let migratedProjectsCount = 0;
  let discardedCount = 0;
  let miscCardsCount = 0;
  let refDocsUploadedCount = 0;
  let projectBinaryUploadedCount = 0;
  let commentsMigratedCount = 0;

  // Obtener documentos de referencia actuales para no duplicar si se re-ejecuta el script
  const existingRefDocsSnap = await db.collection('reference_documents').get();
  const existingRefDocsByFileName = new Map<string, string>();
  existingRefDocsSnap.forEach(docSnap => {
    const data = docSnap.data();
    if (data.fileName) existingRefDocsByFileName.set(data.fileName, docSnap.id);
  });

  const strictRegex = /\(([A-Z]{2,4}\d{3})\)$/;

  for (const b of boards) {
    console.log(`\nProcesando tablero: ${b.name} (${b.id})...`);
    const [lists, boardLabels, cards, actions] = await Promise.all([
      trelloFetch(`/boards/${b.id}/lists?filter=all&fields=id,name,closed`),
      trelloFetch(`/boards/${b.id}/labels?fields=id,name,color`),
      trelloFetch(`/boards/${b.id}/cards?filter=all&fields=id,name,desc,closed,idList,url,labels,cover,dateLastActivity&attachments=true`),
      trelloFetch(`/boards/${b.id}/actions?filter=commentCard,updateCard&limit=1000&member_creator=true`),
    ]);

    const listMap = new Map<string, { id: string; name: string; closed: boolean }>();
    lists.forEach((l: any) => listMap.set(l.id, { id: l.id, name: l.name, closed: Boolean(l.closed) }));

    // Guardar metadatos del tablero, sus listas y etiquetas en project_boards
    await db.collection('project_boards').doc(b.id).set({
      id: b.id,
      shortLink: b.shortLink || b.id,
      name: b.name,
      url: b.url || '',
      closed: Boolean(b.closed),
      lists: lists.map((l: any) => ({ id: l.id, name: l.name, closed: Boolean(l.closed) })),
      labels: (boardLabels || []).map((lb: any) => ({ id: lb.id, name: lb.name || '', color: lb.color || null })),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Agrupar acciones (comentarios y movimientos) por tarjeta
    const actionsByCard = new Map<string, any[]>();
    for (const act of actions || []) {
      const cId = act.data?.card?.id;
      if (!cId) continue;
      if (!actionsByCard.has(cId)) actionsByCard.set(cId, []);
      actionsByCard.get(cId)!.push({
        id: act.id,
        type: act.type,
        date: act.date,
        data: act.data,
        memberCreator: act.memberCreator || {
          id: 'system',
          fullName: 'Usuario Trello',
          username: 'trello',
          avatarUrl: null,
        },
      });
    }

    for (const c of cards) {
      if (DISCARDED_PROJECT_CARD_IDS.has(c.id)) {
        console.log(`  [DESCARTADA] ${c.name} (${c.id})`);
        discardedCount++;
        continue;
      }

      const listInfo = listMap.get(c.idList) || { id: c.idList, name: 'General', closed: false };
      const normalizedName = NORMALIZED_LOOSE_NAMES[c.id] || c.name.trim();
      const strictMatch = normalizedName.match(strictRegex);
      const cardActions = actionsByCard.get(c.id) || [];
      commentsMigratedCount += cardActions.filter(a => a.type === 'commentCard').length;

      if (strictMatch) {
        // Es un Proyecto / Obra
        const projectCode = strictMatch[1];
        const cuencaPrefixMatch = projectCode.match(/^([A-Z]{2,4})\d{3}$/);
        const cuencaPrefix = cuencaPrefixMatch ? cuencaPrefixMatch[1] : '';
        const cuencaObj = CUENCAS.find(cu => cu.code === cuencaPrefix);

        // Procesar adjuntos (si hay binarios alojados en Trello, subirlos a Firebase Storage)
        const processedAttachments: any[] = [];
        for (const att of c.attachments || []) {
          const attUrl = att.url || '';
          const isTrelloHosted =
            Boolean(att.bytes && att.bytes > 0) ||
            attUrl.includes('trello.com/1/cards') ||
            attUrl.includes('trello-attachments');

          let finalUrl = attUrl;
          let storagePath: string | null = null;

          if (isTrelloHosted) {
            try {
              const safeName = (att.name || 'archivo').replace(/[^a-zA-Z0-9._-]/g, '_');
              storagePath = `project_attachments/${projectCode}/${c.id}_${att.id}_${safeName}`;
              console.log(`  [STORAGE PROYECTO] Descargando y subiendo adjunto de ${projectCode}: ${att.name}...`);
              const buf = await downloadTrelloAttachment(attUrl);
              finalUrl = await uploadBufferToStorage(bucket, storagePath, buf, att.mimeType || 'application/octet-stream');
              projectBinaryUploadedCount++;
            } catch (err: any) {
              console.warn(`  [WARN] No se pudo migrar binario de ${projectCode} (${att.name}):`, err.message);
            }
          }

          processedAttachments.push({
            id: att.id,
            name: att.name || 'Adjunto',
            fileName: att.name || 'Adjunto',
            url: finalUrl,
            originalTrelloUrl: attUrl,
            storagePath,
            bytes: att.bytes || 0,
            mimeType: att.mimeType || '',
            date: att.date || getTrelloObjectCreationDate(att.id),
            previews: att.previews || [],
          });
        }

        const structuredFields = parseStructuredFields(c.desc || '');

        const projectDoc = {
          id: c.id,
          code: projectCode,
          cuencaId: cuencaObj?.id || '',
          cuencaCode: cuencaPrefix,
          name: normalizedName,
          originalTrelloName: c.name,
          url: c.url, // Se conserva el link directo a la tarjeta de Trello para revisión manual
          trelloUrl: c.url,
          desc: c.desc || '',
          boardId: b.id,
          boardName: b.name,
          idList: c.idList,
          listName: listInfo.name,
          closed: Boolean(c.closed),
          cover: {
            color: c.cover?.color || null,
          },
          labels: (c.labels || []).map((l: any) => ({
            id: l.id,
            name: l.name || '',
            color: l.color || null,
          })),
          attachments: processedAttachments,
          actions: cardActions,
          fields: structuredFields,
          createdAt: getTrelloObjectCreationDate(c.id),
          dateLastActivity: c.dateLastActivity || new Date().toISOString(),
          migratedAt: new Date().toISOString(),
        };

        await db.collection('projects').doc(c.id).set(projectDoc, { merge: true });
        migratedProjectsCount++;
      } else {
        // Es una tarjeta No-Proyecto -> Va a Misceláneas (las 22 tarjetas no-proyecto completas)
        const miscAttachments: any[] = [];
        for (const att of c.attachments || []) {
          const attUrl = att.url || '';
          const isTrelloHosted =
            Boolean(att.bytes && att.bytes > 0) ||
            attUrl.includes('trello.com/1/cards') ||
            attUrl.includes('trello-attachments');

          let finalUrl = attUrl;
          let storagePath: string | null = null;

          if (isTrelloHosted) {
            try {
              const safeName = (att.name || 'documento').replace(/[^a-zA-Z0-9._-]/g, '_');
              storagePath = `reference_docs/${Date.now()}_${safeName}`;
              console.log(`  [DOC REFERENCIA] Descargando de Trello y subiendo a Storage: ${att.name} (Tarjeta: ${c.name})...`);
              const buf = await downloadTrelloAttachment(attUrl);
              finalUrl = await uploadBufferToStorage(bucket, storagePath, buf, att.mimeType || 'application/octet-stream');

              if (REFERENCE_DOC_SOURCE_CARDS.has(c.id)) {
                const existingDocId = existingRefDocsByFileName.get(att.name);
                const refDocPayload = {
                  title: `${c.name} — ${att.name.replace(/\.[^/.]+$/, '')}`,
                  comments: `Migrado desde Trello (${b.name} • Lista: ${listInfo.name}). Tarjeta original: ${c.url}`,
                  fileName: att.name,
                  fileSize: Number(att.bytes || buf.length),
                  contentType: att.mimeType || 'application/octet-stream',
                  storagePath,
                  url: finalUrl,
                  uploadedBy: 'Migración Trello DEA',
                  uploadedByEmail: '',
                  trelloCardId: c.id,
                  trelloCardUrl: c.url,
                  createdAt: att.date || getTrelloObjectCreationDate(att.id),
                };

                if (existingDocId) {
                  await db.collection('reference_documents').doc(existingDocId).set(refDocPayload, { merge: true });
                } else {
                  const createdRef = await db.collection('reference_documents').add(refDocPayload);
                  existingRefDocsByFileName.set(att.name, createdRef.id);
                }
                refDocsUploadedCount++;
              }
            } catch (err: any) {
              console.warn(`  [WARN] Error subiendo adjunto de tarjeta miscelánea ${c.name} (${att.name}):`, err.message);
            }
          }

          miscAttachments.push({
            id: att.id,
            name: att.name || 'Adjunto',
            url: finalUrl,
            originalTrelloUrl: attUrl,
            bytes: att.bytes || 0,
            mimeType: att.mimeType || '',
          });
        }

        const miscDoc = {
          id: c.id,
          name: c.name,
          desc: c.desc || '',
          url: c.url, // Acceso directo a la tarjeta real de Trello
          boardId: b.id,
          boardName: b.name,
          idList: c.idList,
          listName: listInfo.name,
          closed: Boolean(c.closed),
          attachments: miscAttachments,
          actions: cardActions,
          hasReferenceDocs: REFERENCE_DOC_SOURCE_CARDS.has(c.id),
          createdAt: getTrelloObjectCreationDate(c.id),
          dateLastActivity: c.dateLastActivity || new Date().toISOString(),
          migratedAt: new Date().toISOString(),
        };

        await db.collection('miscellaneous_cards').doc(c.id).set(miscDoc, { merge: true });
        miscCardsCount++;
      }
    }
  }

  console.log('\n=== MIGRACIÓN COMPLETADA CON ÉXITO ===');
  console.log(
    JSON.stringify(
      {
        migratedProjectsCount,
        miscCardsCount,
        discardedCount,
        refDocsUploadedCount,
        projectBinaryUploadedCount,
        commentsMigratedCount,
      },
      null,
      2
    )
  );
}

runMigration().catch(err => {
  console.error('Error fatal en migración:', err);
  process.exit(1);
});
