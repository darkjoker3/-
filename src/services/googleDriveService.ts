import { Spot, CustomCategory, CustomList } from '../types';

export const SYNC_FILE_NAME = 'japan_road_spots_sync.json';
export const CSV_SYNC_FILE_NAME = 'japan_road_spots.csv';

export interface CloudSyncData {
  version: number;
  appName: string;
  lastModified: number; // Unix timestamp ms
  updatedByDevice: string;
  spotsCount: number;
  spots: Spot[];
  categories: CustomCategory[];
  customLists: CustomList[];
  appSettings?: {
    uiScale?: string;
    isLocationEnabled?: boolean;
  };
}

export interface DriveFileMeta {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
  webViewLink?: string;
  mimeType?: string;
}

export class GoogleDriveApiError extends Error {
  status: number;
  isTokenExpired: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GoogleDriveApiError';
    this.status = status;
    this.isTokenExpired = status === 401;
  }
}

/**
 * Search for existing sync file on user's Google Drive
 */
export async function searchSyncFile(
  accessToken: string,
  fileName: string = SYNC_FILE_NAME
): Promise<DriveFileMeta | null> {
  const query = encodeURIComponent(`name = '${fileName}' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,size,webViewLink,mimeType)&spaces=drive`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new GoogleDriveApiError(
      `Google Driveファイルの検索に失敗しました (${response.status})`,
      response.status
    );
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    const file = data.files[0];
    return {
      id: file.id,
      name: file.name,
      modifiedTime: file.modifiedTime,
      size: file.size,
      webViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
      mimeType: file.mimeType,
    };
  }
  return null;
}

/**
 * Search for files in user's Google Drive (CSV or JSON backup files)
 */
export async function searchDriveFiles(
  accessToken: string,
  filterType: 'all' | 'csv' | 'json' = 'all'
): Promise<DriveFileMeta[]> {
  let query = 'trashed = false';
  if (filterType === 'csv') {
    query += " and (mimeType = 'text/csv' or name contains '.csv')";
  } else if (filterType === 'json') {
    query += " and (mimeType = 'application/json' or name contains '.json')";
  } else {
    query += " and (mimeType = 'text/csv' or mimeType = 'application/json' or name contains '.csv' or name contains '.json')";
  }
  const encodedQuery = encodeURIComponent(query);
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodedQuery}&fields=files(id,name,modifiedTime,size,webViewLink,mimeType)&orderBy=modifiedTime desc&pageSize=30&spaces=drive`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new GoogleDriveApiError(
      `Google Driveファイルの取得に失敗しました (${response.status})`,
      response.status
    );
  }

  const data = await response.json();
  return (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    modifiedTime: f.modifiedTime,
    size: f.size,
    webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
    mimeType: f.mimeType,
  }));
}

/**
 * Download raw text file content from Google Drive (CSV or JSON string)
 */
export async function downloadFileContent(
  accessToken: string,
  fileId: string
): Promise<string> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new GoogleDriveApiError(
      `Google Driveファイルの読み込みに失敗しました (${response.status})`,
      response.status
    );
  }

  return await response.text();
}

/**
 * Download sync data from Google Drive file
 */
export async function downloadSyncData(
  accessToken: string,
  fileId: string
): Promise<CloudSyncData> {
  const text = await downloadFileContent(accessToken, fileId);
  try {
    return JSON.parse(text) as CloudSyncData;
  } catch {
    throw new GoogleDriveApiError('Google Driveファイルが正しいJSON形式ではありません', 400);
  }
}

/**
 * Upload (create or update) JSON sync data to Google Drive
 */
export async function uploadSyncData(
  accessToken: string,
  data: CloudSyncData,
  existingFileId?: string,
  fileName: string = SYNC_FILE_NAME
): Promise<{ fileId: string; modifiedTime: string; webViewLink?: string }> {
  if (existingFileId) {
    // Update existing file content
    const url = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media&fields=id,name,modifiedTime,size,webViewLink`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify(data, null, 2),
    });

    if (response.ok) {
      const updated = await response.json();
      return {
        fileId: updated.id,
        modifiedTime: updated.modifiedTime || new Date().toISOString(),
        webViewLink: updated.webViewLink || `https://drive.google.com/file/d/${updated.id}/view`,
      };
    }

    if (response.status === 404) {
      console.warn(`Drive file ${existingFileId} not found (404). Falling back to creating a new sync file.`);
      // Proceed to create a new file below
    } else {
      throw new GoogleDriveApiError(
        `Google Drive同期データの更新に失敗しました (${response.status})`,
        response.status
      );
    }
  }

  // Create new file with multipart upload
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    description: '全国酷道険道マップ 同期データ (Japan Road & Spot Map Sync Data)',
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(data, null, 2) +
    closeDelimiter;

  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size,webViewLink';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  });

  if (!response.ok) {
    throw new GoogleDriveApiError(
      `Google Drive新規同期ファイルの作成に失敗しました (${response.status})`,
      response.status
    );
  }

  const created = await response.json();
  return {
    fileId: created.id,
    modifiedTime: created.modifiedTime || new Date().toISOString(),
    webViewLink: created.webViewLink || `https://drive.google.com/file/d/${created.id}/view`,
  };
}

/**
 * Upload CSV file to Google Drive (create or overwrite)
 */
export async function uploadCsvToDrive(
  accessToken: string,
  csvContent: string,
  fileName: string = CSV_SYNC_FILE_NAME,
  existingFileId?: string
): Promise<{ fileId: string; modifiedTime: string; webViewLink?: string }> {
  // Ensure UTF-8 BOM so Excel and Google Sheets open Japanese characters correctly
  const bodyWithBom = '\uFEFF' + csvContent.replace(/^\uFEFF/, '');

  if (existingFileId) {
    // Update existing CSV file
    const url = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media&fields=id,name,modifiedTime,size,webViewLink`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'text/csv; charset=UTF-8',
      },
      body: bodyWithBom,
    });

    if (response.ok) {
      const updated = await response.json();
      return {
        fileId: updated.id,
        modifiedTime: updated.modifiedTime || new Date().toISOString(),
        webViewLink: updated.webViewLink || `https://drive.google.com/file/d/${updated.id}/view`,
      };
    }

    if (response.status !== 404) {
      throw new GoogleDriveApiError(
        `Google Drive CSVファイルの更新に失敗しました (${response.status})`,
        response.status
      );
    }
  }

  // Create new CSV file with multipart upload
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: fileName,
    mimeType: 'text/csv',
    description: '全国酷道険道マップ CSVエクスポートデータ (Japan Road & Spot Map CSV Data)',
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: text/csv; charset=UTF-8\r\n\r\n' +
    bodyWithBom +
    closeDelimiter;

  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size,webViewLink';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  });

  if (!response.ok) {
    throw new GoogleDriveApiError(
      `Google Drive CSVファイルの作成に失敗しました (${response.status})`,
      response.status
    );
  }

  const created = await response.json();
  return {
    fileId: created.id,
    modifiedTime: created.modifiedTime || new Date().toISOString(),
    webViewLink: created.webViewLink || `https://drive.google.com/file/d/${created.id}/view`,
  };
}

/**
 * Delete sync file from Google Drive
 */
export async function deleteSyncFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    throw new GoogleDriveApiError(
      `Google Driveファイルの削除に失敗しました (${response.status})`,
      response.status
    );
  }
}
