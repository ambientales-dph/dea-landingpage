'use server';

export interface SNRDArticle {
  title: string;
  url: string;
  authors: string[];
  publication: string;
  handle: string;
}

export async function searchSNRD(query: string): Promise<SNRDArticle[]> {
  // This is the correct API endpoint, derived from the Swagger documentation the user provided.
  const url = `https://repositoriosdigitales.mincyt.gob.ar/vufind/api/v1/search?lookfor=${encodeURIComponent(query)}&type=AllFields&field[]=authors&field[]=publicationDates&limit=10`;

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
      console.error(`Error from SNRD API: ${response.status}`, errorBody);
      return [];
    }

    const data = await response.json();
    const records = data?.records || [];

    if (!Array.isArray(records)) {
        return [];
    }

    return records.map((record: any): SNRDArticle => {
      const handle = record.id;
      const resourceUrl = `https://repositoriosdigitales.mincyt.gob.ar/vufind/Record/${handle}`;
      
      let authors: string[] = [];
      if (record.authors?.primary) {
          authors = Object.keys(record.authors.primary);
      } else if (record.authors?.secondary) {
          authors = Object.keys(record.authors.secondary);
      } else {
          authors = ['Autor desconocido'];
      }

      return {
        title: record.title || 'Sin título',
        url: resourceUrl,
        authors: authors,
        publication: record.publicationDates?.[0] || 'Publicación desconocida',
        handle: handle || '',
      };
    });

  } catch (error) {
    console.error('Failed to fetch from SNRD API:', error);
    return [];
  }
}
