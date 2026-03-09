'use server';

/**
 * @fileOverview Defines a Genkit flow for generating a summary of a Trello board.
 * - generateTrelloSummary - A function that takes a user query and board info, and returns a natural language summary.
 * - TrelloSummaryInput - The input type for the flow.
 */

import {ai, geminiModel} from '@/ai/genkit';
import {z} from 'zod';
import {getTrelloBoardSummaryTool} from '@/ai/tools/trello-tool';

const TrelloSummaryInputSchema = z.object({
  topic: z.string().describe("The user's question or topic about the Trello board."),
  boardId: z.string().describe('The ID of the Trello board to query.'),
  boardName: z.string().describe('The descriptive name of the board.'),
});
export type TrelloSummaryInput = z.infer<typeof TrelloSummaryInputSchema>;
  
const trelloSummaryFlow = ai.defineFlow(
  {
    name: 'trelloSummaryFlow',
    inputSchema: TrelloSummaryInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    const promptText = `Eres un asistente de gestión de proyectos experto en analizar tableros de Trello. El usuario quiere un resumen sobre el estado del tablero de Trello llamado '${input.boardName}'.

    Utiliza la herramienta 'getTrelloBoardSummary' con el ID de tablero '${input.boardId}' para obtener la estructura actual del tablero, incluyendo listas y tarjetas.
    
    Basado en los datos devueltos por la herramienta, genera un informe conciso y claro en formato de texto (puedes usar Markdown para títulos y listas). El informe debe incluir:
    1.  Un resumen general del estado del proyecto.
    2.  Una lista de tareas por columna (lista de Trello), destacando las más importantes.
    3.  Un apartado especial para las tarjetas que tengan una fecha de vencimiento ('due date') próxima o vencida.
    
    Responde siempre en español y con un tono profesional y servicial.
    
    La pregunta específica del usuario es: "${input.topic}". Asegúrate de que tu resumen responda a esta pregunta si es posible.`;

    const {output} = await ai.generate({
        model: geminiModel,
        prompt: promptText,
        tools: [getTrelloBoardSummaryTool],
    });

    return output!;
  }
);


export async function generateTrelloSummary(input: TrelloSummaryInput): Promise<string> {
    return trelloSummaryFlow(input);
}
