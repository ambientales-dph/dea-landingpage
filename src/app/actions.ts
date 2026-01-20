// src/app/actions.ts
'use server';
import { z } from 'zod';
import { determineReviewRelevance } from '@/ai/flows/review-relevance';

// Contact Form
const contactFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email.' }),
  message: z.string().min(10, { message: 'Message must be at least 10 characters.' }),
});

export async function submitContactForm(values: z.infer<typeof contactFormSchema>) {
  const parsed = contactFormSchema.safeParse(values);

  if (!parsed.success) {
    return { success: false, message: 'Invalid form data.' };
  }

  // In a real app, you'd send an email, save to a DB, etc.
  console.log('New contact form submission:', parsed.data);
  // Simulate some processing time
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Always return success for this demo
  return { success: true, message: 'Message sent successfully.' };
}

// Testimonial Relevance
export async function getRelevance(visitorActivity: string, testimonial: string) {
  try {
    const result = await determineReviewRelevance({ visitorActivity, testimonial });
    return result;
  } catch (error) {
    console.error('Error determining review relevance:', error);
    // Return a low score or handle error appropriately
    return { relevanceScore: 0, reason: 'Error processing relevance.' };
  }
}
