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
    if (!cuenca || !cuenca.driveFolderId || cuenca.driveFolderId === 'REEMPLAZAR_CON_ID_DE_DRIVE') {
        throw new Error(`La carpeta de la cuenca "${cuenca?.name || cuencaId}" no está configurada en src/lib/cuencas.ts.`);
    }

    const parentFolderId = cuenca.driveFolderId;

    try {
        // 1. Create the folder
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
            throw new Error('No se pudo obtener el ID o el enlace de la carpeta creada en Drive.');
        }

        const folderId = folder.data.id;
        const folderUrl = folder.data.webViewLink;

        // 2. Make it public (anyone with the link can view)
        await drive.permissions.create({
            fileId: folderId,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        return folderUrl;

    } catch (error: any) {
        console.error('Error creating Google Drive folder:', error);
        // Check for specific auth errors to give a better message
        if (error.message && error.message.includes('invalid_grant')) {
            throw new Error('El Refresh Token de Google no es válido. Por favor, generá uno nuevo.');
        }
        if (error.message && (error.message.includes('invalid_request') || error.message.includes('invalid client'))) {
            throw new Error('El Client ID o Client Secret de Google no son válidos.');
        }
        if (error.message && error.message.includes('File not found')) {
            throw new Error(`La carpeta de la cuenca con ID "${parentFolderId}" no se encontró en Google Drive o no tenés permisos para verla.`);
        }
        throw new Error(`No se pudo crear la carpeta en Google Drive: ${error.message || 'Error desconocido'}`);
    }
}
