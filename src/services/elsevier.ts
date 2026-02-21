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

  if (!apiKey || apiKey === 'your_key_here') {
    console.warn('Elsevier API key is not configured in .env file.');
    return [];
  }

  // Filter by subject areas relevant to environmental and geological sciences.
  const subjectFilter = '(SUBJAREA(ENVI) OR SUBJAREA(EART) OR SUBJAREA(AGRI) OR SUBJAREA(BIOC) OR SUBJAREA(ENGI) OR SUBJAREA(SOCI))';
  const finalQuery = `(${query}) AND ${subjectFilter}`;
  
  const url = `https://api.elsevier.com/content/search/scopus?query=${encodeURIComponent(finalQuery)}&view=STANDARD&count=25`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-ELS-APIKey': apiKey,
      },
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Error from Elsevier API: ${response.status}`, errorBody);
      return [];
    }

    const data = await response.json();
    const entries = data['search-results']?.entry || [];

    return entries.map((entry: any): ElsevierArticle => {
      let authors = 'Autor desconocido';
      const creator = entry['dc:creator'];

      if (creator) {
        let authorNames: string[] = [];
        // Handle both single author object and array of authors
        const authorsArray = Array.isArray(creator) ? creator : [creator];

        authorsArray.forEach((author: any) => {
          // The author name can be in a '$' property or just be a string
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
        authors: authors,
        publicationName: entry['prism:publicationName'] || 'Publicación desconocida',
        doi: entry['prism:doi'] || '',
      };
    });

  } catch (error) {
    console.error('Failed to fetch from Elsevier API:', error);
    return [];
  }
}
