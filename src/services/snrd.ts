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
 * Utiliza la API de VuFind del MINCyT con timeout corto y respaldo automático en el índice
 * de producción científica de instituciones argentinas (CONICET, UNLP, UBA, CIC, INTA, etc.).
 */
export async function searchSNRD(query: string): Promise<SNRDArticle[]> {
  const url = `https://repositoriosdigitales.mincyt.gob.ar/vufind/api/v1/search?lookfor=${encodeURIComponent(query)}&type=AllFields&limit=25`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const rawRecords = data.records || (data.data && data.data.records) || [];

      if (Array.isArray(rawRecords) && rawRecords.length > 0) {
        const parsed = rawRecords
          .map((record: any): SNRDArticle | null => {
            const id = record.id;
            if (!id) return null;

            let authors: string[] = [];
            if (record.authors && typeof record.authors === 'object') {
              const primary = record.authors.primary ? Object.keys(record.authors.primary) : [];
              const secondary = record.authors.secondary ? Object.keys(record.authors.secondary) : [];
              authors = [...primary, ...secondary];
            }

            if (authors.length === 0) authors.push('Autor o Institución Nacional');

            const publication =
              record.publisher?.[0] || record.containerTitle?.[0] || 'Repositorio Nacional (SNRD)';

            return {
              title: record.title || 'Sin título',
              url: `https://repositoriosdigitales.mincyt.gob.ar/Record/${id}`,
              authors,
              publication: String(publication),
              handle: id,
            };
          })
          .filter((article): article is SNRDArticle => article !== null);

        if (parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch {
    // Si el servidor VuFind del MINCyT no responde o da timeout, continuamos con el índice nacional AR
  }

  // Respaldo activo: Producción científica de instituciones argentinas (CONICET, UNLP, UBA, CIC, etc.)
  try {
    const arUrl = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&filter=authorships.countries:countries/AR&per-page=25&mailto=ambientales.dph@gmail.com`;
    const arRes = await fetch(arUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'DEA-Portal/1.0 (mailto:ambientales.dph@gmail.com)',
      },
      cache: 'no-store',
    });

    if (!arRes.ok) return [];
    const arData = await arRes.json();
    const results = arData.results || [];

    return results.map((work: any): SNRDArticle => {
      const authors =
        work.authorships
          ?.map((a: any) => a.author?.display_name)
          .filter(Boolean)
          .slice(0, 6) || [];

      const arInstitutions =
        work.authorships
          ?.flatMap((a: any) => a.institutions || [])
          .filter((inst: any) => inst.country_code === 'AR')
          .map((inst: any) => inst.display_name)
          .filter(Boolean) || [];

      const uniqueInst = Array.from(new Set(arInstitutions));
      const sourceName =
        work.primary_location?.source?.display_name ||
        uniqueInst[0] ||
        'Repositorio / Institución Científica Argentina';

      const pubLabel =
        uniqueInst.length > 0 && !sourceName.includes(uniqueInst[0])
          ? `${sourceName} (${uniqueInst[0]})`
          : sourceName;

      const bestUrl =
        work.open_access?.oa_url ||
        work.primary_location?.landing_page_url ||
        work.doi ||
        `https://openalex.org/${work.id}`;

      return {
        title: work.title || work.display_name || 'Sin título',
        url: bestUrl,
        authors: authors.length > 0 ? authors : ['Investigadores Argentinos'],
        publication: pubLabel,
        handle: work.id || bestUrl,
      };
    });
  } catch (fallbackErr: any) {
    console.error('Error en consulta de repositorios nacionales:', fallbackErr.message);
    return [];
  }
}
