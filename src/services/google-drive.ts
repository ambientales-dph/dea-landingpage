'use server';

import { google } from 'googleapis';
import { CUENCAS } from '@/lib/cuencas';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const drive = google.drive({
  version: 'v3',
  auth: oauth2Client,
});

/**
 * Crea una carpeta para el proyecto y devuelve tanto el ID como el enlace web.
 */
export async function createProjectFolder(projectName: string, cuencaId: string): Promise<{ id: string; url: string }> {
    const cuenca = CUENCAS.find(c => c.id === cuencaId);
    if (!cuenca || !cuenca.driveFolderId) {
        throw new Error(`La carpeta de la cuenca "${cuenca?.name || cuencaId}" no está configurada.`);
    }

    const parentFolderId = cuenca.driveFolderId;

    try {
        const fileMetadata = {
            name: projectName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolderId],
        };

        const folder = await drive.files.create({
            requestBody: fileMetadata,
            fields: 'id, webViewLink',
        });
        
        if (!folder.data.id || !folder.data.webViewLink) {
            throw new Error('No se pudo obtener la información de la carpeta creada.');
        }

        return {
            id: folder.data.id,
            url: folder.data.webViewLink
        };

    } catch (error: any) {
        console.error('Error creating Google Drive folder:', error);
        throw new Error(`No se pudo crear la carpeta en Google Drive: ${error.message || 'Error desconocido'}`);
    }
}

/**
 * Comparte una carpeta con una lista de correos con permisos de editor usando el ID de la carpeta.
 */
export async function shareFolderWithEmails(folderId: string, emails: string[]): Promise<void> {
    const validEmails = [...new Set(emails.filter(e => e && e.includes('@')).map(e => e.trim().toLowerCase()))];
    
    if (!validEmails.length) {
        console.log('No hay correos válidos para compartir.');
        return;
    }

    console.log(`Iniciando proceso para compartir carpeta ${folderId} con:`, validEmails);

    try {
        // Creamos los permisos uno por uno
        const sharePromises = validEmails.map(async (email) => {
            try {
                await drive.permissions.create({
                    fileId: folderId,
                    requestBody: {
                        role: 'writer',
                        type: 'user',
                        emailAddress: email,
                    },
                    sendNotificationEmail: true,
                });
                console.log(`Compartido con éxito con: ${email}`);
            } catch (err: any) {
                console.warn(`Error al compartir con ${email}:`, err.message);
                // No relanzamos aquí para permitir que otros correos se procesen
            }
        });

        await Promise.all(sharePromises);
        console.log('Proceso de compartir finalizado.');
    } catch (error: any) {
        console.error('Error general en shareFolderWithEmails:', error.message);
        throw error; // Relanzamos para que el action principal capture el fallo
    }
}
