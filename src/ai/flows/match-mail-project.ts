'use server';

/**
 * @fileOverview Flujo de IA optimizado para vincular correos mediante palabras clave y nombres de lugares.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MatchMailInputSchema = z.object({
  subject: z.string(),
  snippet: z.string(),
  availableProjects: z.array(z.object({
    id: z.string(),
    code: z.string(),
    name: z.string()
  }))
});

export type MatchMailInput = z.infer<typeof MatchMailInputSchema>;

const MatchMailOutputSchema = z.object({
  matchedProjectCode: z.string().nullable().describe('El código del proyecto detectado o null si no hay coincidencia.'),
  matchedProjectName: z.string().nullable().describe('El nombre corto o lugar detectado (ej: Zapiola).'),
  confidence: z.number().describe('Nivel de confianza de 0 a 1.'),
  reasoning: z.string().describe('Breve nota de por qué se vinculó.')
});

export type MatchMailOutput = z.infer<typeof MatchMailOutputSchema>;

const prompt = ai.definePrompt({
  name: 'matchMailProjectPrompt',
  input: { schema: MatchMailInputSchema },
  output: { schema: MatchMailOutputSchema },
  prompt: `Eres un asistente del Departamento de Estudios Ambientales. 
  Tu tarea es vincular un correo con una obra basándote en NOMBRES DE LUGARES, RÍOS o MUNICIPIOS.

  DATOS DEL CORREO:
  Asunto: {{{subject}}}
  Resumen: {{{snippet}}}

  PROYECTOS ACTIVOS (Nombre y Código):
  {{#each availableProjects}}
  - {{name}} [{{code}}]
  {{/each}}

  INSTRUCCIONES:
  1. Ignora los códigos técnicos (como MAR001) a menos que aparezcan explícitamente.
  2. Busca coincidencias entre el texto del mail y los nombres de los proyectos. 
  3. PRIORIZA nombres geográficos: si el mail menciona "Luján", "Salado", "Zapiola", "Matanza", etc., vincúlalo al proyecto cuyo nombre contenga esa palabra.
  4. Si detectas una relación, devuelve el matchedProjectCode y en matchedProjectName pon el nombre del lugar o palabra clave que causó la coincidencia (ej: "Zapiola").
  5. Si no hay una relación geográfica o de nombre clara, devuelve null.

  Devuelve el resultado en JSON.`,
});

export async function matchMailToProject(input: MatchMailInput): Promise<MatchMailOutput> {
  const { output } = await prompt(input);
  return output!;
}
