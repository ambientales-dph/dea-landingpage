'use server';

export interface EuropePMCArticle {
  id: string;
  title: string;
  url: string;
  authors: string[];
  publication: string;
}

/**
 * Busca artículos científicos en Europe PMC / PubMed Central (Ciencias Ambientales, Salud, Ecología y Biología).
 */
export async function searchEuropePMC(query: string): Promise<EuropePMCArticle[]> {
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=25`;

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
    const results = data.resultList?.result || [];

    return results.map((item: any): EuropePMCArticle => {
      const authors = item.authorString
        ? String(item.authorString)
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
        : ['Autor desconocido'];

      const articleUrl = item.doi
        ? `https://doi.org/${item.doi}`
        : item.pmcid
        ? `https://europepmc.org/article/PMC/${item.pmcid}`
        : `https://europepmc.org/article/${item.source || 'MED'}/${item.id}`;

      const journal = item.journalTitle || 'Europe PMC / PubMed';

      return {
        id: item.id || articleUrl,
        title: item.title || 'Sin título',
        url: articleUrl,
        authors,
        publication: item.pubYear ? `${journal} (${item.pubYear})` : journal,
      };
    });
  } catch (error) {
    console.error('Error al consultar Europe PMC:', error);
    return [];
  }
}

