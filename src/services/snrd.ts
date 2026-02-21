'use server';

export interface SNRDArticle {
  title: string;
  url: string;
  authors: string[];
  publication: string;
  handle: string;
}

export async function searchSNRD(query: string): Promise<SNRDArticle[]> {
  const keywords = [
    '"ciencias ambientales"', 'geología', 'geomorfología', 'hidráulica',
    'hidrología', 'cuencas', '"manejo del agua"', '"química ambiental"',
    '"ingeniería ambiental"', 'antropología', 'biología', 'botánica',
    'zoología', 'ecología', 'clima'
  ];
  const keywordFilter = keywords.join(' OR ');
  const finalQuery = `(${query}) AND (${keywordFilter})`;

  const url = `https://repositoriosdigitales.mincyt.gob.ar/vufind/api/v1/search?lookfor=${encodeURIComponent(finalQuery)}&type=AllFields&field[]=id&field[]=title&field[]=authors&field[]=publicationDates&limit=300`;

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
      if (!handle) return null; // Skip records without an ID/handle

      const resourceUrl = `https://repositoriosdigitales.mincyt.gob.ar/vufind/Record/${handle}`;
      
      let authors: string[] = [];
      if (record.authors) {
          if (record.authors.primary) {
              authors = authors.concat(Object.keys(record.authors.primary));
          }
          if (record.authors.secondary) {
              authors = authors.concat(Object.keys(record.authors.secondary));
          }
      }
      
      if (authors.length === 0) {
          authors = ['Autor desconocido'];
      }

      return {
        title: record.title || 'Sin título',
        url: resourceUrl,
        authors: authors,
        publication: record.publicationDates?.[0] || 'Publicación desconocida',
        handle: handle,
      };
    }).filter((article): article is SNRDArticle => article !== null);

  } catch (error) {
    console.error('Failed to fetch from SNRD API:', error);
    return [];
  }
}
