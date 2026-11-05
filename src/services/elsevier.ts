'use server';

export interface ElsevierArticle {
  title: string;
  url: string;
  authors: string;
  publicationName: string;
  doi: string;
}

export async function searchElsevier(query: string): Promise<ElsevierArticle[]> {
  const apiKey = process.env.ELSEVIER_API_KEY;

  // 1. Intento directo a la API de Scopus/Elsevier SIN restricciones geográficas forzadas
  if (apiKey && apiKey !== 'your_key_here') {
    const url = `https://api.elsevier.com/content/search/scopus?query=${encodeURIComponent(query)}&view=STANDARD&count=25`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'X-ELS-APIKey': apiKey,
        },
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const entries = data['search-results']?.entry || [];

        const validEntries = entries.filter((e: any) => !e.error && e['dc:title']);
        if (validEntries.length > 0) {
          return validEntries.map((entry: any): ElsevierArticle => {
            let authors = 'Autor desconocido';
            const creator = entry['dc:creator'];

            if (creator) {
              const authorNames: string[] = [];
              const authorsArray = Array.isArray(creator) ? creator : [creator];

              authorsArray.forEach((author: any) => {
                if (author && typeof author === 'object' && author['$']) {
                  authorNames.push(author['$']);
                } else if (typeof author === 'string') {
                  authorNames.push(author);
                }
              });

              if (authorNames.length > 0) {
                authors = authorNames.join(', ');
              }
            }

            return {
              title: entry['dc:title'] || 'Sin título',
              url: entry['prism:doi'] ? `https://doi.org/${entry['prism:doi']}` : '#',
              authors,
              publicationName: entry['prism:publicationName'] || 'Elsevier / ScienceDirect',
              doi: entry['prism:doi'] || '',
            };
          });
        }
      }
    } catch {
      // Si la API Key de Elsevier caducó o hay error de red, usamos el catálogo directo de Elsevier (P4310320990 / DOI 10.1016)
    }
  }

  // 2. Consulta directa al catálogo de publicaciones de Elsevier / ScienceDirect (sin restricciones de API Key)
  try {
    const oaUrl = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&filter=primary_location.source.publisher_lineage:p4310320990&per-page=25&mailto=ambientales.dph@gmail.com`;
    const res = await fetch(oaUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'DEA-Portal/1.0 (mailto:ambientales.dph@gmail.com)',
      },
      cache: 'no-store',
    });

    if (!res.ok) return [];
    const data = await res.json();
    const results = data.results || [];

    return results.map((work: any): ElsevierArticle => {
      const authorNames =
        work.authorships
          ?.map((a: any) => a.author?.display_name)
          .filter(Boolean)
          .slice(0, 6) || [];

      const rawDoi = work.doi ? String(work.doi).replace(/^https?:\/\/doi\.org\//i, '') : '';
      const bestUrl =
        work.doi ||
        work.primary_location?.landing_page_url ||
        work.open_access?.oa_url ||
        `https://openalex.org/${work.id}`;

      return {
        title: work.title || work.display_name || 'Sin título',
        url: bestUrl,
        authors: authorNames.length > 0 ? authorNames.join(', ') : 'Autor desconocido',
        publicationName:
          work.primary_location?.source?.display_name || 'Elsevier / ScienceDirect',
        doi: rawDoi || work.id,
      };
    });
  } catch (error) {
    console.error('Error al consultar catálogo de Elsevier:', error);
    return [];
  }
}
