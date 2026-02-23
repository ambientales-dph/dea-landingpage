
'use server';

export interface ScieloArticle {
  title: string;
  url: string;
  authors: string[];
  journal: string;
  id: string; // This will be the PID
}

export async function searchScielo(query: string): Promise<ScieloArticle[]> {
  // This service is temporarily disabled.
  return Promise.resolve([]);
}
