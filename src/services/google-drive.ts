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
 * Extrae el ID de un archivo o carpeta desde una URL de Google Drive.
 */
export async function extractIdFromUrl(url: string): Promise<string | null> {
    if (!url) return null;
    const folderMatch = url.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch) return folderMatch[1];
    
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) return fileMatch[1];
    
    const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idParamMatch) return idParamMatch[1];

    return null;
}

/**
 * Busca o crea la carpeta de Línea de Tiempo para un proyecto.
 */
export async function getTimelineFolderForProject(projectCode: string, projectName: string) {
    const rootTL = (process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID_TL || '').trim();
    if (!rootTL) return null;

    const cleanName = projectName.replace(/\s*\([^)]+\)$/, '').trim();
    const folderName = `${projectCode} - ${cleanName}`;

    try {
        // 1. Buscar carpeta del proyecto en la raíz de TL
        const qProject = `name contains '${projectCode}' and mimeType = 'application/vnd.google-apps.folder' and '${rootTL}' in parents and trashed = false`;
        const resProject = await drive.files.list({ q: qProject, fields: 'files(id, name)' });
        
        let projectId = '';
        if (resProject.data.files && resProject.data.files.length > 0) {
            projectId = resProject.data.files[0].id!;
        } else {
            const newProject = await drive.files.create({
                requestBody: { name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [rootTL] },
                fields: 'id'
            });
            projectId = newProject.data.id!;
        }

        // 2. Buscar/Crear subcarpeta "Línea de tiempo"
        const qTL = `name = 'Línea de tiempo' and mimeType = 'application/vnd.google-apps.folder' and '${projectId}' in parents and trashed = false`;
        const resTL = await drive.files.list({ q: qTL, fields: 'files(id)' });

        if (resTL.data.files && resTL.data.files.length > 0) {
            return resTL.data.files[0].id!;
        } else {
            const newTL = await drive.files.create({
                requestBody: { name: 'Línea de tiempo', mimeType: 'application/vnd.google-apps.folder', parents: [projectId] },
                fields: 'id'
            });
            return newTL.data.id!;
        }
    } catch (e) {
        console.error("Error fetching TL folder:", e);
        return null;
    }
}

/**
 * Obtiene el nombre de un recurso (archivo o carpeta) de Google Drive.
 */
export async function getDriveResourceName(url: string): Promise<{ name: string; isFolder: boolean } | null> {
    const id = await extractIdFromUrl(url);
    if (!id) return null;

    try {
        const response = await drive.files.get({
            fileId: id,
            fields: 'name, mimeType',
        });

        return {
            name: response.data.name || 'Recurso sin nombre',
            isFolder: response.data.mimeType === 'application/vnd.google-apps.folder',
        };
    } catch (error) {
        return null;
    }
}

/**
 * Lista el contenido de una carpeta de Google Drive con soporte para paginación.
 */
export async function listFolderContents(folderId: string, pageToken?: string) {
  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, webViewLink, webContentLink, iconLink)',
      orderBy: 'folder,name',
      pageSize: 1000,
      pageToken: pageToken || undefined,
    });
    
    return {
      files: response.data.files || [],
      nextPageToken: response.data.nextPageToken || null
    };
  } catch (error) {
    console.error('Error listing folder contents:', error);
    throw new Error('No se pudo leer el contenido de la carpeta.');
  }
}

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
        throw new Error(`Error en Drive.create: ${error.message || 'Error desconocido'}`);
    }
}

/**
 * Comparte una carpeta con una lista de correos con permisos de editor usando el ID de la carpeta.
 */
export async function shareFolderWithEmails(folderId: string, emails: string[]): Promise<void> {
    const validEmails = [...new Set(emails.filter(e => e && e.includes('@')).map(e => e.trim().toLowerCase()))];
    
    if (!validEmails.length) {
        return;
    }

    const errors: string[] = [];

    for (const email of validEmails) {
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
        } catch (err: any) {
            console.error(`Error sharing with ${email}:`, err.message);
            errors.push(`${email}: ${err.message}`);
        }
    }

    if (errors.length > 0) {
        throw new Error(`No se pudo compartir con: ${errors.join('; ')}`);
    }
}

/**
 * Mueve un archivo de una carpeta a otra en Google Drive.
 */
export async function moveFile(fileId: string, currentParentId: string, newParentId: string) {
    try {
        // Retrieve the existing parents to remove
        const file = await drive.files.get({
            fileId: fileId,
            fields: 'parents'
        });
        
        const previousParents = (file.data.parents || [currentParentId]).join(',');

        // Move the file to the new folder
        const movedFile = await drive.files.update({
            fileId: fileId,
            addParents: newParentId,
            removeParents: previousParents,
            fields: 'id, parents, name, webViewLink'
        });

        return movedFile.data;
    } catch (error: any) {
        console.error('Error moving file:', error.message);
        throw new Error(`Error al mover archivo en Drive: ${error.message}`);
    }
}
