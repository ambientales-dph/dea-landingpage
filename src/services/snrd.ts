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
  // Endpoint de búsqueda general de la API de VuFind del MinCyT
  const url = `https://repositoriosdigitales.mincyt.gob.ar/vufind/api/v1/search?lookfor=${encodeURIComponent(query)}&type=AllFields&limit=50&sort=relevance`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        // Encabezados más robustos para evitar bloqueos del servidor institucional
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Cache-Control': 'no-cache',
      },
      next: { revalidate: 3600 } 
    });

    if (!response.ok) {
      console.error(`Error de la API de SNRD: ${response.status} ${response.statusText}`);
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

      // URL pública de visualización en el portal nacional
      const resourceUrl = `https://repositoriosdigitales.mincyt.gob.ar/Record/${id}`;
      
      // Extracción profunda de autores (pueden venir en varios formatos en VuFind)
      let authorList: string[] = [];
      
      if (record.authors) {
          const { primary, secondary, corporate } = record.authors;
          
          const process = (obj: any) => {
              if (!obj) return [];
              if (Array.isArray(obj)) return obj;
              if (typeof obj === 'object') return Object.keys(obj);
              return [String(obj)];
          };

          authorList = [
              ...process(primary),
              ...process(secondary),
              ...process(corporate)
          ].filter(Boolean);
      }
      
      if (authorList.length === 0) {
          authorList.push('Autor o Institución desconocida');
      }

      // El nombre de la publicación suele estar en publisher o containerTitle
      const publication = 
        (Array.isArray(record.publisher) ? record.publisher[0] : record.publisher) || 
        (Array.isArray(record.containerTitle) ? record.containerTitle[0] : record.containerTitle) ||
        'Registro Nacional (SNRD)';

      return {
        title: record.title || 'Sin título',
        url: resourceUrl,
        authors: authorList,
        publication: String(publication),
        handle: id,
      };
    }).filter((article): article is SNRDArticle => article !== null);

  } catch (error: any) {
    console.error('Error crítico al conectar con SNRD:', error.message);
    return [];
  }
}
