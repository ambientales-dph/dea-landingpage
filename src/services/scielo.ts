
'use server';

export interface ScieloArticle {
  title: string;
  url: string;
  authors: string[];
  journal: string;
  id: string; // This will be the PID
}

export async function searchScielo(query: string): Promise<ScieloArticle[]> {
  const searchUrl = `https://www.scielo.org.ar/search/?q=${encodeURIComponent(query)}&lang=es&count=25&output=json&format=summary`;

  try {
    const response = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Firebase-Studio-App-Prototype/1.0',
      },
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      console.error(`Error from SciELO Search API: ${response.status}`, await response.text());
      return [];
    }

    const data = await response.json();
    
    const results = data.results || [];

    if (!Array.isArray(results)) {
        return [];
    }

    return results.map((item: any): ScieloArticle => {
      const pid = item.id || '';
      
      let relativeUrl = item.ur || '';
      // Ensure URL starts with a slash
      if (relativeUrl && !relativeUrl.startsWith('/')) {
          relativeUrl = '/' + relativeUrl;
      }

      return {
        id: pid,
        title: item.t || 'Sin título',
        authors: item.au || ['Autor desconocido'],
        journal: item.ta || 'Publicación desconocida',
        url: `http://www.scielo.org.ar${relativeUrl}`,
      };
    });

  } catch (error) {
    console.error('Failed to fetch from SciELO Search API:', error);
    return [];
  }
}
