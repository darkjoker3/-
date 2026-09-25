import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Spot, CustomCategory, UserLocation, SpotRouteInfo, CustomList, SpotListTab } from './types';
import { INITIAL_SAMPLE_SPOTS, INITIAL_CATEGORIES } from './data/sampleSpots';
import { JapanMap } from './components/JapanMap';
import { SpotListSidebar } from './components/SpotListSidebar';
import { SpotDetailModal } from './components/SpotDetailModal';
import { SpotFormModal } from './components/SpotFormModal';
import { CategoryManagerModal } from './components/CategoryManagerModal';
import { CreateListModal } from './components/CreateListModal';
import { SpotListManagerModal } from './components/SpotListManagerModal';
import { ListSettingsModal } from './components/ListSettingsModal';
import { InstallPwaModal } from './components/InstallPwaModal';
import { ConfirmDeleteModal } from './components/ConfirmDeleteModal';
import { QuickPinBar } from './components/QuickPinBar';
import { MobileFilterBar, BasicFilterType } from './components/MobileFilterBar';
import { MobileBottomNav, MobileTab } from './components/MobileBottomNav';
import { MobileSpotBottomSheet } from './components/MobileSpotBottomSheet';
import { PrefectureInfoCard } from './components/PrefectureInfoCard';
import { FilterSearchModal } from './components/FilterSearchModal';
import { MobileSpotListView } from './components/MobileSpotListView';
import { DataExportImportModal } from './components/DataExportImportModal';
import { fetchLocalRoadRoute } from './utils/routeUtils';
import {
  MapPin,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Camera,
  CheckCircle2,
  Info,
  Layers,
  Columns2,
  Rows3,
  X,
  Navigation,
  NavigationOff,
  Loader2,
  Settings2,
  ListOrdered,
  Car,
  Smartphone,
  Map as MapIcon,
  ListFilter,
  Cloud,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  googleSignOut,
  getAccessToken,
} from './services/firebaseAuth';
import {
  searchSyncFile,
  downloadSyncData,
  uploadSyncData,
  deleteSyncFile,
  CloudSyncData,
  DriveFileMeta,
  SYNC_FILE_NAME,
} from './services/googleDriveService';
import {
  smartMergeSyncData,
  createSyncPayload,
  getDeviceId,
  LAST_SYNC_KEY,
  SYNC_FILE_ID_KEY,
  AUTO_SYNC_ENABLED_KEY,
} from './utils/cloudSyncManager';
import { CloudSyncModal } from './components/CloudSyncModal';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const SPOTS_STORAGE_KEY = 'japan_map_haunted_spots_data_v2';
const CATEGORIES_STORAGE_KEY = 'japan_map_custom_categories_v2';
const CUSTOM_LISTS_STORAGE_KEY = 'japan_map_custom_lists_v1';

export const INITIAL_DEFAULT_LISTS: CustomList[] = [
  {
    id: 'want_to_go',
    name: '行きたい場所',
    icon: '📌',
    color: '#f59e0b',
    description: '訪れたいスポットのブックマーク',
    isSystem: true,
    createdAt: 1,
  },
  {
    id: 'haunted',
    name: '心霊スポット',
    icon: '👻',
    color: '#8b5cf6',
    description: '心霊・怪異・オカルト系スポット',
    isSystem: true,
    createdAt: 2,
  },
  {
    id: 'list_recommend',
    name: 'おすすめ',
    icon: '⭐',
    color: '#10b981',
    description: '厳選されたおすすめスポット',
    createdAt: 3,
  },
  {
    id: 'list_drive',
    name: 'ドライブ',
    icon: '🚗',
    color: '#3b82f6',
    description: '車・下道で巡るドライブコース',
    createdAt: 4,
  },
];

// Deduplication helper functions to guarantee strictly unique IDs and avoid duplicate React key warnings
export function deduplicateSpots(spotsList: Spot[]): Spot[] {
  if (!Array.isArray(spotsList)) return [];
  const seen = new Set<string>();
  const result: Spot[] = [];
  for (const s of spotsList) {
    if (s && typeof s === 'object' && s.id && !seen.has(s.id)) {
      seen.add(s.id);
      result.push(s);
    }
  }
  return result;
}

export function deduplicateCategories(catList: CustomCategory[]): CustomCategory[] {
  if (!Array.isArray(catList)) return [];
  const seen = new Set<string>();
  const result: CustomCategory[] = [];
  for (const c of catList) {
    if (c && typeof c === 'object' && c.id && !seen.has(c.id)) {
      seen.add(c.id);
      result.push(c);
    }
  }
  return result;
}

export function deduplicateCustomLists(lists: CustomList[]): CustomList[] {
  if (!Array.isArray(lists)) return [];
  const seen = new Set<string>();
  const result: CustomList[] = [];
  for (const l of lists) {
    if (l && typeof l === 'object' && l.id && !seen.has(l.id)) {
      seen.add(l.id);
      result.push(l);
    }
  }
  return result;
}

export default function App() {
  // 1. Spots state
  const [spots, setSpots] = useState<Spot[]>(() => {
    try {
      const saved = localStorage.getItem(SPOTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const deduped = deduplicateSpots(parsed);
          // If duplicate entries existed in localStorage, clean them up immediately
          if (deduped.length !== parsed.length) {
            try {
              localStorage.setItem(SPOTS_STORAGE_KEY, JSON.stringify(deduped));
            } catch (err) {
              console.error(err);
            }
          }
          return deduped;
        }
      }
    } catch (e) {
      console.error('Failed to load spots from localStorage:', e);
    }
    return deduplicateSpots(INITIAL_SAMPLE_SPOTS);
  });

  // 2. Custom Categories state (Defaults: 心霊スポット & その他, editable)
  const [categories, setCategories] = useState<CustomCategory[]>(() => {
    try {
      const saved = localStorage.getItem(CATEGORIES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return deduplicateCategories(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load categories:', e);
    }
    return deduplicateCategories(INITIAL_CATEGORIES);
  });

  // 3. Custom Lists state (Dynamic list creation and spot assignment)
  const [customLists, setCustomLists] = useState<CustomList[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_LISTS_STORAGE_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return deduplicateCustomLists(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load custom lists:', e);
    }
    return deduplicateCustomLists(INITIAL_DEFAULT_LISTS);
  });

  // Active Spot & Modals
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [selectedSpotIds, setSelectedSpotIds] = useState<string[]>([]); // 複数選択 (下道ルート比較)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isCreateListModalOpen, setIsCreateListModalOpen] = useState(false);
  const [editingList, setEditingList] = useState<CustomList | null>(null);
  const [isListSettingsModalOpen, setIsListSettingsModalOpen] = useState(false);
  const [listManagerSpotId, setListManagerSpotId] = useState<string | null>(null);
  const [editingSpot, setEditingSpot] = useState<Spot | null>(null);
  const [pendingLatLng, setPendingLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [showResetSamplesConfirm, setShowResetSamplesConfirm] = useState(false);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);

  // Cloud Sync (Google Drive) states
  const [isCloudSyncModalOpen, setIsCloudSyncModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(() => {
    try {
      const v = localStorage.getItem(LAST_SYNC_KEY);
      return v ? parseInt(v, 10) : null;
    } catch {
      return null;
    }
  });
  const [syncFileId, setSyncFileId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SYNC_FILE_ID_KEY) || null;
    } catch {
      return null;
    }
  });
  const [cloudMeta, setCloudMeta] = useState<DriveFileMeta | null>(null);
  const [cloudData, setCloudData] = useState<CloudSyncData | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(AUTO_SYNC_ENABLED_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  const [hasPendingChanges, setHasPendingChanges] = useState<boolean>(false);

  // Screen & Device Breakpoint Detection (PC: >=1025px, Tablet: 769-1024px, Mobile: <=768px)
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth <= 768;
  const isTablet = windowWidth > 768 && windowWidth <= 1024;
  const isDesktop = windowWidth > 1024;

  // Mobile active navigation: 'map' | 'list' | 'visited' | 'settings'
  const [mobileNavTab, setMobileNavTab] = useState<MobileTab>('map');
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const [mobileBasicFilter, setMobileBasicFilter] = useState<BasicFilterType>('all');
  const [mobileSelectedCategories, setMobileSelectedCategories] = useState<string[]>([]);
  const [showPrefectureCard, setShowPrefectureCard] = useState(false);
  const [isFilterSearchModalOpen, setIsFilterSearchModalOpen] = useState(false);
  const [mobileSortOrder, setMobileSortOrder] = useState<'desc' | 'asc'>('desc');

  // Mobile active view: 'map' (地図) or 'list' (リスト)
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');

  // Map & layout states (PC defaults to sidebar open, mobile starts with map open at optimal full screen)
  const [isAddPinMode, setIsAddPinMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });
  const [layoutMode, setLayoutMode] = useState<'side' | 'bottom'>('side');
  const [selectedPrefecture, setSelectedPrefecture] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<SpotListTab>('all');

  // Trigger window resize event to immediately recalculate Leaflet map container on sidebar/layout change
  useEffect(() => {
    const timer1 = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
    const timer2 = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 320);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isSidebarOpen, layoutMode]);

  // UI Display Scale (Standard default: 100%)
  const [uiScale, setUiScale] = useState<'75' | '85' | '100'>(() => {
    try {
      const stored = localStorage.getItem('japan_map_ui_scale_v1');
      if (stored === '75' || stored === '85' || stored === '100') {
        return stored;
      }
    } catch (e) {
      console.error(e);
    }
    return '100'; // 標準の大きさを100%（16px基準）にする
  });

  const handleSetUiScale = useCallback((scale: '75' | '85' | '100') => {
    setUiScale(scale);
    try {
      localStorage.setItem('japan_map_ui_scale_v1', scale);
    } catch (e) {
      console.error(e);
    }
    document.documentElement.setAttribute('data-ui-scale', scale);
    showToast(`表示サイズを ${scale}% ${scale === '100' ? '（標準）' : ''}に変更しました`, 'info');
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-ui-scale', uiScale);
  }, [uiScale]);
  const [isLocationEnabled, setIsLocationEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('japan_map_location_enabled_v1');
      if (stored !== null) {
        return stored === 'true';
      }
    } catch (e) {
      console.error(e);
    }
    return false; // デフォルトはOFF。ユーザーが手動でON/OFFを切り替える
  });
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [routesInfo, setRoutesInfo] = useState<Record<string, SpotRouteInfo>>({});
  const routesInfoRef = useRef<Record<string, SpotRouteInfo>>({});
  useEffect(() => {
    routesInfoRef.current = routesInfo;
  }, [routesInfo]);

  // Sync isLocationEnabled to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('japan_map_location_enabled_v1', String(isLocationEnabled));
    } catch (e) {
      console.error('Failed to save location enabled state:', e);
    }
  }, [isLocationEnabled]);

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // PWA (Progressive Web App) Install state & listeners
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsPwaInstalled(true);
      setDeferredPrompt(null);
      showToast('Webアプリとしてホーム画面にインストールされました！', 'success');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Sync spots to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SPOTS_STORAGE_KEY, JSON.stringify(deduplicateSpots(spots)));
    } catch (e) {
      console.error('Failed to save spots to localStorage:', e);
    }
  }, [spots]);

  // Sync categories to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(deduplicateCategories(categories)));
    } catch (e) {
      console.error('Failed to save categories to localStorage:', e);
    }
  }, [categories]);

  // Sync custom lists to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_LISTS_STORAGE_KEY, JSON.stringify(deduplicateCustomLists(customLists)));
    } catch (e) {
      console.error('Failed to save custom lists to localStorage:', e);
    }
  }, [customLists]);

  // --- Google Drive Cloud Sync Integration ---
  // Initialize Auth state listener
  useEffect(() => {
    const unsubscribe = initAuth(
      async (user, token) => {
        setCurrentUser(user);
        try {
          const fileMeta = await searchSyncFile(token);
          if (fileMeta) {
            setCloudMeta(fileMeta);
            setSyncFileId(fileMeta.id);
            localStorage.setItem(SYNC_FILE_ID_KEY, fileMeta.id);
            const downloaded = await downloadSyncData(token, fileMeta.id);
            setCloudData(downloaded);
          }
        } catch (e) {
          console.warn('Initial cloud sync check:', e);
        }
      },
      () => {
        setCurrentUser(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Google Sign In handler
  const handleSignIn = async () => {
    try {
      const { user, accessToken } = await googleSignIn();
      setCurrentUser(user);
      showToast(`Googleアカウント（${user.displayName || user.email}）に接続しました`, 'success');

      setIsSyncing(true);
      try {
        const fileMeta = await searchSyncFile(accessToken);
        if (fileMeta) {
          setCloudMeta(fileMeta);
          setSyncFileId(fileMeta.id);
          localStorage.setItem(SYNC_FILE_ID_KEY, fileMeta.id);
          const remoteData = await downloadSyncData(accessToken, fileMeta.id);
          setCloudData(remoteData);

          // Smart merge on sign-in
          const { mergedSpots, mergedCategories, mergedCustomLists, addedSpotsCount, updatedSpotsCount } = smartMergeSyncData(
            { spots, categories, customLists },
            remoteData
          );
          setSpots(mergedSpots);
          setCategories(mergedCategories);
          setCustomLists(mergedCustomLists);

          const now = Date.now();
          setLastSyncTime(now);
          localStorage.setItem(LAST_SYNC_KEY, String(now));
          setHasPendingChanges(false);

          // Upload merged state back to Drive
          const payload = createSyncPayload(mergedSpots, mergedCategories, mergedCustomLists, {
            uiScale,
            isLocationEnabled,
          });
          const uploaded = await uploadSyncData(accessToken, payload, fileMeta.id);
          setCloudMeta({ ...fileMeta, modifiedTime: uploaded.modifiedTime });

          showToast(`Google Driveと同期しました（追加:${addedSpotsCount}件, 更新:${updatedSpotsCount}件）`, 'success');
        } else {
          // Create initial sync file on Drive
          const payload = createSyncPayload(spots, categories, customLists, {
            uiScale,
            isLocationEnabled,
          });
          const uploaded = await uploadSyncData(accessToken, payload);
          setSyncFileId(uploaded.fileId);
          localStorage.setItem(SYNC_FILE_ID_KEY, uploaded.fileId);
          setCloudMeta({ id: uploaded.fileId, name: SYNC_FILE_NAME, modifiedTime: uploaded.modifiedTime });
          setCloudData(payload);

          const now = Date.now();
          setLastSyncTime(now);
          localStorage.setItem(LAST_SYNC_KEY, String(now));
          setHasPendingChanges(false);

          showToast('Google Driveに初期同期データを作成・保存しました', 'success');
        }
      } finally {
        setIsSyncing(false);
      }
    } catch (err: unknown) {
      console.error('Google Sign In failed:', err);
      const msg = err instanceof Error ? err.message : 'Googleログインに失敗しました';
      showToast(msg, 'error');
      throw err;
    }
  };

  // Google Sign Out handler
  const handleSignOut = async () => {
    try {
      await googleSignOut();
      setCurrentUser(null);
      showToast('Googleアカウントからログアウトしました', 'info');
    } catch (err: unknown) {
      console.error('Google Sign Out failed:', err);
      showToast('ログアウトに失敗しました', 'error');
    }
  };

  // Toggle Auto-sync handler
  const handleToggleAutoSync = (enabled: boolean) => {
    setAutoSyncEnabled(enabled);
    localStorage.setItem(AUTO_SYNC_ENABLED_KEY, String(enabled));
    showToast(enabled ? 'Google Drive自動同期を有効にしました' : 'Google Drive自動同期を一時停止しました', 'info');
  };

  // Manual Sync (Smart Merge)
  const handleManualSync = async () => {
    let token = getAccessToken();
    if (!token) {
      const result = await googleSignIn();
      token = result.accessToken;
      setCurrentUser(result.user);
    }

    setIsSyncing(true);
    try {
      const fileMeta = await searchSyncFile(token);
      if (fileMeta) {
        setCloudMeta(fileMeta);
        setSyncFileId(fileMeta.id);
        localStorage.setItem(SYNC_FILE_ID_KEY, fileMeta.id);
        const remoteData = await downloadSyncData(token, fileMeta.id);
        setCloudData(remoteData);

        const { mergedSpots, mergedCategories, mergedCustomLists } = smartMergeSyncData(
          { spots, categories, customLists },
          remoteData
        );
        setSpots(mergedSpots);
        setCategories(mergedCategories);
        setCustomLists(mergedCustomLists);

        const payload = createSyncPayload(mergedSpots, mergedCategories, mergedCustomLists, {
          uiScale,
          isLocationEnabled,
        });
        const updated = await uploadSyncData(token, payload, fileMeta.id);
        setCloudMeta({ ...fileMeta, modifiedTime: updated.modifiedTime });
        setCloudData(payload);

        const now = Date.now();
        setLastSyncTime(now);
        localStorage.setItem(LAST_SYNC_KEY, String(now));
        setHasPendingChanges(false);

        showToast(`同期完了: ${mergedSpots.length}件のスポットを最新状態に統合しました`, 'success');
      } else {
        const payload = createSyncPayload(spots, categories, customLists, {
          uiScale,
          isLocationEnabled,
        });
        const created = await uploadSyncData(token, payload);
        setSyncFileId(created.fileId);
        localStorage.setItem(SYNC_FILE_ID_KEY, created.fileId);
        setCloudMeta({ id: created.fileId, name: SYNC_FILE_NAME, modifiedTime: created.modifiedTime });
        setCloudData(payload);

        const now = Date.now();
        setLastSyncTime(now);
        localStorage.setItem(LAST_SYNC_KEY, String(now));
        setHasPendingChanges(false);

        showToast('Google Driveにデータを保存しました', 'success');
      }
    } catch (err: unknown) {
      console.error('Manual sync failed:', err);
      const msg = err instanceof Error ? err.message : '同期に失敗しました';
      showToast(msg, 'error');
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  // Restore from Cloud (Pull)
  const handleRestoreFromCloud = async () => {
    let token = getAccessToken();
    if (!token) {
      const result = await googleSignIn();
      token = result.accessToken;
      setCurrentUser(result.user);
    }
    setIsSyncing(true);
    try {
      const fileMeta = cloudMeta || (await searchSyncFile(token));
      if (!fileMeta) {
        throw new Error('Google Drive上に同期データが見つかりません');
      }
      const remoteData = await downloadSyncData(token, fileMeta.id);
      setSpots(deduplicateSpots(remoteData.spots || []));
      if (remoteData.categories && remoteData.categories.length > 0) {
        setCategories(deduplicateCategories(remoteData.categories));
      }
      if (remoteData.customLists) {
        setCustomLists(deduplicateCustomLists(remoteData.customLists));
      }
      setCloudData(remoteData);
      const now = Date.now();
      setLastSyncTime(now);
      localStorage.setItem(LAST_SYNC_KEY, String(now));
      setHasPendingChanges(false);
      showToast(`クラウドから復元完了: ${remoteData.spots?.length ?? 0}件のスポットを復元しました`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '復元に失敗しました';
      showToast(msg, 'error');
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  // Force Overwrite Cloud (Push)
  const handleForceOverwriteCloud = async () => {
    let token = getAccessToken();
    if (!token) {
      const result = await googleSignIn();
      token = result.accessToken;
      setCurrentUser(result.user);
    }
    setIsSyncing(true);
    try {
      const payload = createSyncPayload(spots, categories, customLists, {
        uiScale,
        isLocationEnabled,
      });
      const uploaded = await uploadSyncData(token, payload, syncFileId || undefined);
      setSyncFileId(uploaded.fileId);
      localStorage.setItem(SYNC_FILE_ID_KEY, uploaded.fileId);
      setCloudMeta({
        id: uploaded.fileId,
        name: SYNC_FILE_NAME,
        modifiedTime: uploaded.modifiedTime,
      });
      setCloudData(payload);
      const now = Date.now();
      setLastSyncTime(now);
      localStorage.setItem(LAST_SYNC_KEY, String(now));
      setHasPendingChanges(false);
      showToast(`Google Driveへ現在の端末データ（${spots.length}件）を上書き保存しました`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '上書き保存に失敗しました';
      showToast(msg, 'error');
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  // Delete Cloud File
  const handleDeleteCloudFile = async () => {
    const token = getAccessToken();
    if (!token || !syncFileId) {
      throw new Error('同期ファイルが見つかりません');
    }
    setIsSyncing(true);
    try {
      await deleteSyncFile(token, syncFileId);
      setSyncFileId(null);
      localStorage.removeItem(SYNC_FILE_ID_KEY);
      setCloudMeta(null);
      setCloudData(null);
      showToast('Google Driveの同期ファイルを削除しました', 'info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'クラウドファイルの削除に失敗しました';
      showToast(msg, 'error');
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  // Debounced Auto-sync on data change
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setHasPendingChanges(true);

    if (!currentUser || !autoSyncEnabled) return;

    const token = getAccessToken();
    if (!token) return;

    const timer = setTimeout(async () => {
      try {
        setIsSyncing(true);
        const payload = createSyncPayload(spots, categories, customLists, {
          uiScale,
          isLocationEnabled,
        });
        const res = await uploadSyncData(token, payload, syncFileId || undefined);
        if (!syncFileId) {
          setSyncFileId(res.fileId);
          localStorage.setItem(SYNC_FILE_ID_KEY, res.fileId);
        }
        setCloudMeta((prev) => (prev ? { ...prev, modifiedTime: res.modifiedTime } : { id: res.fileId, name: SYNC_FILE_NAME, modifiedTime: res.modifiedTime }));
        setCloudData(payload);
        const now = Date.now();
        setLastSyncTime(now);
        localStorage.setItem(LAST_SYNC_KEY, String(now));
        setHasPendingChanges(false);
      } catch (err) {
        console.warn('Auto sync save error:', err);
      } finally {
        setIsSyncing(false);
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [spots, categories, customLists, currentUser, autoSyncEnabled, syncFileId, uiScale, isLocationEnabled]);

  // Periodic and window-focus multi-device sync
  useEffect(() => {
    if (!currentUser || !autoSyncEnabled) return;

    const checkRemoteUpdate = async () => {
      const token = getAccessToken();
      if (!token) return;

      try {
        const fileMeta = await searchSyncFile(token);
        if (!fileMeta) return;

        const remoteTime = new Date(fileMeta.modifiedTime).getTime();
        if (lastSyncTime && remoteTime > lastSyncTime + 8000) {
          const downloaded = await downloadSyncData(token, fileMeta.id);
          if (downloaded.updatedByDevice !== getDeviceId()) {
            const { mergedSpots, mergedCategories, mergedCustomLists } = smartMergeSyncData(
              { spots, categories, customLists },
              downloaded
            );
            setSpots(mergedSpots);
            setCategories(mergedCategories);
            setCustomLists(mergedCustomLists);
            setCloudData(downloaded);
            setCloudMeta(fileMeta);
            setLastSyncTime(Date.now());
            localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
            showToast(`別の端末（${downloaded.updatedByDevice}）の最新データと自動同期しました`, 'info');
          }
        }
      } catch (e) {
        // Silently catch background poll error
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkRemoteUpdate();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    const interval = setInterval(checkRemoteUpdate, 45000);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [currentUser, autoSyncEnabled, lastSyncTime, spots, categories, customLists]);

  // Request Current Location (Geolocation)
  const handleRequestUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      showToast('お使いのブラウザは現在地取得に対応していません', 'error');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const uLoc: UserLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        setUserLocation(uLoc);
        setIsLocating(false);
        setIsLocationEnabled(true);
        showToast('現在地を取得しました！ピンまでの下道ルートを計算・表示します', 'success');
      },
      (err) => {
        setIsLocating(false);
        let msg = '現在地の取得に失敗しました';
        if (err.code === err.PERMISSION_DENIED) {
          msg = '位置情報の利用が許可されていません。ブラウザの設定をご確認ください。';
        }
        showToast(msg, 'error');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }, []);

  // Toggle Current Location ON / OFF
  const handleToggleLocationEnabled = useCallback(() => {
    setIsLocationEnabled((prev) => {
      const nextState = !prev;
      if (nextState) {
        showToast('現在地機能をONにしました（GPS取得・ルート表示）', 'success');
        if (!userLocation) {
          handleRequestUserLocation();
        }
      } else {
        showToast('現在地機能をOFFにしました（GPS・ルート描画を非表示）', 'info');
      }
      return nextState;
    });
  }, [userLocation, handleRequestUserLocation]);

  // Attempt silent GPS acquisition on mount ONLY if isLocationEnabled is true
  useEffect(() => {
    if (!isLocationEnabled) return;
    if (navigator.geolocation && !userLocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const uLoc: UserLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp,
          };
          setUserLocation(uLoc);
        },
        () => {
          // Silently ignore if prompt not answered
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
      );
    }
  }, [isLocationEnabled]);

  // Compute routes for selected spots when userLocation or selection changes (only if location is enabled)
  useEffect(() => {
    if (!userLocation || !isLocationEnabled) return;

    let isCancelled = false;

    // Spots to calculate: union of selectedSpotIds and selectedSpotId (if active)
    const targetIds = Array.from(
      new Set([...selectedSpotIds, ...(selectedSpotId ? [selectedSpotId] : [])])
    );

    targetIds.forEach(async (id) => {
      const spot = spots.find((s) => s.id === id);
      if (!spot) return;

      // Check if already calculated recently
      if (routesInfoRef.current[id] && routesInfoRef.current[id].status === 'success') return;

      try {
        const route = await fetchLocalRoadRoute(
          { lat: userLocation.lat, lng: userLocation.lng },
          { lat: spot.lat, lng: spot.lng },
          spot.id
        );
        if (!isCancelled) {
          setRoutesInfo((prev) => ({
            ...prev,
            [id]: route,
          }));
        }
      } catch (err) {
        console.error('Failed to calculate route for spot:', id, err);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [userLocation, selectedSpotIds, selectedSpotId, spots, isLocationEnabled]);

  // Toggle multiple pin selection for local road routing
  const handleToggleSelectSpot = (spotId: string) => {
    setSelectedSpotIds((prev) => {
      const isAlready = prev.includes(spotId);
      const next = isAlready ? prev.filter((id) => id !== spotId) : [...prev, spotId];
      if (!isAlready) {
        const spot = spots.find((s) => s.id === spotId);
        showToast(`「${spot?.title || 'ピン'}」を下道ルート比較に追加しました`, 'info');
      }
      return next;
    });
  };

  // 何もないところ（地図余白・背景等）をクリックした時に選択をすべて解除して初期状態に戻す
  const handleClearSelection = useCallback(() => {
    setSelectedSpotId(null);
    setSelectedSpotIds([]);
    setIsDetailModalOpen(false);
    setSelectedPrefecture('all');
  }, []);

  // ESCキーで初期画面（未選択状態）にスムーズに戻る
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isFormModalOpen && !isCategoryModalOpen && !isInstallModalOpen) {
          handleClearSelection();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClearSelection, isFormModalOpen, isCategoryModalOpen, isInstallModalOpen]);

  // 行きたい場所のトグル (Want To Go)
  const handleToggleWantToGo = useCallback((id: string) => {
    setSpots((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const nextState = !s.isWantToGo;
          showToast(
            nextState
              ? `「${s.title}」を行きたい場所に追加しました！📌`
              : `「${s.title}」を行きたい場所から解除しました`,
            'info'
          );
          return {
            ...s,
            isWantToGo: nextState,
            updatedAt: Date.now(),
          };
        }
        return s;
      })
    );
  }, []);

  // 心リストのトグル (Haunted List)
  const handleToggleHaunted = useCallback((id: string) => {
    setSpots((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const current = s.isHaunted ?? (s.category === 'haunted');
          const nextState = !current;
          showToast(
            nextState
              ? `「${s.title}」を心リストに追加しました！👻`
              : `「${s.title}」を心リストから解除しました`,
            'info'
          );
          return {
            ...s,
            isHaunted: nextState,
            updatedAt: Date.now(),
          };
        }
        return s;
      })
    );
  }, []);

  // 新規カスタムリスト作成モーダルを開く
  const handleOpenCreateList = useCallback(() => {
    setEditingList(null);
    setIsCreateListModalOpen(true);
  }, []);

  // カスタムリスト編集モーダルを開く
  const handleOpenEditList = useCallback((list: CustomList) => {
    setEditingList(list);
    setIsCreateListModalOpen(true);
  }, []);

  // 新規カスタムリスト作成
  const handleCreateList = useCallback((newListData: Omit<CustomList, 'id' | 'createdAt'>) => {
    const newList: CustomList = {
      ...newListData,
      id: `list_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now(),
    };
    setCustomLists((prev) => [...prev, newList]);
    showToast(`リスト「${newList.name}」を作成しました！🎉`);
  }, []);

  // 既存カスタムリストの更新（名前・アイコン・カラー・メモの編集）
  const handleUpdateList = useCallback((listId: string, updated: Omit<CustomList, 'id' | 'createdAt'>) => {
    setCustomLists((prev) =>
      prev.map((l) => (l.id === listId ? { ...l, ...updated } : l))
    );
    showToast(`リスト「${updated.name}」の変更を保存しました！`, 'success');
  }, []);

  // カスタムリストの並び替え（前・後ろへの移動）
  const handleMoveCustomList = useCallback((listId: string, direction: 'up' | 'down') => {
    setCustomLists((prev) => {
      const index = prev.findIndex((l) => l.id === listId);
      if (index === -1) return prev;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      const newLists = [...prev];
      const [moved] = newLists.splice(index, 1);
      newLists.splice(targetIndex, 0, moved);
      return newLists;
    });
  }, []);

  // システム標準リスト（行きたい場所・心霊スポット）の初期化リセット
  const handleResetSystemList = useCallback((listId: string) => {
    const defaultItem = INITIAL_DEFAULT_LISTS.find((l) => l.id === listId);
    if (!defaultItem) return;
    setCustomLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? {
              ...l,
              name: defaultItem.name,
              icon: defaultItem.icon,
              color: defaultItem.color,
              description: defaultItem.description,
            }
          : l
      )
    );
    showToast(`リスト「${defaultItem.name}」を初期設定に戻しました`, 'info');
  }, []);

  // リスト一括並び替え（ドラッグ＆ドロップ用）
  const handleReorderCustomLists = useCallback((newLists: CustomList[]) => {
    setCustomLists(newLists);
  }, []);

  // 初期標準リスト（行きたい場所・心リスト）の復元
  const handleRestoreDefaultLists = useCallback(() => {
    setCustomLists((prev) => {
      const existingIds = new Set(prev.map((l) => l.id));
      const missingDefaults = INITIAL_DEFAULT_LISTS.filter((l) => !existingIds.has(l.id));
      if (missingDefaults.length === 0) {
        return prev.map((l) => {
          const def = INITIAL_DEFAULT_LISTS.find((d) => d.id === l.id);
          return def ? { ...l, name: def.name, icon: def.icon, color: def.color, description: def.description } : l;
        });
      }
      return [...prev, ...missingDefaults];
    });
    showToast('初期リスト（行きたい場所・心リスト）を復元しました', 'success');
  }, []);

  // カスタムリスト削除（行きたい場所・心リストも含めゴミ箱で完全削除可能）
  const handleDeleteCustomList = useCallback((listId: string) => {
    setCustomLists((prev) => {
      const target = prev.find((l) => l.id === listId);
      if (target) {
        showToast(`リスト「${target.name}」を削除しました`, 'info');
      }
      return prev.filter((l) => l.id !== listId);
    });

    // 削除されたリストが表示中だった場合は全リスト表示へ切り替え
    setActiveTab((cur) => (cur === listId ? 'all' : cur));

    // スポットの所属からも削除
    setSpots((prev) =>
      prev.map((s) => {
        let changed = false;
        let nextListIds = s.listIds || [];
        if (nextListIds.includes(listId)) {
          nextListIds = nextListIds.filter((id) => id !== listId);
          changed = true;
        }
        let nextWantToGo = s.isWantToGo;
        if (listId === 'want_to_go' && nextWantToGo) {
          nextWantToGo = false;
          changed = true;
        }
        let nextHaunted = s.isHaunted;
        if (listId === 'haunted' && nextHaunted) {
          nextHaunted = false;
          changed = true;
        }

        if (changed) {
          return {
            ...s,
            listIds: nextListIds,
            isWantToGo: nextWantToGo,
            isHaunted: nextHaunted,
            updatedAt: Date.now(),
          };
        }
        return s;
      })
    );
  }, []);

  // スポットのカスタムリスト所属トグル
  const handleToggleSpotCustomList = useCallback((spotId: string, listId: string) => {
    setSpots((prev) =>
      prev.map((s) => {
        if (s.id !== spotId) return s;
        const currentListIds = s.listIds || [];
        const exists = currentListIds.includes(listId);
        const nextListIds = exists
          ? currentListIds.filter((id) => id !== listId)
          : [...currentListIds, listId];
        
        return {
          ...s,
          listIds: nextListIds,
          updatedAt: Date.now(),
        };
      })
    );
  }, []);

  const handleClearSelectedSpots = () => {
    setSelectedSpotId(null);
    setSelectedSpotIds([]);
    setSelectedPrefecture('all');
    showToast('ピンの選択を解除しました', 'info');
  };

  // Reorder spots in pin-to-pin route
  const handleReorderSelectedSpots = (newIds: string[]) => {
    setSelectedSpotIds(newIds);
  };

  const handleSelectPrefecture = (pref: string) => {
    setSelectedPrefecture(pref);
    if (pref !== 'all') {
      const count = spots.filter((s) => s.prefecture === pref).length;
      showToast(`「${pref}」を選択しました (${count}件)`, 'info');
      setShowPrefectureCard(true);
    } else {
      setShowPrefectureCard(false);
    }
  };

  // 訪問済みトグル
  const handleToggleVisited = useCallback((spotId: string) => {
    setSpots((prev) =>
      prev.map((s) => {
        if (s.id !== spotId) return s;
        const nextVisited = !s.isVisited;
        showToast(
          nextVisited ? `「${s.title}」を訪問済みにしました！` : `「${s.title}」を未訪問に戻しました`,
          'success'
        );
        return {
          ...s,
          isVisited: nextVisited,
          visitedDate: nextVisited ? new Date().toISOString().split('T')[0] : undefined,
          updatedAt: Date.now(),
        };
      })
    );
  }, []);

  // スマホ表示用のスポットフィルタリング (検索・基本フィルター・カテゴリ複数選択・都道府県)
  const filteredSpotsForMobile = React.useMemo(() => {
    let result = [...spots];

    // 都道府県
    if (selectedPrefecture !== 'all') {
      result = result.filter((s) => s.prefecture === selectedPrefecture);
    }

    // 基本フィルター: 'all' | 'unvisited' | 'visited' | 'rating4' | 'popular'
    if (mobileBasicFilter === 'unvisited') {
      result = result.filter((s) => !s.isVisited);
    } else if (mobileBasicFilter === 'visited') {
      result = result.filter((s) => !!s.isVisited);
    } else if (mobileBasicFilter === 'rating4') {
      result = result.filter((s) => (s.dangerLevel ?? s.rating ?? 0) >= 4);
    } else if (mobileBasicFilter === 'popular') {
      result = result.filter((s) => (s.photos && s.photos.length > 0) || s.isWantToGo);
    }

    // カテゴリフィルター (複数選択可)
    if (mobileSelectedCategories.length > 0) {
      result = result.filter((s) => {
        const spotCats = s.categories && s.categories.length > 0 ? s.categories : [s.category];
        return mobileSelectedCategories.some((mc) => spotCats.includes(mc));
      });
    }

    // 検索クエリ
    if (mobileSearchQuery.trim()) {
      const q = mobileSearchQuery.trim().toLowerCase();
      result = result.filter((s) => {
        const title = (s.title || '').toLowerCase();
        const addr = (s.address || '').toLowerCase();
        const pref = (s.prefecture || '').toLowerCase();
        const city = (s.city || '').toLowerCase();
        const desc = (s.description || '').toLowerCase();
        const notes = (s.notes || '').toLowerCase();
        return (
          title.includes(q) ||
          addr.includes(q) ||
          pref.includes(q) ||
          city.includes(q) ||
          desc.includes(q) ||
          notes.includes(q)
        );
      });
    }

    // ソート順 (危険度 降順/昇順)
    result.sort((a, b) => {
      const rA = a.dangerLevel ?? a.rating ?? 0;
      const rB = b.dangerLevel ?? b.rating ?? 0;
      return mobileSortOrder === 'asc' ? rA - rB : rB - rA;
    });

    return result;
  }, [spots, selectedPrefecture, mobileBasicFilter, mobileSelectedCategories, mobileSearchQuery, mobileSortOrder]);

  // Selected spot object
  const activeSpot = spots.find((s) => s.id === selectedSpotId) || null;

  // Map click handler (when in Add mode)
  const handleMapClickAdd = (lat: number, lng: number) => {
    setIsAddPinMode(false);
    setPendingLatLng({ lat, lng });
    setEditingSpot(null);
    setIsFormModalOpen(true);
    showToast(`地図上の地点（${lat.toFixed(4)}, ${lng.toFixed(4)}）を選択しました`, 'info');
  };

  // Select a spot (from map pin or sidebar)
  const handleSelectSpot = (id: string, options?: { keepMultiSelect?: boolean; openDetail?: boolean }) => {
    setSelectedSpotId(id);

    // ユーザー要望:「ピン選択したときは複数選択にしないで大丈夫です。ピンごとに１つ１つピン見えるようにして欲しい。地図上の複数選択を押したとき、またはリストのチェックボックスを入れたときにだけ複数選択にほしい」
    if (options?.keepMultiSelect) {
      setSelectedSpotIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    } else {
      // 通常時は単一選択のみ（複数選択にしない）
      setSelectedSpotIds([id]);
    }

    if (options?.openDetail) {
      setIsDetailModalOpen(true);
    }

    // スマホ時はリストから選択されたら自動で地図画面へ切り替え
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setMobileView('map');
      setIsSidebarOpen(false);
    }

    // ピン選択時に現在地を自動でONにしない（ユーザーの手動ON/OFF切り替えを遵守）
    // 現在地が手動でONになっており、すでに現在地が取得されている場合のみ下道ルートを計算
    if (isLocationEnabled && userLocation) {
      const spot = spots.find((s) => s.id === id);
      if (spot && (!routesInfo[id] || routesInfo[id].status !== 'success')) {
        // Immediate provisional route geometry for zero-latency simultaneous rendering
        const straightKm = Math.hypot((userLocation.lat - spot.lat) * 111, (userLocation.lng - spot.lng) * 91);
        const approxRoadKm = straightKm * 1.35;
        const approxMin = Math.round((approxRoadKm / 35) * 60);

        setRoutesInfo((prev) => ({
          ...prev,
          [id]: {
            spotId: id,
            status: 'loading',
            coordinates: [
              [userLocation.lat, userLocation.lng],
              [spot.lat, spot.lng],
            ],
            distanceKm: approxRoadKm,
            durationMinutes: approxMin,
            isLocalRoad: true,
            isApproximate: true,
          },
        }));

        fetchLocalRoadRoute(
          { lat: userLocation.lat, lng: userLocation.lng },
          { lat: spot.lat, lng: spot.lng },
          spot.id
        )
          .then((route) => {
            setRoutesInfo((prev) => ({
              ...prev,
              [id]: route,
            }));
          })
          .catch((err) => {
            console.error('Failed to calculate route for spot:', id, err);
          });
      }
    }
  };

  // Open Full-screen Detail Modal explicitly (from speech-bubble or sidebar detail action)
  const handleOpenDetailModal = (id?: string) => {
    if (id) {
      setSelectedSpotId(id);
      setSelectedSpotIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    }
    setIsDetailModalOpen(true);
  };

  // Open Form to Add New Spot
  const handleOpenAddSpot = () => {
    setEditingSpot(null);
    setPendingLatLng(null);
    setIsFormModalOpen(true);
  };

  // Open Form to Edit existing spot
  const handleOpenEditSpot = (spot: Spot) => {
    setEditingSpot(spot);
    setPendingLatLng(null);
    setIsDetailModalOpen(false);
    setIsFormModalOpen(true);
  };

  // Save Spot (create or edit)
  const handleSaveSpot = (
    data: Omit<Spot, 'id' | 'createdAt' | 'updatedAt'>,
    editId?: string
  ) => {
    if (editId) {
      setSpots((prev) =>
        deduplicateSpots(
          prev.map((s) =>
            s.id === editId
              ? {
                  ...s,
                  ...data,
                  updatedAt: Date.now(),
                }
              : s
          )
        )
      );
      showToast(`「${data.title}」を更新しました`);
      setSelectedSpotId(editId);
    } else {
      const newSpot: Spot = {
        ...data,
        id: `spot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setSpots((prev) => deduplicateSpots([newSpot, ...prev.filter((s) => s.id !== newSpot.id)]));
      setSelectedSpotId(newSpot.id);

      let listNote = '';
      if (activeTab === 'want_to_go' && newSpot.isWantToGo) {
        listNote = '（「📌 行きたい場所」に追加）';
      } else if (activeTab === 'haunted' && newSpot.isHaunted) {
        listNote = '（「👻 心リスト」に追加）';
      } else if (activeTab && activeTab !== 'all' && activeTab !== 'prefecture') {
        const cl = customLists.find((l) => l.id === activeTab);
        if (cl && newSpot.listIds?.includes(cl.id)) {
          listNote = `（「${cl.icon || '⭐'} ${cl.name}」リストに追加）`;
        }
      }
      showToast(`「${newSpot.title}」を登録しました！${listNote}`, 'success');
    }
    setPendingLatLng(null);
  };

  // Delete spot
  const handleDeleteSpot = (spotId: string) => {
    const spotToDelete = spots.find((s) => s.id === spotId);
    setSpots((prev) => prev.filter((s) => s.id !== spotId));
    setSelectedSpotIds((prev) => prev.filter((id) => id !== spotId));
    if (selectedSpotId === spotId) {
      setSelectedSpotId(null);
      setIsDetailModalOpen(false);
    }
    showToast(`「${spotToDelete?.title || 'スポット'}」を削除しました`, 'info');
  };

  // Reset to initial sample spots
  const handleResetSamples = () => {
    setShowResetSamplesConfirm(true);
  };

  // Export JSON backup
  const handleExportData = () => {
    const exportPayload = {
      version: '2.1',
      spots,
      categories,
      customLists,
      exportedAt: new Date().toISOString(),
    };
    const jsonStr = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `haunted_map_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('バックアップJSONファイルを保存しました');
  };

  // Import JSON backup
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (imported && Array.isArray(imported.spots)) {
          const dedupedSpots = deduplicateSpots(imported.spots);
          setSpots(dedupedSpots);
          if (Array.isArray(imported.categories)) {
            setCategories(deduplicateCategories(imported.categories));
          }
          if (Array.isArray(imported.customLists)) {
            setCustomLists(deduplicateCustomLists(imported.customLists));
          }
          setSelectedSpotId(null);
          setSelectedSpotIds([]);
          showToast(`バックアップから${dedupedSpots.length}件のスポットを復元しました`);
        } else if (Array.isArray(imported)) {
          const dedupedSpots = deduplicateSpots(imported);
          setSpots(dedupedSpots);
          setSelectedSpotId(null);
          setSelectedSpotIds([]);
          showToast(`バックアップから${dedupedSpots.length}件のスポットを復元しました`);
        } else {
          showToast('正しいJSON形式のスポットデータではありません。', 'error');
        }
      } catch {
        showToast('ファイルの読み込みに失敗しました。', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-screen h-[100dvh] w-full bg-slate-100 overflow-hidden font-sans text-slate-800">
      {isMobile ? (
        /* ================= SMARTPHONE DEDICATED UI (768px以下) ================= */
        <div className="relative flex-1 flex flex-col h-full h-screen h-[100dvh] w-full bg-slate-950 overflow-hidden text-slate-100">
          {/* 1. 検索バー ＆ 2. 基本フィルター ＆ 3. カテゴリフィルター */}
          <MobileFilterBar
            searchQuery={mobileSearchQuery}
            onSearchChange={setMobileSearchQuery}
            selectedBasicFilter={mobileBasicFilter}
            onBasicFilterChange={setMobileBasicFilter}
            selectedCategoryIds={mobileSelectedCategories}
            onToggleCategory={(catId) => {
              setMobileSelectedCategories((prev) =>
                prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
              );
            }}
            onClearCategories={() => setMobileSelectedCategories([])}
            totalFilteredCount={filteredSpotsForMobile.length}
            onOpenFilterModal={() => setIsFilterSearchModalOpen(true)}
            sortOrder={mobileSortOrder}
            onToggleSortOrder={() => setMobileSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
            onOpenCategoryManager={() => setIsCategoryModalOpen(true)}
            onOpenListSettings={() => setIsListSettingsModalOpen(true)}
            categories={categories}
            onOpenCloudSync={() => setIsCloudSyncModalOpen(true)}
            isCloudSyncActive={!!currentUser}
            onOpenDataModal={() => setIsDataModalOpen(true)}
          />

          {/* 4. 地図 (全画面大画面表示) または「一覧」選択時のリスト表示 (Screen 6 準拠) */}
          <div className="flex-1 relative w-full overflow-hidden">
            {mobileNavTab === 'list' ? (
              <MobileSpotListView
                spots={filteredSpotsForMobile}
                selectedPrefecture={selectedPrefecture}
                onClearPrefecture={() => setSelectedPrefecture('all')}
                onSelectSpot={(id) => {
                  handleSelectSpot(id);
                  setMobileNavTab('map');
                }}
                onOpenDetailModal={handleOpenDetailModal}
                onBackToMap={() => setMobileNavTab('map')}
                categories={categories}
                userLocation={userLocation}
                routesInfo={routesInfo}
                onOpenCategoryManager={() => setIsCategoryModalOpen(true)}
                onOpenListSettings={() => setIsListSettingsModalOpen(true)}
              />
            ) : (
              <JapanMap
                spots={filteredSpotsForMobile}
                selectedSpotId={selectedSpotId}
                selectedSpotIds={selectedSpotIds}
                onSelectSpot={handleSelectSpot}
                onOpenDetailModal={handleOpenDetailModal}
                onCloseDetailModal={() => {
                  setSelectedSpotId(null);
                  setIsDetailModalOpen(false);
                }}
                isDetailModalOpen={isDetailModalOpen}
                onToggleSelectSpot={handleToggleSelectSpot}
                onClearSelectedSpots={handleClearSelectedSpots}
                onClearSelection={handleClearSelection}
                onReorderSelectedSpots={handleReorderSelectedSpots}
                onMapClickAdd={handleMapClickAdd}
                isAddMode={isAddPinMode}
                selectedPrefecture={selectedPrefecture}
                onSelectPrefecture={handleSelectPrefecture}
                categories={categories}
                userLocation={userLocation}
                routesInfo={routesInfo}
                onRequestUserLocation={handleRequestUserLocation}
                isLocating={isLocating}
                isLocationEnabled={isLocationEnabled}
                onToggleLocationEnabled={handleToggleLocationEnabled}
                onToggleWantToGo={handleToggleWantToGo}
                onToggleHaunted={handleToggleHaunted}
                customLists={customLists}
                onOpenListManager={(spotId) => setListManagerSpotId(spotId)}
                onEditSpot={handleOpenEditSpot}
              />
            )}
          </div>

          {/* 都道府県情報カード */}
          {showPrefectureCard && selectedPrefecture && selectedPrefecture !== 'all' && (
            <PrefectureInfoCard
              prefecture={selectedPrefecture}
              spots={spots}
              onClose={() => setShowPrefectureCard(false)}
              onViewList={() => {
                setShowPrefectureCard(false);
                setMobileNavTab('list');
              }}
            />
          )}

          {/* 5. Bottom Sheet (スポットタップ時) */}
          {activeSpot && !isDetailModalOpen && (
            <MobileSpotBottomSheet
              spot={activeSpot}
              userLocation={userLocation}
              routeInfo={routesInfo[activeSpot.id]}
              isMultiSelected={selectedSpotIds.includes(activeSpot.id)}
              onClose={() => setSelectedSpotId(null)}
              onOpenDetail={(spotId) => handleOpenDetailModal(spotId)}
              onStartRoute={() => handleToggleSelectSpot(activeSpot.id)}
              onToggleMultiSelect={(spotId) => handleToggleSelectSpot(spotId)}
              onToggleVisited={(spotId) => handleToggleVisited(spotId)}
            />
          )}

          {/* 6. 下部固定ナビゲーション */}
          <MobileBottomNav
            currentTab={mobileNavTab}
            onSelectTab={(tab) => {
              if (tab === 'visited') {
                setMobileBasicFilter((prev) => (prev === 'visited' ? 'all' : 'visited'));
                setMobileNavTab('map');
              } else if (tab === 'settings') {
                setIsListSettingsModalOpen(true);
              } else {
                setMobileNavTab(tab);
              }
            }}
            onOpenAddSpot={handleOpenAddSpot}
            spotsCount={filteredSpotsForMobile.length}
            visitedCount={spots.filter((s) => !!s.isVisited).length}
          />

          {/* 7. 検索・フィルターモーダル */}
          <FilterSearchModal
            isOpen={isFilterSearchModalOpen}
            onClose={() => setIsFilterSearchModalOpen(false)}
            selectedPrefecture={selectedPrefecture}
            onSelectPrefecture={(pref) => {
              setSelectedPrefecture(pref);
              if (pref !== 'all') {
                setShowPrefectureCard(true);
              }
            }}
            visitStatus={
              mobileBasicFilter === 'visited'
                ? 'visited'
                : mobileBasicFilter === 'unvisited'
                ? 'unvisited'
                : 'all'
            }
            onSelectVisitStatus={(status) => {
              if (status === 'visited') setMobileBasicFilter('visited');
              else if (status === 'unvisited') setMobileBasicFilter('unvisited');
              else setMobileBasicFilter('all');
            }}
            minRating={mobileBasicFilter === 'rating4' ? 4 : 0}
            onSelectMinRating={(rating) => {
              if (rating >= 4) setMobileBasicFilter('rating4');
              else setMobileBasicFilter('all');
            }}
            categories={categories}
            selectedCategoryIds={mobileSelectedCategories}
            onToggleCategory={(catId) => {
              setMobileSelectedCategories((prev) =>
                prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
              );
            }}
            sortBy={mobileSortOrder === 'asc' ? 'rating_asc' : 'rating_desc'}
            onSelectSortBy={(sort) => {
              setMobileSortOrder(sort.includes('asc') ? 'asc' : 'desc');
            }}
            searchQuery={mobileSearchQuery}
            onSearchChange={setMobileSearchQuery}
            onReset={() => {
              setMobileSearchQuery('');
              setMobileBasicFilter('all');
              setMobileSelectedCategories([]);
              setSelectedPrefecture('all');
            }}
            totalFilteredCount={filteredSpotsForMobile.length}
            onOpenCategoryManager={() => setIsCategoryModalOpen(true)}
            onOpenListSettings={() => setIsListSettingsModalOpen(true)}
          />
        </div>
      ) : (
        /* ================= PC & TABLET BROWSER UI (維持) ================= */
        <>
          {/* Top Application Header */}
          <header className="h-14 bg-white border-b border-slate-200 z-30 flex-shrink-0 shadow-xs w-full">
            <div className="w-full max-w-[1920px] mx-auto px-2 sm:px-4 h-full flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Sidebar Toggle Button (PC / Tablet) */}
                <button
                  id="toggle-sidebar-btn"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer hidden md:flex"
                  title={isSidebarOpen ? 'リストを閉じる（地図を最大化）' : 'リストを開く'}
                >
                  {isSidebarOpen ? (
                    <PanelLeftClose className="w-5 h-5" />
                  ) : (
                    <PanelLeftOpen className="w-5 h-5" />
                  )}
                </button>

                {/* App Title & Icon */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-violet-700 to-indigo-600 flex items-center justify-center text-white shadow-xs text-sm sm:text-base">
                    👻
                  </div>
                  <div>
                    <h1 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 sm:gap-2 leading-none">
                      <span className="sm:hidden">日本地図ナビ</span>
                      <span className="hidden sm:inline">日本地図ピン＆下道ナビマップ</span>
                      <span className="hidden md:inline text-[10px] font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
                        47都道府県・下道ルート対応
                      </span>
                    </h1>
                    <p className="text-[11px] text-slate-500 mt-0.5 hidden lg:block">
                      心霊スポット・名所の複数ピン選択＆下道での距離・所要時間を一括比較
                    </p>
                  </div>
                </div>
              </div>

              {/* Header Right Actions */}
              <div className="flex items-center gap-2">
                {/* Active Prefecture Filter Badge */}
                {selectedPrefecture !== 'all' && (
                  <div className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 text-violet-800 px-2.5 py-1 rounded-xl text-xs font-bold shadow-2xs animate-in fade-in">
                    <span>🗾 {selectedPrefecture}のみ表示</span>
                    <button
                      id="header-clear-pref-btn"
                      onClick={() => setSelectedPrefecture('all')}
                      title="全県表示に戻す"
                      className="hover:bg-violet-200/80 p-0.5 rounded-full text-violet-600 hover:text-violet-900 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* List Manager Modal Trigger (リスト編集) */}
                <button
                  id="open-list-manager-header-btn"
                  onClick={() => setIsListSettingsModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold hidden md:flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                  title="リストの作成・並び替え・名前変更・整理"
                >
                  <ListOrdered className="w-3.5 h-3.5 text-violet-600" />
                  <span>リスト編集</span>
                </button>

                {/* Category Manager Modal Trigger (カテゴリ編集) */}
                <button
                  id="open-category-manager-header-btn"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold hidden md:flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                  title="カテゴリ名・色・アイコンの変更"
                >
                  <Settings2 className="w-3.5 h-3.5 text-violet-600" />
                  <span>カテゴリ編集</span>
                </button>

                {/* Web App (PWA) Install Modal Trigger */}
                <button
                  id="header-pwa-install-btn"
                  onClick={() => setIsInstallModalOpen(true)}
                  className="hidden sm:flex px-2.5 sm:px-3 py-1.5 rounded-xl border border-violet-200 bg-violet-50/80 hover:bg-violet-100 text-violet-800 text-xs font-bold items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                  title="スマートフォンやPCのホーム画面に追加してWebアプリとして利用"
                >
                  <Smartphone className="w-3.5 h-3.5 text-violet-600" />
                  <span>Webアプリ化</span>
                </button>

                {/* Google Drive Cloud Sync Modal Trigger */}
                <button
                  id="header-cloud-sync-btn"
                  onClick={() => setIsCloudSyncModalOpen(true)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all ${
                    currentUser
                      ? isSyncing
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : hasPendingChanges
                        ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                        : 'bg-emerald-50/90 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                  title="Google Driveクラウド同期（自動保存・他端末と同期）"
                >
                  <Cloud
                    className={`w-3.5 h-3.5 ${
                      currentUser
                        ? isSyncing
                          ? 'animate-spin text-blue-600'
                          : hasPendingChanges
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                        : 'text-slate-500'
                    }`}
                  />
                  <span className="hidden sm:inline">
                    {currentUser
                      ? isSyncing
                        ? '同期中...'
                        : hasPendingChanges
                        ? '未同期あり'
                        : 'Drive同期中'
                      : 'Drive同期'}
                  </span>
                  {currentUser && !isSyncing && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        hasPendingChanges ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                    ></span>
                  )}
                </button>

                {/* Geolocation ON/OFF Toggle */}
                <button
                  id="header-location-btn"
                  onClick={handleToggleLocationEnabled}
                  disabled={isLocating}
                  className={`hidden sm:flex px-3 py-1.5 rounded-xl border text-xs font-bold items-center gap-1.5 cursor-pointer transition-all shadow-2xs ${
                    isLocationEnabled
                      ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 shadow-blue-500/10'
                      : 'bg-white hover:bg-slate-50 text-slate-500 border-slate-200'
                  }`}
                  title={
                    isLocationEnabled
                      ? '現在地機能: ON（クリックでOFFに切り替え）'
                      : '現在地機能: OFF（クリックでONにして現在地・ルートを表示）'
                  }
                >
                  {isLocating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  ) : isLocationEnabled ? (
                    <Navigation className="w-3.5 h-3.5 text-blue-600 fill-current" />
                  ) : (
                    <NavigationOff className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>現在地 {isLocationEnabled ? 'ON' : 'OFF'}</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isLocationEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                    }`}
                  />
                </button>

                {/* Layout Toggle: Side vs Bottom */}
                <div className="bg-slate-100 p-0.5 rounded-xl hidden md:flex items-center border border-slate-200 text-xs font-medium">
                  <button
                    id="layout-side-btn"
                    onClick={() => {
                      setLayoutMode('side');
                      setIsSidebarOpen(true);
                    }}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                      layoutMode === 'side'
                        ? 'bg-white text-slate-900 font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="地図の横にリストを表示"
                  >
                    <Columns2 className="w-3.5 h-3.5 text-violet-600" />
                    <span>横リスト</span>
                  </button>
                  <button
                    id="layout-bottom-btn"
                    onClick={() => setLayoutMode('bottom')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                      layoutMode === 'bottom'
                        ? 'bg-white text-slate-900 font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="地図の下にリストを表示"
                  >
                    <Rows3 className="w-3.5 h-3.5 text-violet-600" />
                    <span>下リスト</span>
                  </button>
                </div>

                {/* UI Scale Selector */}
                <div
                  id="ui-scale-selector"
                  className="bg-slate-100 p-0.5 rounded-xl flex items-center border border-slate-200 text-xs font-medium"
                  title="全体の表示サイズ切り替え"
                >
                  <span className="px-1.5 text-[10px] text-slate-500 font-bold hidden xl:inline">表示倍率:</span>
                  {(['75', '85', '100'] as const).map((scale) => (
                    <button
                      key={scale}
                      type="button"
                      onClick={() => handleSetUiScale(scale)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-0.5 ${
                        uiScale === scale
                          ? 'bg-white text-violet-700 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                      title={`画面全体の表示倍率を${scale}%${scale === '100' ? '（標準）' : ''}に変更`}
                    >
                      <span>{scale}%</span>
                      {scale === '100' && (
                        <span className="text-[10px] text-violet-500 font-normal hidden md:inline">
                          (標準)
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Click to Pin Mode Toggle */}
                <button
                  id="toggle-map-pin-mode-btn"
                  onClick={() => setIsAddPinMode(!isAddPinMode)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                    isAddPinMode
                      ? 'bg-violet-600 text-white border-violet-600 shadow-sm animate-pulse'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
                  }`}
                  title="地図上を直接クリックしてピンを配置するモード"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">
                    {isAddPinMode ? 'ピン指定中 (地図をクリック)' : '地図クリックでピン配置'}
                  </span>
                  <span className="md:hidden">ピン指定</span>
                </button>

                {/* Add Spot Primary Button */}
                <button
                  id="header-add-spot-btn"
                  onClick={handleOpenAddSpot}
                  className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">スポット登録</span>
                  <span className="sm:hidden">追加</span>
                </button>
              </div>
            </div>
          </header>

          {/* Quick Pin Action Bar */}
          <div className="bg-slate-50/95 border-b border-slate-200 px-2 sm:px-4 py-1.5 shadow-2xs z-10 w-full flex-shrink-0">
            <div className="w-full max-w-[1920px] mx-auto flex items-center justify-between gap-3">
              <div className="flex-1 max-w-full sm:max-w-2xl">
                <QuickPinBar
                  categories={categories}
                  onPinCreated={(newSpotData) => {
                    handleSaveSpot(newSpotData);
                  }}
                  showToast={showToast}
                />
              </div>
              <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                <span>💡 共有リンク（maps.app.goo.gl 等）または住所から即ピン設置</span>
              </div>
            </div>
          </div>

          {/* Main Container: Dynamic Side vs Bottom Layout */}
          <div className="relative flex-1 flex flex-col overflow-hidden pb-14 sm:pb-0 w-full">
            <div className="w-full max-w-[1920px] mx-auto flex-1 flex flex-col overflow-hidden h-full">
              {layoutMode === 'side' ? (
                /* ================= SIDE-BY-SIDE ON PC ================= */
                <div className="relative flex-1 flex flex-col md:flex-row overflow-hidden h-full w-full">
                  <aside
                    id="main-spot-list"
                    className={`order-2 md:order-1 transition-all duration-300 ease-in-out flex-shrink-0 bg-white ${
                      isSidebarOpen
                        ? 'w-full md:w-[42%] lg:w-[36%] xl:w-[32%] 2xl:w-[28%] max-w-full md:max-w-[600px] min-w-0 md:min-w-[320px] flex-1 md:flex-initial h-auto md:h-full overflow-hidden'
                        : 'hidden md:hidden'
                    }`}
                  >
                    <div className="w-full h-full flex flex-col">
                      <SpotListSidebar
                        spots={spots}
                        selectedSpotId={selectedSpotId}
                        selectedSpotIds={selectedSpotIds}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        onSelectSpot={handleSelectSpot}
                        onOpenDetailModal={handleOpenDetailModal}
                        onToggleSelectSpot={handleToggleSelectSpot}
                        onClearSelection={handleClearSelection}
                        onAddNewSpot={handleOpenAddSpot}
                        onResetSamples={handleResetSamples}
                        onExportData={handleExportData}
                        onImportData={handleImportData}
                        onOpenDataModal={() => setIsDataModalOpen(true)}
                        isBottomLayout={false}
                        selectedPrefecture={selectedPrefecture}
                        onSelectPrefecture={handleSelectPrefecture}
                        categories={categories}
                        onOpenCategoryManager={() => setIsCategoryModalOpen(true)}
                        routesInfo={routesInfo}
                        userLocation={userLocation}
                        isLocationEnabled={isLocationEnabled}
                        onCloseSidebar={() => {
                          if (window.innerWidth >= 768) {
                            setIsSidebarOpen(false);
                          } else {
                            document.getElementById('main-map-viewport')?.scrollIntoView({ behavior: 'smooth' });
                          }
                        }}
                        onToggleWantToGo={handleToggleWantToGo}
                        onToggleHaunted={handleToggleHaunted}
                        customLists={customLists}
                        onOpenCreateList={handleOpenCreateList}
                        onEditCustomList={handleOpenEditList}
                        onMoveCustomList={handleMoveCustomList}
                        onOpenListSettings={() => setIsListSettingsModalOpen(true)}
                        onOpenListManager={(spotId) => setListManagerSpotId(spotId)}
                        onDeleteCustomList={handleDeleteCustomList}
                        onReorderCustomLists={handleReorderCustomLists}
                        onEditSpot={handleOpenEditSpot}
                        onDeleteSpot={handleDeleteSpot}
                        onOpenCloudSync={() => setIsCloudSyncModalOpen(true)}
                        isCloudSyncActive={!!currentUser}
                      />
                    </div>
                  </aside>

                  <main
                    id="main-map-viewport"
                    className="order-1 md:order-2 flex-1 relative w-full h-[44vh] sm:h-[48vh] md:h-full min-h-[260px] md:min-h-0 min-w-0 bg-slate-100 flex-shrink-0 md:flex-shrink"
                  >
                    <JapanMap
                      spots={spots}
                      selectedSpotId={selectedSpotId}
                      selectedSpotIds={selectedSpotIds}
                      onSelectSpot={handleSelectSpot}
                      onOpenDetailModal={handleOpenDetailModal}
                      onCloseDetailModal={() => setIsDetailModalOpen(false)}
                      isDetailModalOpen={isDetailModalOpen}
                      onToggleSelectSpot={handleToggleSelectSpot}
                      onClearSelectedSpots={handleClearSelectedSpots}
                      onClearSelection={handleClearSelection}
                      onReorderSelectedSpots={handleReorderSelectedSpots}
                      onMapClickAdd={handleMapClickAdd}
                      isAddMode={isAddPinMode}
                      selectedPrefecture={selectedPrefecture}
                      onSelectPrefecture={handleSelectPrefecture}
                      categories={categories}
                      userLocation={userLocation}
                      routesInfo={routesInfo}
                      onRequestUserLocation={handleRequestUserLocation}
                      isLocating={isLocating}
                      isLocationEnabled={isLocationEnabled}
                      onToggleLocationEnabled={handleToggleLocationEnabled}
                      onToggleWantToGo={handleToggleWantToGo}
                      onToggleHaunted={handleToggleHaunted}
                      customLists={customLists}
                      onOpenListManager={(spotId) => setListManagerSpotId(spotId)}
                      onEditSpot={handleOpenEditSpot}
                    />
                  </main>
                </div>
              ) : (
                /* ================= UNDERNEATH (BOTTOM) LAYOUT ON PC ================= */
                <div className="relative flex-1 flex flex-col overflow-hidden h-full w-full">
                  <main
                    id="main-map-viewport"
                    className="h-[44vh] sm:h-[50%] md:h-[52%] min-h-[260px] relative w-full bg-slate-100 border-b border-slate-200 flex-shrink-0"
                  >
                    <JapanMap
                      spots={spots}
                      selectedSpotId={selectedSpotId}
                      selectedSpotIds={selectedSpotIds}
                      onSelectSpot={handleSelectSpot}
                      onOpenDetailModal={handleOpenDetailModal}
                      onCloseDetailModal={() => setIsDetailModalOpen(false)}
                      isDetailModalOpen={isDetailModalOpen}
                      onToggleSelectSpot={handleToggleSelectSpot}
                      onClearSelectedSpots={handleClearSelectedSpots}
                      onClearSelection={handleClearSelection}
                      onReorderSelectedSpots={handleReorderSelectedSpots}
                      onMapClickAdd={handleMapClickAdd}
                      isAddMode={isAddPinMode}
                      selectedPrefecture={selectedPrefecture}
                      onSelectPrefecture={handleSelectPrefecture}
                      categories={categories}
                      userLocation={userLocation}
                      routesInfo={routesInfo}
                      onRequestUserLocation={handleRequestUserLocation}
                      isLocating={isLocating}
                      isLocationEnabled={isLocationEnabled}
                      onToggleLocationEnabled={handleToggleLocationEnabled}
                      onToggleWantToGo={handleToggleWantToGo}
                      onToggleHaunted={handleToggleHaunted}
                      customLists={customLists}
                      onOpenListManager={(spotId) => setListManagerSpotId(spotId)}
                      onEditSpot={handleOpenEditSpot}
                    />
                  </main>

                  <section
                    id="main-spot-list"
                    className="flex-1 min-h-0 w-full overflow-hidden bg-white"
                  >
                    <SpotListSidebar
                      spots={spots}
                      selectedSpotId={selectedSpotId}
                      selectedSpotIds={selectedSpotIds}
                      activeTab={activeTab}
                      onTabChange={setActiveTab}
                      onSelectSpot={handleSelectSpot}
                      onOpenDetailModal={handleOpenDetailModal}
                      onToggleSelectSpot={handleToggleSelectSpot}
                      onClearSelection={handleClearSelection}
                      onAddNewSpot={handleOpenAddSpot}
                      onResetSamples={handleResetSamples}
                      onExportData={handleExportData}
                      onImportData={handleImportData}
                      onOpenDataModal={() => setIsDataModalOpen(true)}
                      isBottomLayout={true}
                      selectedPrefecture={selectedPrefecture}
                      onSelectPrefecture={handleSelectPrefecture}
                      categories={categories}
                      onOpenCategoryManager={() => setIsCategoryModalOpen(true)}
                      routesInfo={routesInfo}
                      userLocation={userLocation}
                      isLocationEnabled={isLocationEnabled}
                      onCloseSidebar={() => {
                        document.getElementById('main-map-viewport')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      onToggleWantToGo={handleToggleWantToGo}
                      onToggleHaunted={handleToggleHaunted}
                      customLists={customLists}
                      onOpenCreateList={handleOpenCreateList}
                      onEditCustomList={handleOpenEditList}
                      onMoveCustomList={handleMoveCustomList}
                      onOpenListSettings={() => setIsListSettingsModalOpen(true)}
                      onOpenListManager={(spotId) => setListManagerSpotId(spotId)}
                      onDeleteCustomList={handleDeleteCustomList}
                      onReorderCustomLists={handleReorderCustomLists}
                      onEditSpot={handleOpenEditSpot}
                      onDeleteSpot={handleDeleteSpot}
                      onOpenCloudSync={() => setIsCloudSyncModalOpen(true)}
                      isCloudSyncActive={!!currentUser}
                    />
                  </section>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Spot Detail Modal */}
      <SpotDetailModal
        spot={activeSpot}
        isOpen={isDetailModalOpen}
        categories={categories}
        userLocation={userLocation}
        isLocationEnabled={isLocationEnabled}
        routeInfo={activeSpot ? routesInfo[activeSpot.id] : null}
        onClose={() => setIsDetailModalOpen(false)}
        onEdit={handleOpenEditSpot}
        onDelete={handleDeleteSpot}
        onAddMorePhotos={handleOpenEditSpot}
        onFilterByPrefecture={handleSelectPrefecture}
        onToggleSelectForRoute={activeSpot ? () => handleToggleSelectSpot(activeSpot.id) : undefined}
        isSelectedForRoute={activeSpot ? selectedSpotIds.includes(activeSpot.id) : false}
        onToggleWantToGo={handleToggleWantToGo}
        onToggleHaunted={handleToggleHaunted}
        customLists={customLists}
        onOpenListManager={(spotId) => setListManagerSpotId(spotId)}
        onToggleLocationEnabled={handleToggleLocationEnabled}
      />

      {/* Create / Edit Custom List Modal */}
      <CreateListModal
        isOpen={isCreateListModalOpen}
        initialList={editingList}
        onClose={() => {
          setIsCreateListModalOpen(false);
          setEditingList(null);
        }}
        onCreateList={handleCreateList}
        onUpdateList={handleUpdateList}
        onDeleteList={handleDeleteCustomList}
      />

      {/* Spot to List Assignment Manager Modal */}
      <SpotListManagerModal
        isOpen={!!listManagerSpotId}
        spot={spots.find((s) => s.id === listManagerSpotId) || null}
        customLists={customLists}
        onClose={() => setListManagerSpotId(null)}
        onToggleWantToGo={handleToggleWantToGo}
        onToggleHaunted={handleToggleHaunted}
        onToggleCustomList={handleToggleSpotCustomList}
        onOpenCreateList={handleOpenCreateList}
        onEditCustomList={handleOpenEditList}
        onMoveCustomList={handleMoveCustomList}
        onReorderCustomLists={handleReorderCustomLists}
        onDeleteCustomList={handleDeleteCustomList}
      />

      {/* Overall List Settings & Reorder Modal */}
      <ListSettingsModal
        isOpen={isListSettingsModalOpen}
        onClose={() => setIsListSettingsModalOpen(false)}
        customLists={customLists}
        spots={spots}
        onOpenCreateList={handleOpenCreateList}
        onEditCustomList={handleOpenEditList}
        onMoveCustomList={handleMoveCustomList}
        onReorderCustomLists={handleReorderCustomLists}
        onDeleteCustomList={handleDeleteCustomList}
        onResetCustomList={handleResetSystemList}
        onRestoreDefaultLists={handleRestoreDefaultLists}
      />

      {/* Spot Form Modal (Create or Edit Spot) */}
      <SpotFormModal
        isOpen={isFormModalOpen}
        initialSpot={editingSpot}
        initialLatLng={pendingLatLng}
        categories={categories}
        customLists={customLists}
        activeTab={activeTab}
        selectedPrefecture={selectedPrefecture}
        onOpenCategoryManager={() => setIsCategoryModalOpen(true)}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingSpot(null);
          setPendingLatLng(null);
        }}
        onSave={handleSaveSpot}
        onRequestPickOnMap={() => {
          setIsFormModalOpen(false);
          setIsAddPinMode(true);
        }}
        userLocation={userLocation}
      />

      {/* Category Manager Modal (Rename & customize categories) */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        categories={categories}
        onClose={() => setIsCategoryModalOpen(false)}
        onSaveCategories={(newCats) => {
          setCategories(newCats);
          showToast('カテゴリ設定を保存しました');
        }}
      />

      {/* Web App (PWA) Install & Setup Guide Modal */}
      <InstallPwaModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        deferredPrompt={deferredPrompt}
        onInstalled={() => {
          setIsPwaInstalled(true);
          setDeferredPrompt(null);
          showToast('Webアプリとしてホーム画面に登録されました！', 'success');
        }}
      />

      {/* Google Drive Cloud Sync Modal */}
      <CloudSyncModal
        isOpen={isCloudSyncModalOpen}
        onClose={() => setIsCloudSyncModalOpen(false)}
        currentUser={currentUser}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
        cloudMeta={cloudMeta}
        cloudData={cloudData}
        spots={spots}
        categories={categories}
        customLists={customLists}
        autoSyncEnabled={autoSyncEnabled}
        onToggleAutoSync={handleToggleAutoSync}
        onManualSync={handleManualSync}
        onRestoreFromCloud={handleRestoreFromCloud}
        onForceOverwriteCloud={handleForceOverwriteCloud}
        onDeleteCloudFile={handleDeleteCloudFile}
        hasPendingChanges={hasPendingChanges}
      />

      {/* Reset Samples Confirmation Modal */}
      {showResetSamplesConfirm && (
        <ConfirmDeleteModal
          isOpen={showResetSamplesConfirm}
          title="初期サンプルに戻す"
          itemName="登録データ"
          description="スポットとカテゴリを初期サンプル（心霊スポット名所）にリセットします。"
          confirmLabel="リセットする"
          onConfirm={() => {
            setSpots(deduplicateSpots(INITIAL_SAMPLE_SPOTS));
            setCategories(deduplicateCategories(INITIAL_CATEGORIES));
            setSelectedSpotId(null);
            setSelectedSpotIds([]);
            setSelectedPrefecture('all');
            showToast('サンプルデータを再読み込みしました');
            setShowResetSamplesConfirm(false);
          }}
          onCancel={() => setShowResetSamplesConfirm(false)}
        />
      )}

      {/* Data Export / Import Modal (CSV & JSON) */}
      <DataExportImportModal
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
        spots={spots}
        filteredSpots={filteredSpotsForMobile}
        categories={categories}
        customLists={customLists}
        onSaveSpots={(newSpots) => {
          setSpots(deduplicateSpots(newSpots));
          setSelectedSpotId(null);
          setSelectedSpotIds([]);
        }}
        onExportJson={handleExportData}
        onImportJson={handleImportData}
        showToast={showToast}
      />

      {/* Notification Toast */}
      {toast && (
        <div
          id="app-toast-notification"
          className="fixed bottom-16 sm:bottom-6 right-4 sm:right-6 z-[900] bg-slate-900/90 backdrop-blur-md text-white px-4 py-2.5 rounded-xl shadow-xl border border-white/10 flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : toast.type === 'error' ? (
            <X className="w-4 h-4 text-rose-400 flex-shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
