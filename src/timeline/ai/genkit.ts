import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI({
      apiVersion: 'v1beta', // Usamos v1beta para soporte de esquemas de salida.
    }),
  ],
});

/**
 * Modelo estable utilizado para las operaciones de IA.
 * Se actualiza a 'googleai/gemini-3.5-flash-lite'.
 */
export const geminiModel = 'googleai/gemini-3.5-flash-lite';
