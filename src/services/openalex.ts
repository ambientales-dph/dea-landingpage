'use server';

export interface OpenAlexArticle {
  id: string;
  title: string;
  url: string;
  authors: string[];
  publication: string;
  year?: number;
}

/**
 * Busca en OpenAlex (Catálogo Científico Global de 250M+ de artículos y repositorios académicos).
 */
export async function searchOpenAlex(query: string): Promise<OpenAlexArticle[]> {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=25&mailto=ambientales.dph@gmail.com`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'DEA-Portal/1.0 (mailto:ambientales.dph@gmail.com)',
      },
      cache: 'no-store',
    });

    if (!response.ok) return [];
    const data = await response.json();
    const results = data.results || [];

    return results.map((work: any): OpenAlexArticle => {
      const authors =
        work.authorships
          ?.map((a: any) => a.author?.display_name)
          .filter(Boolean)
          .slice(0, 6) || [];

      const bestUrl =
        work.open_access?.oa_url ||
        work.doi ||
        work.primary_location?.landing_page_url ||
        `https://openalex.org/${work.id}`;

      const source =
        work.primary_location?.source?.display_name || 'OpenAlex Scientific Catalog';

      return {
        id: work.id || bestUrl,
        title: work.title || work.display_name || 'Sin título',
        url: bestUrl,
        authors: authors.length > 0 ? authors : ['Autor desconocido'],
        publication: work.publication_year ? `${source} (${work.publication_year})` : source,
        year: work.publication_year,
      };
    });
  } catch (error) {
    console.error('Error al consultar OpenAlex:', error);
    return [];
  }
}

