'use server';

/**
 * @fileOverview This file defines a Genkit flow for determining the relevance of a testimonial given a visitor's activity.
 *
 * - `determineReviewRelevance` - A function that takes visitor activity and a testimonial as input and returns a relevance score.
 * - `ReviewRelevanceInput` - The input type for the `determineReviewRelevance` function.
 * - `ReviewRelevanceOutput` - The return type for the `determineReviewRelevance` function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ReviewRelevanceInputSchema = z.object({
  visitorActivity: z
    .string()
    .describe(
      'A description of the visitor activity on the website, including pages visited, time spent, and actions taken.'
    ),
  testimonial: z.string().describe('The text content of the testimonial.'),
});
export type ReviewRelevanceInput = z.infer<typeof ReviewRelevanceInputSchema>;

const ReviewRelevanceOutputSchema = z.object({
  relevanceScore: z
    .number()
    .describe(
      'A numerical score (0-100) indicating the relevance of the testimonial to the visitor activity. Higher score indicates higher relevance.'
    ),
  reason: z
    .string()
    .describe(
      'Explanation of why the testimonial is relevant to the visitor activity.'
    ),
});
export type ReviewRelevanceOutput = z.infer<typeof ReviewRelevanceOutputSchema>;

export async function determineReviewRelevance(
  input: ReviewRelevanceInput
): Promise<ReviewRelevanceOutput> {
  return determineReviewRelevanceFlow(input);
}

const reviewRelevancePrompt = ai.definePrompt({
  name: 'reviewRelevancePrompt',
  input: {schema: ReviewRelevanceInputSchema},
  output: {schema: ReviewRelevanceOutputSchema},
  prompt: `You are an expert in understanding user behavior and the impact of testimonials.

You are given a description of a visitor\'s activity on a website and a customer testimonial.

Your task is to determine the relevance of the testimonial to the visitor\'s activity and assign a relevance score between 0 and 100.

Provide a reason for the assigned score.

Visitor Activity: {{{visitorActivity}}}

Testimonial: {{{testimonial}}}

Consider factors like the visitor\'s interests, the problems they are trying to solve, and the solutions offered in the testimonial.

Output a JSON object with the relevanceScore and reason fields.
`,
});

const determineReviewRelevanceFlow = ai.defineFlow(
  {
    name: 'determineReviewRelevanceFlow',
    inputSchema: ReviewRelevanceInputSchema,
    outputSchema: ReviewRelevanceOutputSchema,
  },
  async input => {
    const {output} = await reviewRelevancePrompt(input);
    return output!;
  }
);
