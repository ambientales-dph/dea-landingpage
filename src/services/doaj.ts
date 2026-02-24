'use server';

export interface DoajArticle {
  title: string;
  url: string;
  authors: string[];
  publication: string;
  id: string;
}

export async function searchDoaj(query: string): Promise<DoajArticle[]> {
    const url = `https://doaj.org/api/search/articles/bibjson.title:"${encodeURIComponent(query)}"?pageSize=25`;

    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'DEA-App/1.0 (mailto:ambientales.dph@gmail.com)',
            },
            next: { revalidate: 3600 } // Cache for 1 hour
        });

        if (!response.ok) {
            console.error(`Error from DOAJ API: ${response.status} ${await response.text()}`);
            return [];
        }

        const data = await response.json();
        const results = data.results || [];

        return results.map((result: any): DoajArticle | null => {
            const bibjson = result.bibjson;
            if (!bibjson) return null;

            const fulltextLink = bibjson.link?.find((l: any) => l.type === 'fulltext')?.url;
            if (!fulltextLink) return null;
            
            const authors = bibjson.author?.map((a: any) => a.name).filter(Boolean) || ['Autor desconocido'];

            return {
                title: bibjson.title || 'Sin título',
                url: fulltextLink,
                authors: authors.length > 0 ? authors : ['Autor desconocido'],
                publication: bibjson.journal?.title || 'Publicación desconocida',
                id: result.id,
            };
        }).filter((article): article is DoajArticle => article !== null);
    } catch (error) {
        console.error('Failed to fetch from DOAJ API:', error);
        return [];
    }
}
