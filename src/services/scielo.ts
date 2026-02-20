'use server';

export interface ScieloArticle {
  title: string;
  url: string;
  authors: string[];
  journal: string;
  id: string; // This will be the PID
}

// Helper function to extract text from SciELO's multilingual fields
const getSciELOText = (field: any): string => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    if (typeof field === 'object' && !Array.isArray(field)) {
        if (field.es) return field.es;
        if (field.en) return field.en;
        return Object.values(field).join(' ');
    }
    if (Array.isArray(field) && field.length > 0) {
      const esVersion = field.find(f => f.language === 'es');
      if (esVersion) return esVersion.text || '';
      const enVersion = field.find(f => f.language === 'en');
      if (enVersion) return enVersion.text || '';
      return field[0].text || '';
    }
    return '';
};

// Helper function to extract authors
const getSciELOAuthors = (authorsField: any[]): string[] => {
    if (!authorsField || !Array.isArray(authorsField)) return ['Autor desconocido'];
    const authorNames = authorsField.map(author => author.full_name).filter(Boolean);
    return authorNames.length > 0 ? authorNames : ['Autor desconocido'];
}

export async function searchScielo(query: string): Promise<ScieloArticle[]> {
  const identifiersUrl = `http://articlemeta.scielo.org/api/v1/article/identifiers`;
  const articleDetailUrlBase = `http://articlemeta.scielo.org/api/v1/article`;
  const articleLimit = 50; // Check 50 recent articles to keep it reasonably fast.

  try {
    // 1. Get a list of recent article PIDs from the Argentinian collection
    const idsResponse = await fetch(`${identifiersUrl}?collection=arg&limit=${articleLimit}`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Firebase-Studio-App-Prototype/1.0' },
        next: { revalidate: 3600 } // Cache this initial list for 1 hour
    });
    
    if (!idsResponse.ok) {
        console.error(`Error from SciELO Identifiers API: ${idsResponse.status}`, await idsResponse.text());
        return [];
    }

    const idsData = await idsResponse.json();
    const pids: string[] = (idsData.objects || []).map((item: any) => item.code).filter(Boolean);

    if (pids.length === 0) {
        return [];
    }

    // 2. Fetch details for each article in parallel
    const articlePromises = pids.map(pid => 
        fetch(`${articleDetailUrlBase}?collection=arg&code=${pid}`, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'Firebase-Studio-App-Prototype/1.0' },
            next: { revalidate: 3600 } // Cache each article for 1 hour
        }).then(res => res.ok ? res.json() : null)
    );

    const articlesData = await Promise.all(articlePromises);
    const validArticles = articlesData.filter(article => article !== null);

    // 3. Filter articles based on the search query
    const lowerCaseQuery = query.toLowerCase();
    const foundArticles: ScieloArticle[] = [];

    for (const article of validArticles) {
        if (!article) continue;

        const title = getSciELOText(article.title);
        const abstract = getSciELOText(article.abstracts);
        
        const fullText = `${title} ${abstract}`.toLowerCase();

        if (fullText.includes(lowerCaseQuery)) {
            const pid = article.code;
            if (!pid) continue;
            
            foundArticles.push({
                id: pid,
                title: title || 'Sin título',
                authors: getSciELOAuthors(article.authors),
                journal: article.journal?.title || 'Publicación desconocida',
                url: `http://www.scielo.org.ar/scielo.php?script=sci_arttext&pid=${pid}`,
            });
        }
    }

    return foundArticles;

  } catch (error) {
    console.error('Failed to fetch from SciELO ArticleMeta API:', error);
    return [];
  }
}
