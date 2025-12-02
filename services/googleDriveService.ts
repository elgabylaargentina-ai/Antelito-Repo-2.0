import { LibraryContext } from '../types';

// ==========================================
// CONFIGURACIÓN DE GOOGLE DRIVE
// ==========================================
// 1. Ve a https://console.cloud.google.com/
// 2. Crea un proyecto y habilita "Google Drive API"
// 3. En "Credenciales", crea un "ID de cliente de OAuth 2.0"
// 4. Pega el ID aquí abajo:
export const CLIENT_ID = '855527821152-6bop2bk2paamg9iief86kftfc72i6gqu.apps.googleusercontent.com'; 
// ==========================================

const API_KEY = ''; // Opcional, GIS suele manejar la auth sin esto.
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
const SCOPES = 'https://www.googleapis.com/auth/drive.file'; // Solo acceso a archivos creados por esta app
const DB_FILENAME = 'antelito_data.json';

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

// Interface for what we store in Drive
export interface DriveData {
  geminiApiKey: string;
  library: LibraryContext;
  updatedAt: number;
}

// --- INITIALIZATION ---

export const initGoogleDrive = (onInitComplete: () => void) => {
  const checkInit = () => {
    if (gapiInited && gisInited) {
      onInitComplete();
    }
  };

  // Load GAPI
  (window as any).gapi.load('client', async () => {
    await (window as any).gapi.client.init({
      discoveryDocs: DISCOVERY_DOCS,
    });
    gapiInited = true;
    checkInit();
  });

  // Load GIS
  tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: '', // defined at request time
  });
  gisInited = true;
  checkInit();
};

// --- AUTH ---

export const signInToGoogle = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    tokenClient.callback = async (resp: any) => {
      if (resp.error !== undefined) {
        reject(resp);
      }
      resolve();
    };
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
};

export const signOutGoogle = () => {
  const token = (window as any).gapi.client.getToken();
  if (token !== null) {
    (window as any).google.accounts.oauth2.revoke(token.access_token, () => {
      (window as any).gapi.client.setToken('');
    });
  }
};

export const isSignedIn = (): boolean => {
  return (window as any).gapi.client.getToken() !== null;
};

// --- DRIVE OPERATIONS ---

const findConfigFile = async (): Promise<string | null> => {
  try {
    const response = await (window as any).gapi.client.drive.files.list({
      q: `name = '${DB_FILENAME}' and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });
    const files = response.result.files;
    if (files && files.length > 0) {
      return files[0].id;
    }
    return null;
  } catch (err) {
    console.error("Error buscando archivo en Drive", err);
    throw err;
  }
};

export const loadDataFromDrive = async (): Promise<DriveData | null> => {
  try {
    const fileId = await findConfigFile();
    if (!fileId) return null;

    const response = await (window as any).gapi.client.drive.files.get({
      fileId: fileId,
      alt: 'media',
    });

    return response.result as DriveData;
  } catch (err) {
    console.error("Error descargando datos de Drive", err);
    throw err;
  }
};

export const saveDataToDrive = async (data: DriveData): Promise<void> => {
  const fileContent = JSON.stringify(data);
  const fileId = await findConfigFile();

  const fileMetadata = {
    name: DB_FILENAME,
    mimeType: 'application/json',
  };

  const multipartRequestBody =
    `\r\n--foo_bar_baz\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(fileMetadata) +
    `\r\n--foo_bar_baz\r\nContent-Type: application/json\r\n\r\n` +
    fileContent +
    `\r\n--foo_bar_baz--`;

  try {
    if (fileId) {
      // UPDATE
      await (window as any).gapi.client.request({
        path: `/upload/drive/v3/files/${fileId}`,
        method: 'PATCH',
        params: { uploadType: 'multipart' },
        headers: { 'Content-Type': 'multipart/related; boundary=foo_bar_baz' },
        body: multipartRequestBody,
      });
    } else {
      // CREATE
      await (window as any).gapi.client.request({
        path: '/upload/drive/v3/files',
        method: 'POST',
        params: { uploadType: 'multipart' },
        headers: { 'Content-Type': 'multipart/related; boundary=foo_bar_baz' },
        body: multipartRequestBody,
      });
    }
  } catch (err) {
    console.error("Error guardando en Drive", err);
    throw err;
  }
};