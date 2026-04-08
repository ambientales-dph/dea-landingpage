'use server';

export interface SNRDArticle {
  title: string;
  url: string;
  authors: string[];
  publication: string;
  handle: string;
}

/**
 * Busca artículos en el Sistema Nacional de Repositorios Digitales (SNRD) de Argentina.
 * Utiliza la API de VuFind del Ministerio de Ciencia, Tecnología e Innovación.
 */
export async function searchSNRD(query: string): Promise<SNRDArticle[]> {
  // Simplificamos al máximo los parámetros para asegurar compatibilidad y cobertura
  const url = `https://repositoriosdigitales.mincyt.gob.ar/vufind/api/v1/search?lookfor=${encodeURIComponent(query)}&type=AllFields&limit=100&sort=relevance`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      next: { revalidate: 3600 } // Cache por 1 hora
    });

    if (!response.ok) {
      console.error(`Error de la API de SNRD: ${response.status}`);
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
      
      const authors: string[] = [];
      if (record.authors) {
          // El formato de autores de VuFind puede venir como objeto o array dependiendo del registro
          const primary = record.authors.primary || {};
          const secondary = record.authors.secondary || {};
          
          const primaryNames = Array.isArray(primary) ? primary : Object.keys(primary);
          const secondaryNames = Array.isArray(secondary) ? secondary : Object.keys(secondary);
          
          authors.push(...primaryNames, ...secondaryNames);
      }
      
      if (authors.length === 0) {
          authors.push('Autor desconocido');
      }

      return {
        title: record.title || 'Sin título',
        url: resourceUrl,
        authors: authors,
        publication: record.publicationDates?.[0] || record.publisher || 'Publicación desconocida',
        handle: handle,
      };
    }).filter((article: any): article is SNRDArticle => article !== null);

  } catch (error) {
    console.error('Error al obtener datos de SNRD:', error);
    return [];
  }
}
