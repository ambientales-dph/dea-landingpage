
'use server';

import { google } from 'googleapis';
import { Readable } from 'stream';

/**
 * Servicio para gestionar la subida y eliminación de archivos a Google Drive usando OAuth2.
 * Actúa en nombre de la cuenta personal configurada.
 */

async function getDriveClient() {
    const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
    const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
    const refreshToken = (process.env.GOOGLE_REFRESH_TOKEN || '').trim();

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Faltan variables de entorno: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o GOOGLE_REFRESH_TOKEN.');
    }

    // Usamos el cliente OAuth2 con el Refresh Token de la cuenta personal
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    try {
        // Forzamos el refresco del token para validar credenciales inmediatamente
        await oauth2Client.getAccessToken();
    } catch (error: any) {
        console.error('ERROR CRÍTICO DE AUTENTICACIÓN GOOGLE:', error.response?.data || error.message);
        throw new Error(`Error de autenticación Google: ${error.response?.data?.error_description || error.message}. Verifica que el Refresh Token sea válido para este Client ID.`);
    }

    return google.drive({ version: 'v3', auth: oauth2Client });
}

export async function getOrCreateProjectFolder(projectCode: string | null) {
    const drive = await getDriveClient();
    const folderName = projectCode || 'OTROS_PROYECTOS';
    const rootFolderId = (process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '').trim();
    
    if (!rootFolderId) {
        throw new Error('ID de carpeta raíz no configurado (GOOGLE_DRIVE_ROOT_FOLDER_ID).');
    }

    try {
        const escapedFolderName = folderName.replace(/'/g, "\\'");
        const query = `name = '${escapedFolderName}' and mimeType = 'application/vnd.google-apps.folder' and '${rootFolderId}' in parents and trashed = false`;
        
        const response = await drive.files.list({
            q: query,
            fields: 'files(id, name)',
            spaces: 'drive',
        });

        if (response.data.files && response.data.files.length > 0) {
            return response.data.files[0].id;
        }

        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [rootFolderId],
        };

        const folder = await drive.files.create({
            resource: fileMetadata as any,
            fields: 'id',
        });

        return folder.data.id;
    } catch (error: any) {
        console.error('Error al buscar/crear carpeta en Drive:', error.message);
        throw error;
    }
}

/**
 * Busca si un archivo existe en una carpeta específica.
 */
export async function findFileInFolder(folderId: string, fileName: string) {
    const drive = await getDriveClient();
    try {
        const escapedName = fileName.replace(/'/g, "\\'");
        const query = `name = '${escapedName}' and '${folderId}' in parents and trashed = false`;
        const response = await drive.files.list({
            q: query,
            fields: 'files(id, name)',
            spaces: 'drive',
        });
        return response.data.files?.[0] || null;
    } catch (error) {
        console.error('Error al buscar archivo:', error);
        return null;
    }
}

/**
 * Elimina un archivo de Google Drive.
 */
export async function deleteFileFromDrive(fileId: string): Promise<boolean> {
    try {
        const drive = await getDriveClient();
        await drive.files.delete({
            fileId: fileId,
        });
        return true;
    } catch (error: any) {
        console.error('Error al eliminar archivo de Drive:', error.message);
        return false;
    }
}

export interface DriveUploadResult {
    id: string;
    webViewLink: string;
    name: string;
}

export async function uploadFileToDrive(
    fileName: string, 
    mimeType: string, 
    base64Data: string, 
    folderId: string,
    existingFileId?: string
): Promise<DriveUploadResult> {
    try {
        const drive = await getDriveClient();
        const buffer = Buffer.from(base64Data, 'base64');
        const bufferStream = new Readable();
        bufferStream.push(buffer);
        bufferStream.push(null);

        const media = {
            mimeType: mimeType,
            body: bufferStream,
        };

        let file;
        if (existingFileId) {
            // Sobrescribir archivo existente
            file = await drive.files.update({
                fileId: existingFileId,
                media: media,
                fields: 'id, webViewLink, name',
            } as any);
        } else {
            // Crear nuevo archivo
            const fileMetadata = {
                name: fileName,
                parents: [folderId],
            };
            file = await drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id, webViewLink, name',
            } as any);
        }

        if (!file.data.id || !file.data.webViewLink) {
            throw new Error('La subida a Drive falló.');
        }

        // Aseguramos acceso de lectura pública (opcional, según necesidad)
        await drive.permissions.create({
            fileId: file.data.id,
            requestBody: { role: 'reader', type: 'anyone' },
        });

        return {
            id: file.data.id,
            webViewLink: file.data.webViewLink,
            name: file.data.name || fileName
        };

    } catch (error: any) {
        console.error('Error crítico en uploadFileToDrive:', error);
        throw new Error(`Error al subir a Google Drive: ${error.message || 'Error desconocido'}`);
    }
}
