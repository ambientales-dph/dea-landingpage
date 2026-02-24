'use server';

export interface CrossrefArticle {
  title: string;
  url: string;
  authors: string[];
  publication: string;
  doi: string;
}

export async function searchCrossref(query: string): Promise<CrossrefArticle[]> {
  // Adding the user's email to the mailto parameter as a good practice for using the Crossref API.
  const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(query)}&rows=25&mailto=ambientales.dph@gmail.com`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DEA-App/1.0 (mailto:ambientales.dph@gmail.com)',
      },
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      console.error(`Error from Crossref API: ${response.status} ${await response.text()}`);
      return [];
    }

    const data = await response.json();
    const items = data.message?.items || [];

    return items.map((item: any): CrossrefArticle => {
      const authors = item.author?.map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()).filter(Boolean);
      
      return {
        title: item.title?.[0] || 'Sin título',
        url: item.URL || `https://doi.org/${item.DOI}`,
        authors: authors?.length > 0 ? authors : ['Autor desconocido'],
        publication: item['container-title']?.[0] || 'Publicación desconocida',
        doi: item.DOI || '',
      };
    });
  } catch (error) {
    console.error('Failed to fetch from Crossref API:', error);
    return [];
  }
}
