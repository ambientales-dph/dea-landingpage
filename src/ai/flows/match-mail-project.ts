'use server';

/**
 * @fileOverview Sabueso de IA para vincular mails con obras por nombres de lugares o códigos.
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
  Identificar a qué obra o proyecto pertenece el correo recibido.
  
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
  1. PRIORIDAD CÓDIGO: Si el mail menciona un código (ej: MAR001, RSAL005), vincúlalo de inmediato.
  2. PRIORIDAD LUGAR: Busca nombres de ciudades, ríos o cuencas (ej: Pergamino, Luján, Matanza, Zapiola, Saladillo).
  3. AMBIGÜEDAD: Si el mail menciona un lugar que pertenece a más de una obra (ej: "La Madrid"), devuelve TODAS las obras que coincidan en el array 'matchedProjects'.
  4. SIN CONTEXTO: Si el mail no dice nada útil (ej: "Te mando el archivo"), busca en el 'threadContext' si se mencionó la obra antes.
  5. Si no hay ninguna coincidencia clara ni en el mail ni en el hilo, devuelve un array vacío en 'matchedProjects'.

  Devuelve el resultado en formato JSON.`,
});

export async function matchMailToProject(input: MatchMailInput): Promise<MatchMailOutput> {
  const { output } = await prompt(input);
  return output!;
}
