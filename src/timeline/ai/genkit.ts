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
 * Se actualiza a 'googleai/gemini-2.5-flash' por solicitud del usuario.
 */
export const geminiModel = 'googleai/gemini-2.5-flash';
