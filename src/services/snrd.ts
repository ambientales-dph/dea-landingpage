'use server';

export interface SNRDArticle {
  title: string;
  url: string;
  authors: string[];
  publication: string;
  handle: string;
}

export async function searchSNRD(query: string): Promise<SNRDArticle[]> {
  // Simplificamos la consulta para no ser excesivamente restrictivos.
  // Anteriormente, se forzaba una intersección con "Buenos Aires" y categorías técnicas fijas,
  // lo que eliminaba una gran cantidad de bibliografía relevante que no contenía esos términos exactos en sus metadatos.
  const finalQuery = query;

  const url = `https://repositoriosdigitales.mincyt.gob.ar/vufind/api/v1/search?lookfor=${encodeURIComponent(finalQuery)}&type=AllFields&field[]=id&field[]=title&field[]=authors&field[]=publicationDates&limit=150`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DEA-App/1.0 (mailto:ambientales.dph@gmail.com)',
      },
      next: { revalidate: 3600 } // Cache por 1 hora
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Error de la API de SNRD: ${response.status}`, errorBody);
      return [];
    }

    const data = await response.json();
    const records = data?.records || [];

    if (!Array.isArray(records)) {
        return [];
    }

    return records.map((record: any): SNRDArticle | null => {
      const handle = record.id;
      if (!handle) return null;

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
    }).filter((article: any): article is SNRDArticle => article !== null);

  } catch (error) {
    console.error('Error al obtener datos de SNRD:', error);
    return [];
  }
}
