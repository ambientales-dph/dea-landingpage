import fs from 'fs';
import path from 'path';
import { DESCRIPCION_PLANTILLA } from '../src/lib/cuencas';

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

const templateLines = DESCRIPCION_PLANTILLA.split('\n');
function getExtraLinesFromDesc(desc: string): string[] {
  if (!desc) return [];
  const currentLines = desc.split('\n');
  return currentLines.filter(cl => {
    const trimmed = cl.trim();
    if (!trimmed || trimmed === '#' || trimmed.startsWith('Drive ')) return false;
    const isTemplateField = templateLines.some(tl => {
      const fm = tl.match(/^([- ]?·?.*?:)/);
      return fm && trimmed.toLowerCase().startsWith(fm[1].toLowerCase());
    });
    return !isTemplateField;
  });
}

async function runAudit() {
  const allMemberBoards = await trelloFetch('/members/me/boards?fields=id,name,closed,url,shortLink');

  const codesPerBoard: Record<string, Set<string>> = {};
  const allNonProjectCards: { board: string; list: string; name: string; closed: boolean; hasDesc: boolean; attachments: number }[] = [];
  const allLooseCodeCards: { board: string; list: string; name: string; detectedCode: string; closed: boolean }[] = [];

  let totalUniqueCards = 0;
  let totalOpenCards = 0;
  let totalClosedCards = 0;
  let totalStrictProjects = 0;
  let totalLooseProjects = 0;
  let totalNonProjects = 0;
  let totalComments = 0;
  let totalAttachments = 0;
  let totalDriveAttachments = 0;
  let totalTrelloHostedAttachments = 0;
  let totalOtherUrlAttachments = 0;
  let totalTrelloHostedBytes = 0;
  let totalFirestoreBytes = 0;

  for (const b of allMemberBoards) {
    codesPerBoard[b.name] = new Set();
    const lists = await trelloFetch(`/boards/${b.id}/lists?filter=all&fields=id,name,closed`);
    const listMap = new Map<string, { name: string; closed: boolean }>();
    lists.forEach((l: any) => listMap.set(l.id, { name: l.name, closed: l.closed }));

    const cards = await trelloFetch(
      `/boards/${b.id}/cards?filter=all&fields=id,name,desc,closed,idList,url,labels,cover,dateLastActivity,badges&attachments=true&checklists=all`
    );

    const comments = await trelloFetch(`/boards/${b.id}/actions?filter=commentCard&limit=1000`);

    const strictRegex = /\(([A-Z]{2,4}\d{3})\)$/;
    const looseRegex = /\b([A-Z]{2,4}\d{3})\b/;

    for (const c of cards) {
      totalUniqueCards++;
      if (c.closed) totalClosedCards++;
      else totalOpenCards++;

      const listInfo = listMap.get(c.idList) || { name: 'Desconocida', closed: false };
      const strictMatch = c.name.trim().match(strictRegex);
      const looseMatch = c.name.match(looseRegex);

      if (strictMatch) {
        totalStrictProjects++;
        codesPerBoard[b.name].add(strictMatch[1]);
      } else if (looseMatch) {
        totalLooseProjects++;
        codesPerBoard[b.name].add(looseMatch[1]);
        allLooseCodeCards.push({
          board: b.name,
          list: listInfo.name,
          name: c.name,
          detectedCode: looseMatch[1],
          closed: c.closed,
        });
      } else {
        totalNonProjects++;
        allNonProjectCards.push({
          board: b.name,
          list: listInfo.name,
          name: c.name,
          closed: c.closed,
          hasDesc: Boolean(c.desc && c.desc.trim()),
          attachments: (c.attachments || []).length,
        });
      }

      for (const att of c.attachments || []) {
        totalAttachments++;
        const url = att.url || '';
        const isTrelloHosted =
          Boolean(att.bytes && att.bytes > 0) ||
          url.includes('trello.com/1/cards') ||
          url.includes('trello-attachments');
        if (isTrelloHosted) {
          totalTrelloHostedAttachments++;
          totalTrelloHostedBytes += Number(att.bytes || 0);
        } else if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
          totalDriveAttachments++;
        } else {
          totalOtherUrlAttachments++;
        }
      }
    }

    totalComments += comments.length;
    totalFirestoreBytes +=
      Buffer.byteLength(JSON.stringify(cards), 'utf8') +
      Buffer.byteLength(JSON.stringify(comments), 'utf8') +
      Buffer.byteLength(JSON.stringify(lists), 'utf8');
  }

  const boardsNames = Object.keys(codesPerBoard);
  const sharedCodes: string[] = [];
  if (boardsNames.length >= 2) {
    const setA = codesPerBoard[boardsNames[0]];
    const setB = codesPerBoard[boardsNames[1]];
    for (const code of setA) {
      if (setB.has(code)) sharedCodes.push(code);
    }
  }

  console.log(
    JSON.stringify(
      {
        totalBoards: allMemberBoards.length,
        totalUniqueCards,
        totalOpenCards,
        totalClosedCards,
        totalStrictProjects,
        totalLooseProjects,
        totalNonProjects,
        sharedCodesCount: sharedCodes.length,
        sharedCodes,
        totalComments,
        totalAttachments,
        totalDriveAttachments,
        totalTrelloHostedAttachments,
        totalOtherUrlAttachments,
        totalTrelloHostedMB: Number((totalTrelloHostedBytes / (1024 * 1024)).toFixed(2)),
        estimatedFirestoreKB: Math.round((totalFirestoreBytes * 1.25) / 1024),
        allLooseCodeCards,
        allNonProjectCards,
      },
      null,
      2
    )
  );
}

runAudit().catch(console.error);
