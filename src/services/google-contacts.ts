
'use server';

import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const people = google.people({
  version: 'v1',
  auth: oauth2Client,
});

/**
 * Busca el correo electrónico de una persona en los contactos de Google por su nombre.
 * Requiere que el token tenga el scope 'https://www.googleapis.com/auth/contacts.readonly'.
 */
export async function findEmailByName(name: string): Promise<string | null> {
  try {
    const response = await people.people.searchContacts({
      query: name,
      readMask: 'emailAddresses,names',
    });

    const connections = response.data.results || [];
    if (connections.length === 0) return null;

    // Buscamos la mejor coincidencia
    for (const result of connections) {
      const person = result.person;
      if (!person) continue;

      const emails = person.emailAddresses || [];
      if (emails.length > 0 && emails[0].value) {
        return emails[0].value;
      }
    }

    return null;
  } catch (error: any) {
    console.error(`Error searching contact for ${name}:`, error.message);
    // Si hay un error de permisos, es probable que falte el scope de contactos
    if (error.message.includes('insufficient permissions')) {
        console.warn('Nota: Asegurate de haber agregado el scope de contactos en Google Cloud Console.');
    }
    return null;
  }
}

/**
 * Obtiene una lista de todos los contactos con email para ayudar a mapear la base de datos.
 */
export async function listAllContacts(): Promise<{ name: string; email: string }[]> {
    try {
        const response = await people.people.connections.list({
            resourceName: 'people/me',
            pageSize: 1000,
            personFields: 'names,emailAddresses',
        });

        const connections = response.data.connections || [];
        return connections.map(person => {
            const name = person.names?.[0]?.displayName || 'Sin nombre';
            const email = person.emailAddresses?.[0]?.value || '';
            return { name, email };
        }).filter(c => c.email !== '');
    } catch (error) {
        console.error('Error listing contacts:', error);
        return [];
    }
}
