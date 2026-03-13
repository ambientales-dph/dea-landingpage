
'use server';

/**
 * @fileOverview Flujo de IA para vincular correos electrónicos con proyectos de hidráulica.
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
  matchedProjectCode: z.string().nullable().describe('El código del proyecto detectado (ej: MAR001) o null si no hay coincidencia clara.'),
  matchedProjectId: z.string().nullable().describe('El ID de Trello del proyecto detectado.'),
  confidence: z.number().describe('Nivel de confianza de 0 a 1.'),
  reasoning: z.string().describe('Breve explicación de por qué se vinculó con ese proyecto.')
});

export type MatchMailOutput = z.infer<typeof MatchMailOutputSchema>;

const prompt = ai.definePrompt({
  name: 'matchMailProjectPrompt',
  input: { schema: MatchMailInputSchema },
  output: { schema: MatchMailOutputSchema },
  prompt: `Eres un asistente administrativo del Departamento de Estudios Ambientales. 
  Tu tarea es analizar un correo electrónico y determinar si se refiere a una de las obras hidráulicas activas.

  DATOS DEL CORREO:
  Asunto: {{{subject}}}
  Resumen: {{{snippet}}}

  LISTADO DE PROYECTOS DISPONIBLES (Código e ID):
  {{#each availableProjects}}
  - [{{code}}] {{name}} (ID: {{id}})
  {{/each}}

  INSTRUCCIONES:
  1. Busca menciones directas del código del proyecto (ej: "MAR001") en el asunto o cuerpo.
  2. Si no hay código, busca nombres de localidades o ríos que coincidan con los nombres de los proyectos (ej: si el mail habla de "Zapiola", vincúlalo con el proyecto que tenga "Zapiola" en su nombre).
  3. Si la relación es ambigua o no hay ninguna pista, devuelve null en matchedProjectCode.
  4. Sé estricto: si no hay relación clara, no inventes una coincidencia.

  Devuelve el resultado en formato JSON.`,
});

export async function matchMailToProject(input: MatchMailInput): Promise<MatchMailOutput> {
  const { output } = await prompt(input);
  return output!;
}
