import { config } from 'dotenv';
config();

import '@/timeline/ai/flows/auto-tag-files.ts';
import '@/timeline/ai/flows/generate-trello-summary.ts';
import '@/timeline/ai/flows/process-milestones-flow.ts';