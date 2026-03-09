import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiVersion: 'v1beta', // Usamos v1beta porque v1 no soporta esquemas de salida (JSON estructurado) con Genkit actualmente.
    }),
  ],
});

/**
 * Modelo estable utilizado para las operaciones de IA.
 * Se utiliza 'googleai/gemini-1.5-flash' por ser el modelo con mejor soporte
 * para tareas de extracción y estructuración de datos.
 */
export const geminiModel = 'googleai/gemini-1.5-flash';
