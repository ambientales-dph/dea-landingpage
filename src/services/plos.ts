'use server';

export interface PlosArticle {
  title: string;
  url: string;
  authors: string[];
  publication: string;
  id: string;
}

export async function searchPlos(query: string): Promise<PlosArticle[]> {
    // Search in title and abstract for better relevance
    const searchQuery = `title:(${encodeURIComponent(`"${query}"`)}) OR abstract:(${encodeURIComponent(`"${query}"`)})`;
    const url = `https://api.plos.org/search?q=${searchQuery}&fl=id,title_display,author_display,journal_name&rows=25`;

    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'DEA-App/1.0 (mailto:ambientales.dph@gmail.com)',
            },
            next: { revalidate: 3600 } // Cache for 1 hour
        });

        if (!response.ok) {
            console.error(`Error from PLOS API: ${response.status} ${await response.text()}`);
            return [];
        }

        const data = await response.json();
        const docs = data.response?.docs || [];

        return docs.map((doc: any): PlosArticle => ({
            title: doc.title_display || 'Sin título',
            url: `https://journals.plos.org/plosone/article?id=${doc.id}`,
            authors: doc.author_display || ['Autor desconocido'],
            publication: doc.journal_name?.[0] || 'Publicación desconocida',
            id: doc.id,
        }));
    } catch (error) {
        console.error('Failed to fetch from PLOS API:', error);
        return [];
    }
}
