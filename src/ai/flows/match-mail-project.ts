'use server';

/**
 * @fileOverview Sabueso de IA para vincular mails con obras por nombres de lugares.
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
  matchedProjectCode: z.string().nullable().describe('El código del proyecto detectado.'),
  matchedProjectName: z.string().nullable().describe('El nombre del lugar detectado (ej: Zapiola).'),
  reasoning: z.string().describe('Breve nota de por qué se vinculó.')
});

export type MatchMailOutput = z.infer<typeof MatchMailOutputSchema>;

const prompt = ai.definePrompt({
  name: 'matchMailProjectPrompt',
  input: { schema: MatchMailInputSchema },
  output: { schema: MatchMailOutputSchema },
  prompt: `Actúa como un clasificador geográfico para el Departamento de Estudios Ambientales.
  
  TU MISIÓN:
  Identificar si el correo menciona algún LUGAR, RÍO o MUNICIPIO que coincida con nuestras obras activas.
  
  PROYECTOS ACTUALES:
  {{#each availableProjects}}
  - {{name}} [{{code}}]
  {{/each}}

  DATOS DEL MAIL:
  Asunto: {{{subject}}}
  Resumen: {{{snippet}}}

  REGLAS:
  1. Buscá nombres propios de lugares (ej: Pergamino, Luján, Matanza, Zapiola, El Gato).
  2. Si el mail menciona un lugar que está en el nombre de un proyecto, vinculalo.
  3. No importa el código del proyecto, lo importante es el nombre del lugar.
  4. Si no hay coincidencia geográfica clara, devolvé null en los campos de match.

  Devuelve el resultado en formato JSON.`,
});

export async function matchMailToProject(input: MatchMailInput): Promise<MatchMailOutput> {
  const { output } = await prompt(input);
  return output!;
}
