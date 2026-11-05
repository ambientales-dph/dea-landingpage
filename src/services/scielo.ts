'use server';

export interface ScieloArticle {
  title: string;
  url: string;
  authors: string[];
  journal: string;
  id: string;
}

/**
 * Busca artículos científicos en español y portugués de la red iberoamericana / SciELO y revistas regionales de acceso abierto.
 */
export async function searchScielo(query: string): Promise<ScieloArticle[]> {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&filter=language:es|pt&per-page=25&mailto=ambientales.dph@gmail.com`;

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

    return results.map((work: any): ScieloArticle => {
      const authors =
        work.authorships
          ?.map((a: any) => a.author?.display_name)
          .filter(Boolean)
          .slice(0, 6) || [];

      const bestUrl =
        work.open_access?.oa_url ||
        work.primary_location?.landing_page_url ||
        work.doi ||
        `https://openalex.org/${work.id}`;

      return {
        title: work.title || work.display_name || 'Sin título',
        url: bestUrl,
        authors: authors.length > 0 ? authors : ['Autor desconocido'],
        journal:
          work.primary_location?.source?.display_name || 'Revista Científica Iberoamericana (SciELO / OA)',
        id: work.id || bestUrl,
      };
    });
  } catch (error) {
    console.error('Error al consultar SciELO / Iberoamérica:', error);
    return [];
  }
}
