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
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-ELS-APIKey': apiKey,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Error from Elsevier API: ${response.status}`, errorBody);
      return [];
    }

    const data = await response.json();
    const entries = data['search-results']?.entry || [];

    return entries.map((entry: any): ElsevierArticle => ({
      title: entry['dc:title'] || 'No title',
      url: entry['prism:doi'] ? `https://doi.org/${entry['prism:doi']}` : '#',
      authors: entry['dc:creator']?.[0]?.['$'] || 'Unknown authors',
      publicationName: entry['prism:publicationName'] || 'Unknown publication',
      doi: entry['prism:doi'] || '',
    }));

  } catch (error) {
    console.error('Failed to fetch from Elsevier API:', error);
    return [];
  }
}
