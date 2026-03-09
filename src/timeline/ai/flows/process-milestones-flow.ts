'use server';

/**
 * @fileOverview Flujo de Genkit para procesar tablas de hitos desde texto.
 */

import { ai, geminiModel } from '@/ai/genkit';
import { z } from 'genkit';

const MilestoneExtractionInputSchema = z.object({
  textData: z.string().describe('El texto que contiene la tabla o datos de los hitos.'),
  categories: z.array(z.object({
    id: z.string(),
    name: z.string(),
  })).describe('Lista de categorías disponibles para clasificar los hitos.'),
});

export type MilestoneExtractionInput = z.infer<typeof MilestoneExtractionInputSchema>;

const ProposedMilestoneSchema = z.object({
  name: z.string().describe('Nombre del hito.'),
  description: z.string().describe('Descripción o contexto del hito.'),
  occurredAt: z.string().describe('Fecha en formato ISO 8601.'),
  categoryId: z.string().describe('ID de la categoría sugerida.'),
  tags: z.array(z.string()).describe('Etiquetas sugeridas.'),
});

const MilestoneExtractionOutputSchema = z.array(ProposedMilestoneSchema);
export type MilestoneExtractionOutput = z.infer<typeof MilestoneExtractionOutputSchema>;

export async function processTableMilestones(input: MilestoneExtractionInput): Promise<MilestoneExtractionOutput> {
  return processTableMilestonesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'processTableMilestonesPrompt',
  model: geminiModel,
  input: { schema: MilestoneExtractionInputSchema },
  output: { schema: MilestoneExtractionOutputSchema },
  prompt: `Eres un asistente experto en gestión de proyectos de ingeniería y medio ambiente. 
  Tu tarea es extraer hitos de una tabla o texto proporcionado por el usuario.
  
  Instrucciones:
  1. Analiza el texto proporcionado: "{{{textData}}}"
  2. Identifica cada hito (mínimo nombre, fecha y descripción).
  3. Clasifica cada hito en UNA de las siguientes categorías disponibles:
     {{#each categories}}
     - ID: {{id}}, Nombre: {{name}}
     {{/each}}
  4. Si no estás seguro de la categoría, usa la que mejor se adapte según el título o la descripción.
  5. Asegúrate de que las fechas estén en formato ISO (YYYY-MM-DD).
  6. Genera etiquetas relevantes para cada hito.
  
  Devuelve un array de objetos JSON con la estructura solicitada.`,
});

const processTableMilestonesFlow = ai.defineFlow(
  {
    name: 'processTableMilestonesFlow',
    inputSchema: MilestoneExtractionInputSchema,
    outputSchema: MilestoneExtractionOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
