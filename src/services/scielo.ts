'use server';

export interface ScieloArticle {
  title: string;
  url: string;
  authors: string[];
  journal: string;
  id: string;
}

export async function searchScielo(query: string): Promise<ScieloArticle[]> {
  const url = `https://search.scielo.org/api/v1/search/?q=${encodeURIComponent(query)}&count=10`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Firebase-Studio-App-Prototype/1.0',
      },
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Error from SciELO API: ${response.status}`, errorBody);
      return [];
    }

    const data = await response.json();
    const records = data?.results || [];

    if (!Array.isArray(records)) {
        return [];
    }

    return records.map((record: any): ScieloArticle => {
      return {
        title: record.title || 'Sin título',
        url: record.url || '#',
        authors: record.authors || ['Autor desconocido'],
        journal: record.journal || 'Publicación desconocida',
        id: record.id || '',
      };
    });

  } catch (error) {
    console.error('Failed to fetch from SciELO API:', error);
    return [];
  }
}
