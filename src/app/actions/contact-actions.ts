
'use server';

import { findEmailByName, listAllContacts } from '@/services/google-contacts';
import { PROYECTISTAS } from '@/lib/proyectistas';

export type ContactResult = {
    name: string;
    email: string | null;
    found: boolean;
};

/**
 * Intenta encontrar los correos de todos los proyectistas definidos en el sistema
 * consultando los contactos de Google de la cuenta vinculada.
 */
export async function discoverProyectistasEmails(): Promise<ContactResult[]> {
    const results: ContactResult[] = [];

    for (const name of PROYECTISTAS) {
        const email = await findEmailByName(name);
        results.push({
            name,
            email,
            found: !!email
        });
    }

    return results;
}

/**
 * Devuelve la lista completa de contactos para una auditoría manual si es necesario.
 */
export async function getGoogleContactsAudit() {
    return await listAllContacts();
}
