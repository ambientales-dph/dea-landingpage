'use server';
/**
 * @fileOverview Defines a Genkit tool for interacting with the Trello API.
 * - getTrelloBoardSummaryTool - A tool that fetches a summary of a Trello board.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import {getBoardSummary} from '@/services/trello';

export const getTrelloBoardSummaryTool = ai.defineTool(
  {
    name: 'getTrelloBoardSummary',
    description: 'Get a summary of a Trello board, including its lists and open cards. Use this to get the status of projects managed in Trello.',
    inputSchema: z.object({
      boardId: z.string().describe('The ID of the Trello board to summarize.'),
    }),
    outputSchema: z.any(),
  },
  async ({boardId}) => {
    return await getBoardSummary(boardId);
  }
);
