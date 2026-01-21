
'use server';

interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  boundingbox: [string, string, string, string];
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
  importance: number;
  icon?: string;
}

/**
 * Searches for a location using the OpenStreetMap Nominatim API.
 * @param query The location name to search for.
 * @returns The first search result, or null if no results are found.
 */
export async function searchLocation(query: string): Promise<NominatimResult | null> {
  const fetch = (await import('node-fetch')).default;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    query
  )}&format=json&limit=1`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Firebase-Studio-App-Prototype/1.0', // Nominatim requires a User-Agent
      },
    });

    if (!response.ok) {
      throw new Error(`Error en la API de Nominatim: ${response.status}`);
    }

    const results: NominatimResult[] = (await response.json()) as NominatimResult[];
    
    if (results.length > 0) {
      return results[0];
    }

    return null;
  } catch (error) {
    console.error('Error fetching from Nominatim API:', error);
    throw new Error('No pudimos obtener los datos de la ubicación.');
  }
}
