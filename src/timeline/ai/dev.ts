import { config } from 'dotenv';
config();

import '@/ai/flows/auto-tag-files.ts';
import '@/ai/flows/generate-trello-summary.ts';
import '@/ai/flows/process-milestones-flow.ts';
