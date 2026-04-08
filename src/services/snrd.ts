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
  // Endpoint de búsqueda optimizado para la API institucional
  const url = `https://repositoriosdigitales.mincyt.gob.ar/vufind/api/v1/search?lookfor=${encodeURIComponent(query)}&type=AllFields&limit=25`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      cache: 'no-store' // Forzamos búsqueda fresca para evitar resultados vacíos cacheados
    });

    if (!response.ok) {
      console.error(`SNRD API Error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    // La API de VuFind puede devolver los registros en la raíz o bajo una propiedad 'records'
    const rawRecords = data.records || (data.data && data.data.records) || [];

    if (!Array.isArray(rawRecords)) {
        return [];
    }

    return rawRecords.map((record: any): SNRDArticle | null => {
      const id = record.id;
      if (!id) return null;

      // Procesamiento de autores: extraemos nombres de forma segura
      let authors: string[] = [];
      if (record.authors && typeof record.authors === 'object') {
          const primary = record.authors.primary ? Object.keys(record.authors.primary) : [];
          const secondary = record.authors.secondary ? Object.keys(record.authors.secondary) : [];
          authors = [...primary, ...secondary];
      }
      
      if (authors.length === 0) authors.push('Autor o Institución desconocida');

      // Determinamos la publicación o repositorio de origen
      const publication = record.publisher?.[0] || record.containerTitle?.[0] || 'Repositorio Nacional (SNRD)';

      return {
        title: record.title || 'Sin título',
        url: `https://repositoriosdigitales.mincyt.gob.ar/Record/${id}`,
        authors: authors,
        publication: String(publication),
        handle: id,
      };
    }).filter((article): article is SNRDArticle => article !== null);

  } catch (error: any) {
    console.error('Error crítico en conexión SNRD:', error.message);
    return [];
  }
}
