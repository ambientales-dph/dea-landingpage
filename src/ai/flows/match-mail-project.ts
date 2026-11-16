'use server';

/**
 * @fileOverview Sabueso para vincular mails con obras por nombres de lugares o códigos.
 * Combina heurística determinística estricta (código unívoco) con IA Gemini de respaldo para desambiguar lugares.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MatchMailInputSchema = z.object({
  subject: z.string(),
  snippet: z.string(),
  threadContext: z.string().optional().describe('Contenido de mensajes anteriores en la misma cadena.'),
  availableProjects: z.array(z.object({
    id: z.string(),
    code: z.string(),
    name: z.string()
  }))
});

export type MatchMailInput = z.infer<typeof MatchMailInputSchema>;

const MatchMailOutputSchema = z.object({
  matchedProjects: z.array(z.object({
    code: z.string(),
    name: z.string(),
  })).describe('Lista de proyectos detectados. Si no hay, devolver array vacío.'),
  reasoning: z.string().describe('Breve nota de por qué se vinculó.')
});

export type MatchMailOutput = z.infer<typeof MatchMailOutputSchema>;

const prompt = ai.definePrompt({
  name: 'matchMailProjectPrompt',
  input: { schema: MatchMailInputSchema },
  output: { schema: MatchMailOutputSchema },
  prompt: `Actúa como un clasificador experto para el Departamento de Estudios Ambientales.
  
  TU MISIÓN:
  Identificar a qué obra o proyecto pertenece con precisión el correo recibido.
  
  PROYECTOS ACTIVOS:
  {{#each availableProjects}}
  - {{name}} [{{code}}]
  {{/each}}

  DATOS DEL MAIL ACTUAL:
  Asunto: {{{subject}}}
  Resumen: {{{snippet}}}

  {{#if threadContext}}
  CONTEXTO DE LA CADENA (Mails anteriores):
  {{{threadContext}}}
  {{/if}}

  REGLAS DE ORO:
  1. PRIORIDAD CÓDIGO: Si el mail menciona un código exacto (ej: MAR001, RSAL005), vincúlalo de inmediato.
  2. PRIORIDAD LUGAR GEOGRÁFICO: Busca el nombre específico de la ciudad, partido, río o cuenca (ej: Carhué, Pergamino, Luján, Guaminí, Berisso, Pehuajó, Patagones, Matanza, Duppy).
  3. PROHIBIDO AGRUPAR POR TIPO DE INTERVENCIÓN TÉCNICA:
     Términos como "terraplén", "defensa", "estación de bombeo", "desagües", "conducto", "alcantarilla", "informe ambiental", etc., son genéricos de la ingeniería hidráulica.
     NUNCA vincules múltiples obras solo porque todas sean "terraplenes" o "bombeos".
     Si el mail dice "Terraplén Carhué", la obra es ÚNICAMENTE la de Carhué (descarta Pehuajó, Berisso, Guaminí, etc.).
  4. AMBIGÜEDAD REAL: Solo devuelve más de una obra si el mail menciona un lugar donde realmente coexisten múltiples obras activas (ej: si hay dos obras distintas en "Pergamino" y el mail dice solo "Pergamino").
  5. SIN CONTEXTO: Si el mail no dice nada útil (ej: "Te mando el archivo"), busca en el 'threadContext' si se mencionó la obra o lugar antes.
  6. Si no hay ninguna coincidencia clara, devuelve un array vacío en 'matchedProjects'.

  Devuelve el resultado en formato JSON.`,
});

// --- CONTROL DE FRECUENCIA (THROTTLING) ---
// Para respetar el límite de 15 solicitudes/minuto (Free Tier),
// aseguramos un espacio mínimo de 4.2 segundos entre consultas consecutivas al LLM.
let lastLLMCallTimestamp = 0;
const MIN_LLM_INTERVAL_MS = 4200;

async function throttledPrompt(input: MatchMailInput): Promise<MatchMailOutput> {
  const now = Date.now();
  const elapsed = now - lastLLMCallTimestamp;
  if (elapsed < MIN_LLM_INTERVAL_MS) {
    const delay = MIN_LLM_INTERVAL_MS - elapsed;
    console.log(`⏳ [IA RATE LIMIT] Regulando frecuencia: pausa de ${delay}ms para respetar <15 RPM.`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  lastLLMCallTimestamp = Date.now();
  const { output } = await prompt(input);
  return output!;
}

// --- CONTROL DE HORARIO ARGENTINA (1 AM A 7 AM) ---
function isArgentineNightWindow(): boolean {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: 'numeric',
      hour12: false
    });
    const hour = parseInt(formatter.format(new Date()), 10);
    return hour >= 1 && hour < 7;
  } catch {
    const now = new Date();
    const utcHours = now.getUTCHours();
    const argHours = (utcHours - 3 + 24) % 24;
    return argHours >= 1 && argHours < 7;
  }
}

// --- NIVEL 1: HEURÍSTICA DIRECTA ESTRICTA (COSTO $0, 0ms) ---
// Solo acepta coincidencias unívocas (1 solo proyecto detectado sin ninguna ambigüedad)
function heuristicMatch(input: MatchMailInput): MatchMailOutput | null {
  const normalize = (str: string) =>
    str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const fullText = normalize(`${input.subject} ${input.snippet} ${input.threadContext || ''}`);

  // 1. Coincidencia por código de obra exacto (ej. MAR001, RSAL005)
  const codeMatches: Array<{ code: string; name: string }> = [];
  for (const project of input.availableProjects) {
    const code = project.code.trim();
    const normCode = normalize(code);
    if (code && code.length >= 3 && normCode !== 's/c') {
      const codeRegex = new RegExp(`\\b${normCode}\\b`, 'i');
      if (codeRegex.test(fullText)) {
        codeMatches.push({ code: project.code, name: project.name });
      }
    }
  }

  // Si hay exactamente 1 coincidencia por código, es 100% segura
  if (codeMatches.length === 1) {
    return {
      matchedProjects: codeMatches,
      reasoning: `[Código Exacto] Coincidencia por código de obra: ${codeMatches[0].code}`
    };
  }

  // Lista ampliada de palabras genéricas de ingeniería, gestión y artículos
  // NUNCA deben usarse para emparejar obras por sí solas
  const genericEngineeringAndStopWords = new Set([
    'de', 'la', 'el', 'los', 'las', 'en', 'del', 'y', 'o', 'a', 'al', 'para', 'con', 'por', 'sobre',
    'obra', 'obras', 'proyecto', 'proyectos', 'etapa', 'tramo', 'fase', 'i', 'ii', 'iii', 'iv', 'v',
    'arroyo', 'cuenca', 'rio', 'desagues', 'desague', 'pluvial', 'pluviales', 'adecuacion', 'cauce',
    'aliviador', 'red', 'estacion', 'estaciones', 'bombeo', 'terraplen', 'terraplenes', 'defensa',
    'defensas', 'costero', 'costera', 'restitucion', 'reacondicionamiento', 'alteo', 'conformacion',
    'limpieza', 'ensanche', 'dragado', 'conducto', 'alcantarilla', 'puente', 'pavimentacion',
    'hormigon', 'asfalto', 'entubamiento', 'saneamiento', 'hidraulica', 'hidraulico', 'colector',
    'canal', 'canalizacion', 'informe', 'informes', 'ambiental', 'ambientales', 'social', 'seguimiento',
    'plan', 'gestion', 'estudio', 'denominado', 'localidad', 'partido', 'provincia', 'buenos', 'aires',
    'sector', 'noroeste', 'noreste', 'sureste', 'suroeste', 'puesta', 'valor', 'calle', 'avenida'
  ]);

  const keywordMatches: Array<{ code: string; name: string; matchedKw: string }> = [];

  for (const project of input.availableProjects) {
    // Extraer palabras clave que sean realmente nombres propios de lugares o cuencas
    const properNameKeywords = normalize(project.name)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !genericEngineeringAndStopWords.has(w));

    for (const kw of properNameKeywords) {
      const kwRegex = new RegExp(`\\b${kw}\\b`, 'i');
      if (kwRegex.test(fullText)) {
        keywordMatches.push({ code: project.code, name: project.name, matchedKw: kw });
        break;
      }
    }
  }

  // Si encontramos EXACTAMENTE 1 obra coincidente por nombre propio específico (ej: "Duppy" o "Carhué"),
  // es seguro aceptarla
  if (keywordMatches.length === 1) {
    const singleMatch = keywordMatches[0];
    return {
      matchedProjects: [{ code: singleMatch.code, name: singleMatch.name }],
      reasoning: `[Heurística Rápida] Coincidencia unívoca por lugar: "${singleMatch.matchedKw}"`
    };
  }

  // Si hay más de 1 obra coincidente (ambigüedad) o 0 coincidencias,
  // NO adivinamos: devolvemos null para que Gemini use su comprensión contextual
  return null;
}

export async function matchMailToProject(input: MatchMailInput): Promise<MatchMailOutput> {
  // 1. Intentar primero con heurística determinística estricta (costo $0, instantáneo)
  const quickResult = heuristicMatch(input);
  if (quickResult) {
    console.log(`⚡ [MATCH HEURÍSTICO]: ${quickResult.reasoning}`);
    return quickResult;
  }

  // 2. Si no hay coincidencia unívoca, evaluar ventana nocturna (1 AM - 7 AM hora AR)
  if (isArgentineNightWindow()) {
    console.log(`🌙 [RADAR] Ventana nocturna (1 AM a 7 AM hora AR): LLM en pausa para preservar cuotas.`);
    return {
      matchedProjects: [],
      reasoning: 'Ventana nocturna (1 AM a 7 AM AR): Evaluación por IA en pausa.'
    };
  }

  // 3. Fallback a IA Gemini para desambiguar contexto geográfico
  console.log(`🤖 [MATCH IA]: Correo con potencial ambigüedad o sin código directo, derivando a Gemini...`);
  return await throttledPrompt(input);
}
