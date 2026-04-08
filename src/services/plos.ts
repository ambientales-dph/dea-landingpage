'use server';

export interface PlosArticle {
  title: string;
  url: string;
  authors: string[];
  publication: string;
  id: string;
}

/**
 * Busca artículos en Public Library of Science (PLOS).
 */
export async function searchPlos(query: string): Promise<PlosArticle[]> {
    // Realizamos una búsqueda abierta (Everything) para maximizar resultados relevantes
    const url = `https://api.plos.org/search?q=everything:${encodeURIComponent(query)}&fl=id,title_display,author_display,journal_name&rows=25&sort=score desc`;

    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            },
            next: { revalidate: 3600 } // Cache por 1 hora
        });

        if (!response.ok) {
            console.error(`Error de la API de PLOS: ${response.status}`);
            return [];
        }

        const data = await response.json();
        const docs = data.response?.docs || [];

        return docs.map((doc: any): PlosArticle => ({
            title: doc.title_display || 'Sin título',
            url: `https://journals.plos.org/plosone/article?id=${doc.id}`,
            authors: Array.isArray(doc.author_display) ? doc.author_display : ['Autor desconocido'],
            publication: doc.journal_name?.[0] || 'Publicación desconocida',
            id: doc.id,
        }));
    } catch (error) {
        console.error('Error al obtener datos de PLOS:', error);
        return [];
    }
}
