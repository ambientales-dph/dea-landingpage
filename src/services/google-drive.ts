
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

export async function createProjectFolder(projectName: string, cuencaId: string): Promise<string> {
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
            throw new Error('No se pudo obtener el enlace de la carpeta.');
        }

        return folder.data.webViewLink;

    } catch (error: any) {
        console.error('Error creating Google Drive folder:', error);
        throw new Error(`No se pudo crear la carpeta en Google Drive: ${error.message || 'Error desconocido'}`);
    }
}

/**
 * Comparte una carpeta con una lista de correos con permisos de editor.
 */
export async function shareFolderWithEmails(folderUrl: string, emails: string[]): Promise<void> {
    if (!emails.length) return;

    try {
        // Extraemos el ID de la URL: .../folders/ID?usp=sharing o similar
        const folderIdMatch = folderUrl.match(/folders\/([^/?]+)/);
        if (!folderIdMatch) return;
        const folderId = folderIdMatch[1];

        // Google Drive API permite crear permisos uno por uno
        const sharePromises = emails.map(email => 
            drive.permissions.create({
                fileId: folderId,
                requestBody: {
                    role: 'writer',
                    type: 'user',
                    emailAddress: email,
                },
                sendNotificationEmail: true, // Avisarles por mail
            }).catch(err => {
                console.warn(`No se pudo compartir con ${email}:`, err.message);
            })
        );

        await Promise.allSettled(sharePromises);
    } catch (error) {
        console.error('Error sharing folder:', error);
    }
}
