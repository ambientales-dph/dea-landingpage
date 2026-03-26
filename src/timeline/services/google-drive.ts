'use server';

import { google } from 'googleapis';
import { Readable } from 'stream';

/**
 * Servicio para gestionar la subida y eliminación de archivos a Google Drive usando OAuth2.
 * Soporta dos raíces: Principal (EIAS_AMBIENTALES) y TL (DEA_TL_archivos).
 */

async function getDriveClient() {
    const clientId = (process.env.GOOGLE_CLIENT_ID_TL || '').trim();
    const clientSecret = (process.env.GOOGLE_CLIENT_SECRET_TL || '').trim();
    const refreshToken = (process.env.GOOGLE_REFRESH_TOKEN_TL || '').trim();

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Faltan variables de entorno de Google.');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    try {
        await oauth2Client.getAccessToken();
    } catch (error: any) {
        throw new Error(`Error de autenticación Google: ${error.message}`);
    }

    return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * Obtiene o crea la carpeta del proyecto dentro de una raíz específica.
 */
export async function getOrCreateProjectFolder(projectCode: string | null, useTLRoot: boolean = true) {
    const drive = await getDriveClient();
    const folderName = projectCode || 'OTROS_PROYECTOS';
    
    const rootFolderId = useTLRoot 
        ? (process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID_TL || '').trim()
        : (process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '').trim();
    
    if (!rootFolderId) {
        throw new Error(`ID de carpeta raíz no configurado (${useTLRoot ? 'TL' : 'Principal'}).`);
    }

    try {
        const escapedFolderName = folderName.replace(/'/g, "\\'");
        const query = `name = '${escapedFolderName}' and mimeType = 'application/vnd.google-apps.folder' and '${rootFolderId}' in parents and trashed = false`;
        
        const response = await drive.files.list({
            q: query,
            fields: 'files(id, name)',
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
            requestBody: fileMetadata,
            fields: 'id',
        });

        return folder.data.id!;
    } catch (error: any) {
        console.error('Error al buscar/crear carpeta en Drive:', error.message);
        throw error;
    }
}

/**
 * Crea una carpeta específica para un hito (Intocable).
 * Formato: YYMMDDHHMMSS_NombreDelHito
 */
export async function createMilestoneFolder(parentFolderId: string, milestoneName: string) {
    const drive = await getDriveClient();
    const now = new Date();
    const timestamp = now.getFullYear().toString().slice(-2) + 
                      (now.getMonth() + 1).toString().padStart(2, '0') + 
                      now.getDate().toString().padStart(2, '0') + 
                      now.getHours().toString().padStart(2, '0') + 
                      now.getMinutes().toString().padStart(2, '0') + 
                      now.getSeconds().toString().padStart(2, '0');
    
    const folderName = `${timestamp}_${milestoneName}`;

    try {
        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolderId],
        };

        const folder = await drive.files.create({
            requestBody: fileMetadata,
            fields: 'id',
        });

        return folder.data.id!;
    } catch (error: any) {
        throw new Error(`Error al crear carpeta de hito: ${error.message}`);
    }
}

/**
 * Lista subcarpetas de una carpeta padre.
 */
export async function listSubfolders(parentFolderId: string) {
    const drive = await getDriveClient();
    try {
        const response = await drive.files.list({
            q: `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id, name)',
            orderBy: 'name',
        });
        return response.data.files || [];
    } catch (error) {
        return [];
    }
}

/**
 * Crea una subcarpeta simple.
 */
export async function createSubfolder(parentFolderId: string, folderName: string) {
    const drive = await getDriveClient();
    try {
        const folder = await drive.files.create({
            requestBody: {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parentFolderId],
            },
            fields: 'id, name',
        });
        return folder.data;
    } catch (error: any) {
        throw new Error(`Error al crear subcarpeta: ${error.message}`);
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
        });
        return response.data.files?.[0] || null;
    } catch (error) {
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
            file = await drive.files.update({
                fileId: existingFileId,
                requestBody: {
                    name: fileName
                },
                media: media,
                fields: 'id, webViewLink, name',
            } as any);
        } else {
            file = await drive.files.create({
                requestBody: {
                    name: fileName,
                    parents: [folderId],
                },
                media: media,
                fields: 'id, webViewLink, name',
            } as any);
        }

        if (!file.data.id || !file.data.webViewLink) {
            throw new Error('La subida a Drive falló.');
        }

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
        throw new Error(`Error al subir a Google Drive: ${error.message}`);
    }
}
