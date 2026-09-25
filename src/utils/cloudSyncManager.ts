import { Spot, CustomCategory, CustomList } from '../types';
import { CloudSyncData } from '../services/googleDriveService';

const DEVICE_ID_KEY = 'japan_road_map_device_id';
export const LAST_SYNC_KEY = 'japan_road_map_last_sync_time';
export const SYNC_FILE_ID_KEY = 'japan_road_map_sync_file_id';
export const AUTO_SYNC_ENABLED_KEY = 'japan_road_map_auto_sync_enabled';

/**
 * Get or create a human-friendly device identifier
 */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const os = /iPhone|iPad|iPod/i.test(navigator.userAgent)
      ? 'iOS'
      : /Android/i.test(navigator.userAgent)
      ? 'Android'
      : /Mac/i.test(navigator.userAgent)
      ? 'Mac'
      : /Windows/i.test(navigator.userAgent)
      ? 'Windows'
      : 'PC';
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    id = `${isMobile ? '📱' : '💻'} ${os}-${randomHex}`;
    try {
      localStorage.setItem(DEVICE_ID_KEY, id);
    } catch (e) {
      console.warn('Failed to save device ID to localStorage:', e);
    }
  }
  return id;
}

/**
 * Prepares the cloud sync data payload from local state
 */
export function createSyncPayload(
  spots: Spot[],
  categories: CustomCategory[],
  customLists: CustomList[],
  appSettings?: { uiScale?: string; isLocationEnabled?: boolean }
): CloudSyncData {
  return {
    version: 1,
    appName: '全国酷道険道・心霊スポット日本地図マップ',
    lastModified: Date.now(),
    updatedByDevice: getDeviceId(),
    spotsCount: spots.length,
    spots,
    categories,
    customLists,
    appSettings,
  };
}

/**
 * Smart merge local data with remote data from Google Drive:
 * - If spot exists in both: pick the one with newer `updatedAt` (or `createdAt`)
 * - If spot exists only in remote or only in local: retain both
 * - Preserves user changes from both devices!
 */
export function smartMergeSyncData(
  local: {
    spots: Spot[];
    categories: CustomCategory[];
    customLists: CustomList[];
  },
  remote: CloudSyncData
): {
  mergedSpots: Spot[];
  mergedCategories: CustomCategory[];
  mergedCustomLists: CustomList[];
  addedSpotsCount: number;
  updatedSpotsCount: number;
} {
  let addedSpotsCount = 0;
  let updatedSpotsCount = 0;

  // 1. Merge Spots
  const localSpotMap = new Map<string, Spot>();
  for (const s of local.spots) {
    localSpotMap.set(s.id, s);
  }

  const mergedSpotMap = new Map<string, Spot>(localSpotMap);

  for (const remoteSpot of remote.spots || []) {
    if (!remoteSpot || !remoteSpot.id) continue;

    const localSpot = localSpotMap.get(remoteSpot.id);
    if (!localSpot) {
      // New spot from cloud
      mergedSpotMap.set(remoteSpot.id, remoteSpot);
      addedSpotsCount++;
    } else {
      const localUpdated = localSpot.updatedAt || localSpot.createdAt || 0;
      const remoteUpdated = remoteSpot.updatedAt || remoteSpot.createdAt || 0;

      if (remoteUpdated > localUpdated) {
        // Remote is newer
        mergedSpotMap.set(remoteSpot.id, remoteSpot);
        updatedSpotsCount++;
      } else {
        // Local is newer or same, keep local
        mergedSpotMap.set(localSpot.id, localSpot);
      }
    }
  }

  // 2. Merge Categories
  const localCatMap = new Map<string, CustomCategory>();
  for (const c of local.categories) {
    localCatMap.set(c.id, c);
  }

  const mergedCatMap = new Map<string, CustomCategory>(localCatMap);
  for (const remoteCat of remote.categories || []) {
    if (!remoteCat || !remoteCat.id) continue;
    if (!mergedCatMap.has(remoteCat.id)) {
      mergedCatMap.set(remoteCat.id, remoteCat);
    }
  }

  // 3. Merge Custom Lists
  const localListMap = new Map<string, CustomList>();
  for (const l of local.customLists) {
    localListMap.set(l.id, l);
  }

  const mergedListMap = new Map<string, CustomList>(localListMap);
  for (const remoteList of remote.customLists || []) {
    if (!remoteList || !remoteList.id) continue;
    if (!mergedListMap.has(remoteList.id)) {
      mergedListMap.set(remoteList.id, remoteList);
    }
  }

  return {
    mergedSpots: Array.from(mergedSpotMap.values()),
    mergedCategories: Array.from(mergedCatMap.values()),
    mergedCustomLists: Array.from(mergedListMap.values()),
    addedSpotsCount,
    updatedSpotsCount,
  };
}

/**
 * Format timestamp to friendly Japanese string
 */
export function formatSyncTimestamp(timestampMs: number): string {
  if (!timestampMs) return '未同期';
  const d = new Date(timestampMs);
  const now = new Date();

  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const pad = (n: number) => String(n).padStart(2, '0');
  const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  if (isToday) {
    return `本日 ${timeStr}`;
  }
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${timeStr}`;
}
