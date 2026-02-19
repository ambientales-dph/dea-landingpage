'use server';

export interface SNRDArticle {
  title: string;
  url: string;
  authors: string[];
  publication: string;
  handle: string;
}

export async function searchSNRD(query: string): Promise<SNRDArticle[]> {
  const url = `https://bdu.siu.edu.ar/busqueda/inicio/ajax?query=${encodeURIComponent(query)}&page=1&sort_by=score&order=desc&rpp=10&fq=relation%3A%22haspart%22`;

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Firebase-Studio-App-Prototype/1.0',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Error from SNRD API: ${response.status}`, errorBody);
      return [];
    }

    const data = await response.json();
    const docs = data?.docs || [];

    return docs.map((doc: any): SNRDArticle => ({
      title: doc.title?.[0] || 'Sin título',
      url: doc.handle ? `https://bdu.siu.edu.ar/handle/${doc.handle}` : '#',
      authors: doc.author || ['Autor desconocido'],
      publication: doc.publisher_str?.[0] || 'Publicación desconocida',
      handle: doc.handle || '',
    }));

  } catch (error) {
    console.error('Failed to fetch from SNRD API:', error);
    return [];
  }
}
