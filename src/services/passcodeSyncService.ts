import { Spot, CustomCategory, CustomList } from '../types';
import { CloudSyncData } from './googleDriveService';

export const PASSCODE_STORAGE_KEY = 'japan_road_map_active_passcode';
export const PASSCODE_ROOM_INFO_KEY = 'japan_road_map_passcode_room_info';
export const PASSCODE_IS_OWNER_KEY = 'japan_road_map_passcode_is_owner';

export interface PasscodeRoomInfo {
  passcode: string;
  ownerName: string;
  lastModified: number;
  spotsCount: number;
  updatedByDevice?: string;
  hasDriveLink: boolean;
  lastDriveSavedAt?: number;
}

export interface JoinRoomResult {
  ok: boolean;
  error?: string;
  roomInfo?: PasscodeRoomInfo;
  syncData?: CloudSyncData;
}

export interface PushSyncResult {
  ok: boolean;
  error?: string;
  lastModified?: number;
  spotsCount?: number;
  driveSaved?: boolean;
}

export interface PullSyncResult {
  ok: boolean;
  error?: string;
  hasUpdates?: boolean;
  syncData?: CloudSyncData;
  lastModified?: number;
}

/**
 * Generate a clean, human-friendly passcode (e.g. ROAD-7281)
 */
export function generateFriendlyPasscode(): string {
  const prefixes = ['ROAD', 'MAP', 'SPOT', 'TOUR', 'DRIVE', 'PASS'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${num}`;
}

/**
 * Clean & normalize passcode string
 */
export function normalizePasscode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9_\-]/g, '');
}

/**
 * Register or update passcode room from Owner side
 */
export async function registerPasscodeRoom(params: {
  passcode: string;
  ownerName: string;
  driveFileId?: string;
  driveAccessToken?: string;
  syncData: CloudSyncData;
}): Promise<{ ok: boolean; error?: string; roomInfo?: PasscodeRoomInfo }> {
  try {
    const res = await fetch('/api/passcode-sync/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { ok: false, error: err?.message || '通信エラーが発生しました' };
  }
}

/**
 * Check if a passcode room exists
 */
export async function checkPasscodeRoom(passcode: string): Promise<{ ok: boolean; roomInfo?: PasscodeRoomInfo; error?: string }> {
  try {
    const clean = normalizePasscode(passcode);
    if (!clean) return { ok: false, error: '合言葉を入力してください' };
    const res = await fetch(`/api/passcode-sync/room?passcode=${encodeURIComponent(clean)}`);
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { ok: false, error: err?.message || '通信エラーが発生しました' };
  }
}

/**
 * Join room with passcode
 */
export async function joinPasscodeRoom(params: {
  passcode: string;
  deviceId: string;
  clientSpots?: Spot[];
}): Promise<JoinRoomResult> {
  try {
    const clean = normalizePasscode(params.passcode);
    const res = await fetch('/api/passcode-sync/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, passcode: clean }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { ok: false, error: err?.message || '通信エラーが発生しました' };
  }
}

/**
 * Push updates to the passcode room (Friend or Owner)
 */
export async function pushPasscodeSync(params: {
  passcode: string;
  deviceId: string;
  syncData: CloudSyncData;
  driveAccessToken?: string;
  driveFileId?: string;
}): Promise<PushSyncResult> {
  try {
    const clean = normalizePasscode(params.passcode);
    const res = await fetch('/api/passcode-sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, passcode: clean }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { ok: false, error: err?.message || '通信エラーが発生しました' };
  }
}

/**
 * Pull updates from the passcode room
 */
export async function pullPasscodeSync(passcode: string, since: number): Promise<PullSyncResult> {
  try {
    const clean = normalizePasscode(passcode);
    const res = await fetch(`/api/passcode-sync/pull?passcode=${encodeURIComponent(clean)}&since=${since}`);
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { ok: false, error: err?.message || '通信エラーが発生しました' };
  }
}
