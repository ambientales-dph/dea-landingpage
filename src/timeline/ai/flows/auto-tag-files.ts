'use server';

/**
 * @fileOverview Este archivo define un flujo de Genkit para etiquetar automáticamente contenido de texto usando IA.
 *
 * - autoTagFiles - Una función que toma un array de textos y devuelve etiquetas sugeridas para cada uno.
 * - AutoTagFilesInput - El tipo de entrada para la función autoTagFiles.
 * - AutoTagFilesOutput - El tipo de retorno para la función autoTagFiles.
 */

import {ai, geminiModel} from '@/ai/genkit';
import {z} from 'genkit';

const TaggingRequestSchema = z.object({
  id: z.string().describe('El identificador único del hito.'),
  textToAnalyze: z
    .string()
    .describe('El texto a analizar para generar etiquetas.'),
});

const AutoTagFilesInputSchema = z.array(TaggingRequestSchema);
export type AutoTagFilesInput = z.infer<typeof AutoTagFilesInputSchema>;

const TaggedItemSchema = z.object({
    id: z.string().describe('El identificador único del hito original.'),
    tags: z
      .array(z.string())
      .describe('Un array de etiquetas sugeridas para el texto.'),
});

const AutoTagFilesOutputSchema = z.array(TaggedItemSchema);
export type AutoTagFilesOutput = z.infer<typeof AutoTagFilesOutputSchema>;

export async function autoTagFiles(input: AutoTagFilesInput): Promise<AutoTagFilesOutput> {
  if (input.length === 0) {
    return [];
  }
  return autoTagFilesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'autoTagFilesPrompt',
  model: geminiModel,
  input: {schema: AutoTagFilesInputSchema},
  output: {schema: AutoTagFilesOutputSchema},
  prompt: `Eres un experto en etiquetar documentos técnicos y administrativos relacionados a obras de ingeniería y medio ambiente.

  A continuación recibirás un array de objetos JSON, cada uno con un 'id' y un 'textToAnalyze'.
  Para cada objeto, analiza el 'textToAnalyze' y sugiere entre 3 y 5 etiquetas relevantes. Las etiquetas deben ser concisas, en minúsculas y descriptivas.

  Devuelve un array de objetos JSON. Cada objeto debe contener el 'id' original del hito y un array de 'tags' con las etiquetas que has generado para él.
  
  Aquí están los hitos a analizar:
  {{{json input}}}
  `,
});

const autoTagFilesFlow = ai.defineFlow(
  {
    name: 'autoTagFilesFlow',
    inputSchema: AutoTagFilesInputSchema,
    outputSchema: AutoTagFilesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
