import { Spot, CustomCategory, CustomList } from '../types';

export const SYNC_FILE_NAME = 'japan_road_spots_sync.json';

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
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,size)&spaces=drive`;

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
    return data.files[0] as DriveFileMeta;
  }
  return null;
}

/**
 * Download sync data from Google Drive file
 */
export async function downloadSyncData(
  accessToken: string,
  fileId: string
): Promise<CloudSyncData> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new GoogleDriveApiError(
      `Google Driveからのデータ取得に失敗しました (${response.status})`,
      response.status
    );
  }

  const json = await response.json();
  return json as CloudSyncData;
}

/**
 * Upload (create or update) sync data to Google Drive
 */
export async function uploadSyncData(
  accessToken: string,
  data: CloudSyncData,
  existingFileId?: string
): Promise<{ fileId: string; modifiedTime: string }> {
  if (existingFileId) {
    // Update existing file content
    const url = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`;
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
    name: SYNC_FILE_NAME,
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

  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
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
