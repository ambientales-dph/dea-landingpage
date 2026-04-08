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
  // Utilizamos el endpoint de búsqueda general de la API de VuFind
  const url = `https://repositoriosdigitales.mincyt.gob.ar/vufind/api/v1/search?lookfor=${encodeURIComponent(query)}&type=AllFields&limit=50&sort=relevance`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
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
      const id = record.id;
      if (!id) return null;

      // La URL pública de visualización no suele llevar /vufind/ en el medio
      const resourceUrl = `https://repositoriosdigitales.mincyt.gob.ar/Record/${id}`;
      
      // Los autores en VuFind pueden venir de diversas formas (string, array, u objeto)
      let authors: string[] = [];
      if (record.authors) {
          const parseAuthorObject = (obj: any) => {
              if (Array.isArray(obj)) return obj;
              if (typeof obj === 'object' && obj !== null) return Object.keys(obj);
              return [];
          };
          
          authors = [
              ...parseAuthorObject(record.authors.primary),
              ...parseAuthorObject(record.authors.secondary)
          ].filter(Boolean);
      }
      
      if (authors.length === 0) {
          authors.push('Autor desconocido');
      }

      // El nombre de la publicación suele estar en publisher o journal
      const publication = 
        (Array.isArray(record.publisher) ? record.publisher[0] : record.publisher) || 
        (Array.isArray(record.containerTitle) ? record.containerTitle[0] : record.containerTitle) ||
        'Publicación desconocida';

      return {
        title: record.title || 'Sin título',
        url: resourceUrl,
        authors: authors,
        publication: String(publication),
        handle: id,
      };
    }).filter((article): article is SNRDArticle => article !== null);

  } catch (error) {
    console.error('Error al obtener datos de SNRD:', error);
    return [];
  }
}
