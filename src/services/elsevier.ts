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
  
  const url = `https://api.elsevier.com/content/search/scopus?query=${encodeURIComponent(query)}&field=dc:title,dc:creator,prism:publicationName,prism:doi&count=10`;

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
      const authorsArray: any[] | undefined = entry['dc:creator'];
      let authors = 'Unknown authors';
      if (Array.isArray(authorsArray)) {
          const authorNames = authorsArray.map(author => author?.['$']).filter(Boolean);
          if (authorNames.length > 0) {
              authors = authorNames.join(', ');
          }
      }
        
      return {
        title: entry['dc:title'] || 'No title',
        url: entry['prism:doi'] ? `https://doi.org/${entry['prism:doi']}` : '#',
        authors: authors,
        publicationName: entry['prism:publicationName'] || 'Unknown publication',
        doi: entry['prism:doi'] || '',
      };
    });

  } catch (error) {
    console.error('Failed to fetch from Elsevier API:', error);
    return [];
  }
}
