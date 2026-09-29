import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Spot, CustomCategory, SpotRouteInfo, UserLocation, SpotListTab, CustomList } from '../types';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { JAPAN_PREFECTURES, INITIAL_CATEGORIES, getCategoryDisplay, getCategoryMeta, getSpotMainCategory } from '../data/sampleSpots';
import { formatDistanceJapanese, formatDurationJapanese } from '../utils/routeUtils';
import {
  Search,
  Star,
  MapPin,
  Image as ImageIcon,
  Plus,
  Download,
  Upload,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Building2,
  ListFilter,
  Check,
  Settings2,
  Car,
  ExternalLink,
  CheckSquare,
  Square,
  Map as MapIcon,
  X,
  Bookmark,
  Ghost,
  Tag,
  FolderPlus,
  Edit3,
  Trash2,
  ListOrdered,
  Cloud,
  CloudCheck,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';

interface SpotListSidebarProps {
  spots: Spot[];
  selectedSpotId: string | null;
  selectedSpotIds: string[];
  activeTab?: SpotListTab;
  onTabChange?: (tab: SpotListTab) => void;
  onToggleWantToGo?: (id: string) => void;
  onToggleHaunted?: (id: string) => void;
  onSelectSpot: (id: string) => void;
  onOpenDetailModal?: (id: string) => void;
  onToggleSelectSpot: (id: string) => void;
  onClearSelection?: () => void;
  onAddNewSpot: () => void;
  onResetSamples: () => void;
  onExportData: () => void;
  onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenDataModal?: () => void;
  isBottomLayout?: boolean;
  selectedPrefecture?: string;
  onSelectPrefecture?: (pref: string) => void;
  categories: CustomCategory[];
  onOpenCategoryManager: () => void;
  routesInfo?: Record<string, SpotRouteInfo>;
  userLocation?: UserLocation | null;
  isLocationEnabled?: boolean;
  onCloseSidebar?: () => void;
  customLists?: CustomList[];
  onOpenCreateList?: () => void;
  onEditCustomList?: (customList: CustomList) => void;
  onMoveCustomList?: (listId: string, direction: 'up' | 'down') => void;
  onOpenListSettings?: () => void;
  onOpenListManager?: (spotId: string) => void;
  onDeleteCustomList?: (listId: string) => void;
  onReorderCustomLists?: (newLists: CustomList[]) => void;
  onEditSpot?: (spot: Spot) => void;
  onDeleteSpot?: (id: string) => void;
  onOpenCloudSync?: () => void;
  isCloudSyncActive?: boolean;
  isSyncing?: boolean;
  autoSyncEnabled?: boolean;
  autoSaveStatus?: 'idle' | 'saving' | 'saved';
  onFilteredSpotsChange?: (filteredSpots: Spot[]) => void;
}

export const SpotListSidebar: React.FC<SpotListSidebarProps> = ({
  spots,
  selectedSpotId,
  selectedSpotIds,
  activeTab,
  onTabChange,
  onToggleWantToGo,
  onToggleHaunted,
  onSelectSpot,
  onOpenDetailModal,
  onToggleSelectSpot,
  onClearSelection,
  onAddNewSpot,
  onResetSamples,
  onExportData,
  onImportData,
  onOpenDataModal,
  isBottomLayout = false,
  selectedPrefecture,
  onSelectPrefecture,
  categories = INITIAL_CATEGORIES,
  onOpenCategoryManager,
  routesInfo = {},
  userLocation,
  isLocationEnabled = true,
  onCloseSidebar,
  customLists = [],
  onOpenCreateList,
  onEditCustomList,
  onMoveCustomList,
  onOpenListSettings,
  onOpenListManager,
  onDeleteCustomList,
  onReorderCustomLists,
  onEditSpot,
  onDeleteSpot,
  onOpenCloudSync,
  isCloudSyncActive,
  isSyncing = false,
  autoSyncEnabled = true,
  autoSaveStatus = 'idle',
  onFilteredSpotsChange,
}) => {
  const [draggedTabIndex, setDraggedTabIndex] = useState<number | null>(null);
  const [dragOverTabIndex, setDragOverTabIndex] = useState<number | null>(null);

  // View mode: 'all' (全表示), 'want_to_go' (行きたい場所), 'haunted' (心リスト), 'prefecture' (県別リスト)
  const [internalViewMode, setInternalViewMode] = useState<SpotListTab>('all');
  const viewMode = activeTab !== undefined ? activeTab : internalViewMode;
  const setViewMode = (mode: SpotListTab) => {
    if (onTabChange) {
      onTabChange(mode);
    } else {
      setInternalViewMode(mode);
    }
  };

  // Tab scroll & All lists dropdown state
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const allListsBtnRef = useRef<HTMLButtonElement>(null);
  const allListsDropdownRef = useRef<HTMLDivElement>(null);
  const [isAllListsDropdownOpen, setIsAllListsDropdownOpen] = useState(false);
  const [allListsDropdownPos, setAllListsDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const [allListsSearch, setAllListsSearch] = useState('');
  const [listToDelete, setListToDelete] = useState<CustomList | null>(null);
  const [spotToDelete, setSpotToDelete] = useState<Spot | null>(null);

  // Active custom list currently viewed
  const activeCustomList = customLists.find((cl) => cl.id === viewMode);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsContainerRef.current) {
      const amount = direction === 'left' ? -200 : 200;
      tabsContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  const handleToggleAllListsDropdown = () => {
    setViewMode('all');
    if (!isAllListsDropdownOpen) {
      const rect = allListsBtnRef.current?.getBoundingClientRect();
      if (rect) {
        const top = rect.bottom + 6;
        const left = Math.min(Math.max(8, rect.left), window.innerWidth - 300);
        setAllListsDropdownPos({ top, left });
      }
      setIsAllListsDropdownOpen(true);
    } else {
      setIsAllListsDropdownOpen(false);
    }
  };

  useEffect(() => {
    if (tabsContainerRef.current) {
      const activeEl = tabsContainerRef.current.querySelector<HTMLElement>(`[data-tab-id="${viewMode}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
      }
    }
  }, [viewMode]);

  useEffect(() => {
    if (!isAllListsDropdownOpen) return;
    const updatePos = () => {
      const rect = allListsBtnRef.current?.getBoundingClientRect();
      if (rect) {
        setAllListsDropdownPos({
          top: rect.bottom + 6,
          left: Math.min(Math.max(12, rect.left), window.innerWidth - 270),
        });
      }
    };
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [isAllListsDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        allListsDropdownRef.current &&
        !allListsDropdownRef.current.contains(e.target as Node) &&
        allListsBtnRef.current &&
        !allListsBtnRef.current.contains(e.target as Node)
      ) {
        setIsAllListsDropdownOpen(false);
      }
    };
    if (isAllListsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isAllListsDropdownOpen]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [internalPrefecture, setInternalPrefecture] = useState<string>('all');
  const activePrefecture = selectedPrefecture !== undefined ? selectedPrefecture : internalPrefecture;

  const setPrefecture = (pref: string) => {
    if (onSelectPrefecture) {
      onSelectPrefecture(pref);
    } else {
      setInternalPrefecture(pref);
    }
  };

  const [sortBy, setSortBy] = useState<'newest' | 'rating' | 'name' | 'distance' | 'visited' | 'unvisited'>('newest');

  // Collapsed state for prefecture groups
  const [collapsedPrefectures, setCollapsedPrefectures] = useState<Record<string, boolean>>({});

  const togglePrefectureCollapse = (pref: string) => {
    setCollapsedPrefectures((prev) => ({
      ...prev,
      [pref]: !prev[pref],
    }));
  };

  // Prefectures that actually have registered spots
  const prefecturesWithCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    spots.forEach((spot) => {
      const pref = spot.prefecture || '都道府県未設定';
      counts[pref] = (counts[pref] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [spots]);

  // Real-time spot count per category (for category filter badges)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: spots.length };
    categories.forEach((cat) => {
      counts[cat.id] = 0;
    });
    spots.forEach((spot) => {
      const spotCats = spot.categories && spot.categories.length > 0 ? spot.categories : [spot.category];
      const counted = new Set<string>();
      spotCats.forEach((rawCat) => {
        if (!rawCat) return;
        if (counts[rawCat] !== undefined && !counted.has(rawCat)) {
          counts[rawCat] = (counts[rawCat] || 0) + 1;
          counted.add(rawCat);
        } else {
          const meta = getCategoryMeta(rawCat, categories);
          if (counts[meta.id] !== undefined && !counted.has(meta.id)) {
            counts[meta.id] = (counts[meta.id] || 0) + 1;
            counted.add(meta.id);
          }
        }
      });
    });
    return counts;
  }, [spots, categories]);

  // Real-time count for "Want to go" (行きたい場所) & "Haunted" (心リスト)
  const wantToGoCount = useMemo(() => {
    return spots.filter((s) => Boolean(s.isWantToGo || s.listIds?.includes('want_to_go'))).length;
  }, [spots]);

  const hauntedCount = useMemo(() => {
    return spots.filter((s) => Boolean(s.isHaunted ?? (s.category === 'haunted' || s.listIds?.includes('haunted')))).length;
  }, [spots]);

  // Real-time count for each custom list
  const customListCounts = useMemo(() => {
    const map: Record<string, number> = {};
    customLists.forEach((cl) => {
      if (cl.id === 'want_to_go') {
        map[cl.id] = spots.filter((s) => Boolean(s.isWantToGo || s.listIds?.includes('want_to_go'))).length;
      } else if (cl.id === 'haunted') {
        map[cl.id] = spots.filter((s) => Boolean(s.isHaunted ?? (s.category === 'haunted' || s.listIds?.includes('haunted')))).length;
      } else {
        map[cl.id] = spots.filter((s) => Boolean(s.listIds?.includes(cl.id))).length;
      }
    });
    return map;
  }, [spots, customLists]);

  // Filtered spots with multi-keyword search (AND logic) & category & prefecture & tab filters
  const filteredSpots = useMemo(() => {
    const searchTokens = searchTerm
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    const result = spots
      .filter((spot) => {
        // Tab filter: 'want_to_go' (行きたい場所) vs 'haunted' (心リスト) vs custom list
        if (viewMode === 'want_to_go') {
          if (!spot.isWantToGo && !spot.listIds?.includes('want_to_go')) {
            return false;
          }
        } else if (viewMode === 'haunted') {
          const isH = spot.isHaunted ?? (spot.category === 'haunted' || spot.listIds?.includes('haunted'));
          if (!isH) return false;
        } else if (viewMode !== 'all' && viewMode !== 'prefecture') {
          if (!spot.listIds?.includes(viewMode)) {
            return false;
          }
        }

        // Multi-keyword Search query (AND condition across all tokens)
        if (searchTokens.length > 0) {
          const title = spot.title.toLowerCase();
          const address = (spot.address || '').toLowerCase();
          const pref = (spot.prefecture || '').toLowerCase();
          const city = (spot.city || '').toLowerCase();
          const desc = (spot.description || '').toLowerCase();
          const notes = (spot.notes || '').toLowerCase();
          const refText = (spot.referenceUrls || [])
            .map((r) => `${r.title} ${r.url}`)
            .join(' ')
            .toLowerCase();
          const spotCats = spot.categories && spot.categories.length > 0 ? spot.categories : [spot.category];
          const catNames = spotCats
            .map((catId) => categories.find((c) => c.id === catId)?.name || '')
            .join(' ')
            .toLowerCase();

          const fullSearchText = `${title} ${address} ${city} ${pref} ${desc} ${notes} ${refText} ${catNames}`;
          const isMatch = searchTokens.every((token) => fullSearchText.includes(token));
          if (!isMatch) return false;
        }

        // Category filter (supports multi-category and meta resolution)
        if (selectedCategory !== 'all') {
          const spotCats = spot.categories && spot.categories.length > 0 ? spot.categories : [spot.category];
          const hasMatch = spotCats.some((cId) => {
            if (cId === selectedCategory) return true;
            const meta = getCategoryMeta(cId, categories);
            return meta.id === selectedCategory || meta.label === selectedCategory;
          });
          if (!hasMatch) {
            return false;
          }
        }

        // Prefecture filter
        if (activePrefecture !== 'all' && spot.prefecture !== activePrefecture) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'distance') {
          const distA = routesInfo[a.id]?.distanceKm ?? 999999;
          const distB = routesInfo[b.id]?.distanceKm ?? 999999;
          return distA - distB;
        }
        if (sortBy === 'rating') {
          const rA = a.dangerLevel ?? a.rating ?? 0;
          const rB = b.dangerLevel ?? b.rating ?? 0;
          return rB - rA;
        }
        if (sortBy === 'name') {
          return a.title.localeCompare(b.title, 'ja');
        }
        if (sortBy === 'visited') {
          if (a.isVisited && !b.isVisited) return -1;
          if (!a.isVisited && b.isVisited) return 1;
          return b.createdAt - a.createdAt;
        }
        if (sortBy === 'unvisited') {
          if (!a.isVisited && b.isVisited) return -1;
          if (a.isVisited && !b.isVisited) return 1;
          return b.createdAt - a.createdAt;
        }
        return b.createdAt - a.createdAt;
      });

    // Strictly deduplicate by spot.id
    const seen = new Set<string>();
    return result.filter((spot) => {
      if (!spot || !spot.id || seen.has(spot.id)) return false;
      seen.add(spot.id);
      return true;
    });
  }, [spots, searchTerm, selectedCategory, activePrefecture, sortBy, routesInfo, categories, viewMode]);

  // Notify parent of the current filtered spots so map can show pins only for the matching list items
  const lastFilteredIdsRef = useRef<string>('');
  useEffect(() => {
    const currentIds = filteredSpots.map((s) => s.id).join(',');
    if (lastFilteredIdsRef.current !== currentIds) {
      lastFilteredIdsRef.current = currentIds;
      onFilteredSpotsChange?.(filteredSpots);
    }
  }, [filteredSpots, onFilteredSpotsChange]);

  // Grouped by Prefecture
  const spotsGroupedByPrefecture = useMemo(() => {
    const groups: Record<string, Spot[]> = {};
    const seenPerPref = new Set<string>();
    filteredSpots.forEach((spot) => {
      const pref = spot.prefecture || '都道府県未設定';
      const key = `${pref}_${spot.id}`;
      if (seenPerPref.has(key)) return;
      seenPerPref.add(key);

      if (!groups[pref]) {
        groups[pref] = [];
      }
      groups[pref].push(spot);
    });

    return Object.entries(groups).sort((a, b) => {
      if (b[1].length !== a[1].length) return b[1].length - a[1].length;
      return a[0].localeCompare(b[0], 'ja');
    });
  }, [filteredSpots]);

  return (
    <div className={`h-full flex flex-col bg-white ${isBottomLayout ? 'border-t' : 'border-r'} border-slate-200 select-none`}>
      {/* Header & Controls Area */}
      <div className="p-2.5 sm:p-3.5 border-b border-slate-200 bg-white flex flex-col gap-1.5 sm:gap-2.5">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 truncate">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-600 ring-3 ring-violet-100 flex-shrink-0"></span>
              <span className="truncate">登録スポット一覧</span>
              <span className="text-xs text-slate-500 font-normal flex-shrink-0">
                ({filteredSpots.length} / 全{spots.length}件)
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* List Manager trigger button in header */}
            {onOpenListSettings && (
              <button
                type="button"
                id="sidebar-list-settings-btn"
                onClick={onOpenListSettings}
                title="リストの作成・並び替え・名前変更"
                className="px-2.5 py-1 text-slate-600 hover:text-violet-700 hover:bg-violet-50 rounded-xl border border-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
              >
                <ListOrdered className="w-3.5 h-3.5 text-violet-600" />
                <span className="hidden sm:inline">リスト編集</span>
              </button>
            )}

            {/* Category Manager trigger button in header */}
            {onOpenCategoryManager && (
              <button
                type="button"
                id="sidebar-category-manager-btn"
                onClick={onOpenCategoryManager}
                title="カテゴリの編集・追加"
                className="px-2.5 py-1 text-slate-600 hover:text-violet-700 hover:bg-violet-50 rounded-xl border border-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
              >
                <Settings2 className="w-3.5 h-3.5 text-violet-600" />
                <span className="hidden sm:inline">カテゴリ編集</span>
              </button>
            )}

            {/* Add Spot Button */}
            <button
              id="sidebar-add-spot-btn"
              onClick={onAddNewSpot}
              className="px-2.5 py-1 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">新規追加</span>
              <span className="sm:hidden">追加</span>
            </button>

            {/* Return to Map Button (Mobile / Close Sidebar) */}
            {onCloseSidebar && (
              <button
                onClick={onCloseSidebar}
                className="px-2.5 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold rounded-xl border border-violet-200 flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                title="地図画面に戻る（地図を全画面表示）"
              >
                <MapIcon className="w-3.5 h-3.5 text-violet-600" />
                <span>地図へ</span>
              </button>
            )}
          </div>
        </div>

        {/* List Tabs Area with Smooth Scroll Arrows */}
        <div className="flex items-center px-1 text-xs mb-1">
          <span className="font-bold text-slate-500 text-[11px] flex items-center gap-1">
            <Bookmark className="w-3 h-3 text-violet-600" />
            <span>リスト一覧</span>
          </span>
        </div>

        <div className="relative">
          <div className="flex items-center gap-1.5">
            {/* Scroll Left Button */}
            <button
              type="button"
              onClick={() => scrollTabs('left')}
              className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors flex-shrink-0 cursor-pointer shadow-2xs"
              title="タブを左へスクロール"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Scrollable Tabs Bar */}
            <div
              ref={tabsContainerRef}
              className="bg-slate-100/90 p-1 rounded-xl flex items-center gap-1 text-xs font-medium border border-slate-200/80 overflow-x-auto no-scrollbar scroll-smooth flex-1 min-w-0"
            >
              {/* 全リスト (全表示) - クリックで全スポット表示＆登録リスト一覧をドロップアウト */}
              <button
                ref={allListsBtnRef}
                id="view-all-spots-tab"
                data-tab-id="all"
                type="button"
                onClick={handleToggleAllListsDropdown}
                className={`flex-shrink-0 min-w-[84px] py-1.5 px-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap text-center ${
                  viewMode === 'all'
                    ? 'bg-white text-slate-900 font-bold shadow-xs ring-1 ring-violet-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
                title="全リスト表示（クリックで登録リスト一覧を展開）"
              >
                <ListFilter className="w-3.5 h-3.5 text-violet-600 flex-shrink-0" />
                <span>全リスト</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-bold ml-0.5">
                  {spots.length}
                </span>
                <ChevronDown
                  className={`w-3 h-3 text-slate-400 transition-transform ${
                    isAllListsDropdownOpen ? 'rotate-180 text-violet-600' : ''
                  }`}
                />
              </button>

              {/* カスタムリストの各タブ（行きたい場所・心霊スポット・ユーザー作成リストすべてドラッグ＆ドロップで並び替え可能） */}
              {customLists.map((customList, index) => {
                const isTabActive = viewMode === customList.id;
                const count = customListCounts[customList.id] || 0;
                const isDragging = draggedTabIndex === index;
                const isDragOver = dragOverTabIndex === index;

                return (
                  <div
                    key={`${customList.id}_${index}`}
                    id={`view-custom-list-tab-${customList.id}`}
                    data-tab-id={customList.id}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(index));
                      setDraggedTabIndex(index);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverTabIndex !== index) {
                        setDragOverTabIndex(index);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverTabIndex === index) {
                        setDragOverTabIndex(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedTabIndex !== null && draggedTabIndex !== index) {
                        const reordered = [...customLists];
                        const [moved] = reordered.splice(draggedTabIndex, 1);
                        reordered.splice(index, 0, moved);
                        if (onReorderCustomLists) {
                          onReorderCustomLists(reordered);
                        }
                      }
                      setDraggedTabIndex(null);
                      setDragOverTabIndex(null);
                    }}
                    onDragEnd={() => {
                      setDraggedTabIndex(null);
                      setDragOverTabIndex(null);
                    }}
                    className={`flex-shrink-0 flex items-center rounded-lg transition-all select-none border group ${
                      isTabActive
                        ? 'bg-white text-slate-900 font-bold shadow-xs ring-1 ring-slate-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 border-transparent'
                    } ${isDragging ? 'opacity-30 scale-95' : ''} ${
                      isDragOver ? 'ring-2 ring-violet-500 scale-105 bg-violet-50/70' : ''
                    }`}
                    style={{
                      borderColor: isTabActive ? customList.color : undefined,
                      boxShadow: isTabActive ? `0 1px 3px ${customList.color}25` : undefined,
                    }}
                    title={`ドラッグしてタブの並び順を変更 (${customList.name})`}
                  >
                    <button
                      type="button"
                      onClick={() => setViewMode(customList.id)}
                      className="py-1.5 pl-2.5 pr-1.5 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer text-xs"
                    >
                      <span className="text-sm flex-shrink-0">{customList.icon || '⭐'}</span>
                      <span>{customList.name}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5"
                        style={{
                          backgroundColor: isTabActive ? `${customList.color}25` : '#e2e8f0',
                          color: isTabActive ? customList.color : '#334155',
                        }}
                      >
                        {count}
                      </span>
                    </button>

                    {/* タブ上から直接削除できるゴミ箱ボタン */}
                    {onDeleteCustomList && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setListToDelete(customList);
                        }}
                        className={`p-1 mr-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-all cursor-pointer flex items-center justify-center ${
                          isTabActive ? 'opacity-90 hover:opacity-100' : 'opacity-40 group-hover:opacity-100'
                        }`}
                        title={`「${customList.name}」を削除`}
                        aria-label={`「${customList.name}」を削除`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}

              {/* 県別リスト */}
              <button
                id="view-by-prefecture-tab"
                data-tab-id="prefecture"
                type="button"
                onClick={() => setViewMode('prefecture')}
                className={`flex-shrink-0 min-w-[70px] py-1.5 px-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap text-center ${
                  viewMode === 'prefecture'
                    ? 'bg-white text-slate-900 font-bold shadow-xs ring-1 ring-violet-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-violet-600 flex-shrink-0" />
                <span>県別</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-bold ml-0.5">
                  {prefecturesWithCounts.length}
                </span>
              </button>

            </div>

            {/* Scroll Right Button */}
            <button
              type="button"
              onClick={() => scrollTabs('right')}
              className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors flex-shrink-0 cursor-pointer shadow-2xs"
              title="タブを右へスクロール"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 全リストを押したときにドロップアウト表示される登録リスト一覧 */}
          {isAllListsDropdownOpen && (
            <div
              ref={allListsDropdownRef}
              style={{
                top: allListsDropdownPos?.top ?? 120,
                left: allListsDropdownPos?.left ?? 16,
              }}
              className="fixed w-72 max-w-[calc(100vw-32px)] bg-white rounded-2xl shadow-2xl border border-slate-200 z-[999] p-2 flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-150"
            >
              {/* Dropdown Header */}
              <div className="px-2 py-1 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5 text-violet-600" />
                  <span className="text-xs font-bold text-slate-800">登録リスト一覧</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-violet-50 text-violet-700 font-bold border border-violet-100">
                    {customLists.length + 2}件
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAllListsDropdownOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="閉じる"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Search filter in dropdown if many lists */}
              {customLists.length >= 4 && (
                <div className="px-1 py-0.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={allListsSearch}
                      onChange={(e) => setAllListsSearch(e.target.value)}
                      placeholder="リスト名を検索..."
                      className="w-full text-xs pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-violet-500 focus:bg-white transition-colors"
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {/* List of registered lists */}
              <div className="max-h-64 overflow-y-auto space-y-0.5 py-0.5">
                {/* 1. 全リスト */}
                {(!allListsSearch.trim() || '全リスト すべて'.includes(allListsSearch.trim())) && (
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('all');
                      setIsAllListsDropdownOpen(false);
                      setAllListsSearch('');
                    }}
                    className={`w-full px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer text-left ${
                      viewMode === 'all'
                        ? 'bg-violet-50 text-violet-900 font-bold ring-1 ring-violet-200'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0 text-violet-700">
                        <ListFilter className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold">全リスト</span>
                        <span className="text-[10px] text-slate-400 font-normal">すべての登録スポット</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-bold">
                        {spots.length}
                      </span>
                      {viewMode === 'all' && <Check className="w-3.5 h-3.5 text-violet-600" />}
                    </div>
                  </button>
                )}

                {/* 2. 各カスタムリスト */}
                {customLists
                  .filter(
                    (cl) =>
                      !allListsSearch.trim() ||
                      cl.name.toLowerCase().includes(allListsSearch.toLowerCase())
                  )
                  .map((cl, clIdx) => {
                    const isSelected = viewMode === cl.id;
                    const count = customListCounts[cl.id] || 0;
                    return (
                      <div
                        key={`${cl.id}_${clIdx}`}
                        className={`w-full rounded-xl text-xs flex items-center justify-between transition-colors group ${
                          isSelected
                            ? 'bg-violet-50/90 font-bold text-slate-900 ring-1 ring-violet-200'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setViewMode(cl.id);
                            setIsAllListsDropdownOpen(false);
                            setAllListsSearch('');
                          }}
                          className="flex-1 px-2.5 py-2 flex items-center justify-between cursor-pointer min-w-0 text-left"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-xs shadow-2xs"
                              style={{
                                backgroundColor: `${cl.color}20`,
                                border: `1px solid ${cl.color}40`,
                              }}
                            >
                              <span>{cl.icon || '⭐'}</span>
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="truncate">{cl.name}</span>
                              {cl.description && (
                                <span className="text-[10px] text-slate-400 font-normal truncate">
                                  {cl.description}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-1.5">
                            <span
                              className="text-[10px] px-1.5 py-0.2 rounded-full font-bold"
                              style={{
                                backgroundColor: isSelected ? `${cl.color}30` : '#f1f5f9',
                                color: isSelected ? cl.color : '#475569',
                              }}
                            >
                              {count}
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-violet-600" />}
                          </div>
                        </button>

                        {onDeleteCustomList && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsAllListsDropdownOpen(false);
                              setListToDelete(cl);
                            }}
                            className="p-1 mr-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer flex-shrink-0 opacity-0 group-hover:opacity-100"
                            title={`「${cl.name}」を削除`}
                            aria-label={`「${cl.name}」を削除`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                {/* 3. 県別リスト */}
                {(!allListsSearch.trim() || '県別リスト 都道府県'.includes(allListsSearch.trim())) && (
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('prefecture');
                      setIsAllListsDropdownOpen(false);
                      setAllListsSearch('');
                    }}
                    className={`w-full px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer text-left ${
                      viewMode === 'prefecture'
                        ? 'bg-violet-50 text-violet-900 font-bold ring-1 ring-violet-200'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-700">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold">県別リスト</span>
                        <span className="text-[10px] text-slate-400 font-normal">都道府県別のスポット</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-bold">
                        {prefecturesWithCounts.length}
                      </span>
                      {viewMode === 'prefecture' && <Check className="w-3.5 h-3.5 text-violet-600" />}
                    </div>
                  </button>
                )}
              </div>

              {/* Actions in Dropdown Footer */}
              {(onOpenCreateList || onOpenListSettings) && (
                <div className="border-t border-slate-100 pt-1.5 px-1 flex items-center justify-between gap-1 text-[11px]">
                  {onOpenCreateList && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAllListsDropdownOpen(false);
                        onOpenCreateList();
                      }}
                      className="text-violet-700 hover:text-violet-900 font-semibold p-1 hover:bg-violet-50 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>新規リスト追加</span>
                    </button>
                  )}
                  {onOpenListSettings && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAllListsDropdownOpen(false);
                        onOpenListSettings();
                      }}
                      className="text-slate-600 hover:text-violet-700 font-semibold p-1 hover:bg-slate-100 rounded-lg flex items-center gap-1 cursor-pointer transition-colors ml-auto"
                      title="リストの並び替え・名前変更"
                    >
                      <ListOrdered className="w-3.5 h-3.5 text-slate-500" />
                      <span>リスト並び替え</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 選択中のカスタムリスト情報＆クイック編集・並び替えバー */}
        {(() => {
          if (!activeCustomList) return null;
          const activeIndex = customLists.findIndex((cl) => cl.id === viewMode);
          const count = customListCounts[activeCustomList.id] || 0;

          return (
            <div
              className="px-3 py-2 rounded-xl border flex items-center justify-between gap-2 transition-all shadow-2xs"
              style={{
                backgroundColor: `${activeCustomList.color}10`,
                borderColor: `${activeCustomList.color}40`,
              }}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-base flex-shrink-0">{activeCustomList.icon || '⭐'}</span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 truncate">
                    <span className="truncate">{activeCustomList.name}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.2 rounded-full font-bold flex-shrink-0"
                      style={{
                        backgroundColor: `${activeCustomList.color}25`,
                        color: activeCustomList.color,
                      }}
                    >
                      {count}件
                    </span>
                  </div>
                  {activeCustomList.description && (
                    <div className="text-[10px] text-slate-500 truncate">
                      {activeCustomList.description}
                    </div>
                  )}
                </div>
              </div>

              {/* クイック操作ボタン群 */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* 並び替え: 前へ・次へ */}
                {onMoveCustomList && (
                  <div className="flex items-center bg-white/80 rounded-lg p-0.5 border border-slate-200">
                    <button
                      type="button"
                      disabled={activeIndex === 0}
                      onClick={() => onMoveCustomList(activeCustomList.id, 'up')}
                      className={`p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors ${
                        activeIndex === 0 ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                      title="このリストの並び順を前（左）へ移動"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={activeIndex === customLists.length - 1}
                      onClick={() => onMoveCustomList(activeCustomList.id, 'down')}
                      className={`p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors ${
                        activeIndex === customLists.length - 1
                          ? 'opacity-25 cursor-not-allowed'
                          : 'cursor-pointer'
                      }`}
                      title="このリストの並び順を次（右）へ移動"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* リスト名・アイコン編集 */}
                {onEditCustomList && (
                  <button
                    type="button"
                    onClick={() => onEditCustomList(activeCustomList)}
                    className="p-1.5 rounded-lg bg-white/80 hover:bg-white text-slate-700 hover:text-violet-700 border border-slate-200 transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                    title="リスト名やアイコン、カラーを編集"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-violet-600" />
                    <span>名前編集</span>
                  </button>
                )}

                {/* 削除 */}
                {onDeleteCustomList && (
                  <button
                    type="button"
                    onClick={() => setListToDelete(activeCustomList)}
                    className="p-1.5 rounded-lg bg-white/80 hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 transition-colors cursor-pointer"
                    title="このリストを削除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {/* 全リストに戻る */}
                <button
                  type="button"
                  onClick={() => setViewMode('all')}
                  className="p-1.5 rounded-lg bg-white/80 hover:bg-white text-slate-600 hover:text-violet-700 border border-slate-200 transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                  title="すべてのスポット一覧に戻る"
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">全リストへ</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* 県別表示中のバナー */}
        {viewMode === 'prefecture' && (
          <div className="px-3 py-2 rounded-xl border border-violet-200 bg-violet-50/50 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-violet-900 font-bold">
              <Building2 className="w-4 h-4 text-violet-600" />
              <span>県別リスト（都道府県別グループ表示中）</span>
            </div>
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className="p-1 px-2 rounded-lg bg-white hover:bg-violet-100 text-violet-700 border border-violet-200 transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>全リストに戻る</span>
            </button>
          </div>
        )}

        {/* Search Box with Real-time Match Counter */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="spot-search-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="キーワード検索（名前・住所・メモ・カテゴリ）..."
            className="w-full text-xs pl-9 pr-16 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:bg-white transition-all placeholder:text-slate-400"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {searchTerm.trim() && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 whitespace-nowrap">
                {filteredSpots.length}件
              </span>
            )}
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                title="検索ワードをクリア"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Compact Filters Row: Category Dropdown & Prefecture Dropdown & Sort */}
        <div className="grid grid-cols-3 gap-1">
          {/* Category Filter Dropdown */}
          <div className="relative col-span-1">
            <select
              id="category-filter-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={`w-full text-[11px] border rounded-lg px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-violet-500/20 cursor-pointer font-bold transition-all shadow-2xs truncate ${
                selectedCategory !== 'all'
                  ? 'bg-violet-600 text-white border-violet-700 shadow-violet-500/20'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
              }`}
              title="カテゴリをドロップダウンリストから選択"
            >
              <option value="all" className="bg-white text-slate-900 font-bold">
                🏷️ カテゴリ ({spots.length})
              </option>
              {categories.map((cat) => {
                const count = categoryCounts[cat.id] || 0;
                return (
                  <option key={cat.id} value={cat.id} className="bg-white text-slate-900 font-medium">
                    {cat.icon} {cat.name} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Prefecture Filter Dropdown */}
          <div className="relative col-span-1">
            <select
              id="prefecture-filter-select"
              value={activePrefecture}
              onChange={(e) => setPrefecture(e.target.value)}
              className={`w-full text-[11px] border rounded-lg px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-violet-500/20 cursor-pointer font-medium transition-all shadow-2xs truncate ${
                activePrefecture !== 'all'
                  ? 'bg-blue-600 text-white border-blue-700 font-bold'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
              }`}
              title="都道府県をドロップダウンリストから選択"
            >
              <option value="all" className="bg-white text-slate-900 font-bold">
                🗾 全国 (47都道府県)
              </option>
              {JAPAN_PREFECTURES.map((pref) => {
                const count = spots.filter((s) => s.prefecture === pref).length;
                return (
                  <option key={pref} value={pref} className="bg-white text-slate-900 font-medium">
                    {pref} {count > 0 ? `(${count})` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="relative col-span-1">
            <select
              id="sort-by-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full text-[11px] bg-white hover:bg-slate-50 border border-slate-300 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-violet-500/20 cursor-pointer text-slate-800 font-medium shadow-2xs truncate"
              title="並び順を選択"
            >
              <option value="newest">🕒 新しい順</option>
              {userLocation && <option value="distance">🚗 近い順</option>}
              <option value="rating">★ 危険度順</option>
              <option value="name">🔤 名前順</option>
              <option value="visited">✅ 訪問済優先</option>
              <option value="unvisited">⭕ 未訪優先</option>
            </select>
          </div>
        </div>

        {/* Active Filters Ribbon (タグ一覧 & 一括クリア) */}
        {(searchTerm.trim() || selectedCategory !== 'all' || activePrefecture !== 'all') && (
          <div className="bg-violet-50/70 p-2 rounded-xl border border-violet-200/80 text-xs flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-violet-700">絞込中:</span>

              {searchTerm.trim() && (
                <span className="inline-flex items-center gap-1 bg-white text-violet-800 px-2 py-0.5 rounded-lg text-[11px] font-bold border border-violet-200 shadow-2xs">
                  <span>🔍 "{searchTerm}"</span>
                  <button
                    onClick={() => setSearchTerm('')}
                    className="text-slate-400 hover:text-red-500 cursor-pointer"
                    title="キーワード絞り込みを解除"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedCategory !== 'all' && (() => {
                const cDisplay = getCategoryDisplay(selectedCategory, categories);
                const displayLabel =
                  cDisplay.label && cDisplay.label !== 'カスタム'
                    ? cDisplay.label
                    : categories.find((c) => c.id === selectedCategory)?.name || '';
                if (!displayLabel) return null;
                return (
                  <span className="inline-flex items-center gap-1 bg-white text-violet-800 px-2 py-0.5 rounded-lg text-[11px] font-bold border border-violet-200 shadow-2xs">
                    <span>
                      {cDisplay.icon}{' '}
                      {displayLabel}
                    </span>
                    <button
                      onClick={() => setSelectedCategory('all')}
                      className="text-slate-400 hover:text-red-500 cursor-pointer"
                      title="カテゴリ絞り込みを解除"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })()}

              {activePrefecture !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-white text-violet-800 px-2 py-0.5 rounded-lg text-[11px] font-bold border border-violet-200 shadow-2xs">
                  <span>🗾 {activePrefecture}</span>
                  <button
                    onClick={() => setPrefecture('all')}
                    className="text-slate-400 hover:text-red-500 cursor-pointer"
                    title="都道府県絞り込みを解除"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>

            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
                setPrefecture('all');
              }}
              className="text-[11px] text-violet-700 hover:text-violet-900 font-bold hover:underline cursor-pointer ml-auto"
            >
              すべてクリア
            </button>
          </div>
        )}

        {/* Multi-route selection counter if active */}
        {selectedSpotIds.length > 0 && (
          <div className="bg-gradient-to-r from-violet-100 to-blue-50 text-violet-900 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between border border-violet-200 shadow-2xs">
            <span className="flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-violet-600" />
              <span>下道ルート比較中: {selectedSpotIds.length}件選択中</span>
            </span>
            {onClearSelection ? (
              <button
                type="button"
                onClick={onClearSelection}
                className="text-[11px] text-violet-700 hover:text-violet-900 hover:underline font-bold cursor-pointer ml-2 px-1.5 py-0.5 rounded bg-white/70 shadow-2xs"
              >
                選択解除
              </button>
            ) : (
              <span className="text-[10px] text-violet-700 font-normal">
                地図上にルート線を表示中
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main List Container */}
      <div className="flex-1 overflow-y-auto">
        {filteredSpots.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-3">
            {(() => {
              const matchedList = customLists.find((cl) => cl.id === viewMode);
              if (matchedList) {
                return (
                  <>
                    <div
                      className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center text-2xl shadow-2xs"
                      style={{
                        backgroundColor: `${matchedList.color}20`,
                        color: matchedList.color,
                      }}
                    >
                      {matchedList.icon || '⭐'}
                    </div>
                    <div className="text-xs font-bold text-slate-700">
                      「{matchedList.name}」に登録されたスポットがありません
                    </div>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                      {matchedList.description || 'スポット詳細や一覧からこのリストに追加するとここに整理されます。'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setViewMode('all')}
                      className="mt-2 px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <ListFilter className="w-3.5 h-3.5" />
                      <span>すべてのスポットを表示</span>
                    </button>
                  </>
                );
              }

              return (
                <>
                  <MapPin className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
                  <div className="text-xs font-bold text-slate-600">該当するスポットが見つかりませんでした</div>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    検索ワードやカテゴリ、都道府県の絞り込み条件に一致するスポットがありません。
                  </p>
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedCategory('all');
                      setPrefecture('all');
                    }}
                    className="mt-2 px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>検索・絞り込み条件をすべてリセット</span>
                  </button>
                </>
              );
            })()}
          </div>
        ) : viewMode === 'prefecture' ? (
          /* ============================================================
             県別リスト表示 (PREFECTURE GROUPED VIEW)
             ============================================================ */
          <div className="p-3 space-y-3">
            {spotsGroupedByPrefecture.map(([prefName, prefSpots]) => {
              // Auto-expand accordions if actively searching or filtering by category
              const isSearching = !!searchTerm.trim() || selectedCategory !== 'all';
              const isCollapsed = !isSearching && !!collapsedPrefectures[prefName];
              const isPrefActive = activePrefecture === prefName;

              return (
                <div
                  key={prefName}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    isPrefActive
                      ? 'border-violet-400 bg-violet-50/20 shadow-xs'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {/* Prefecture Header Accordion */}
                  <div
                    onClick={() => togglePrefectureCollapse(prefName)}
                    className="p-3 bg-slate-50/80 hover:bg-slate-100/80 flex items-center justify-between cursor-pointer border-b border-slate-100"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🗾</span>
                      <h3 className="text-xs font-bold text-slate-900">
                        {prefName}
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                        {prefSpots.length}件
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPrefecture(activePrefecture === prefName ? 'all' : prefName);
                        }}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border cursor-pointer transition-colors ${
                          isPrefActive
                            ? 'bg-violet-600 text-white border-violet-700'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-violet-50 hover:text-violet-700'
                        }`}
                      >
                        {isPrefActive ? '地図絞込中' : '地図で見る'}
                      </button>
                      <span className="text-slate-400">
                        {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </span>
                    </div>
                  </div>

                  {/* Spot Cards inside this prefecture */}
                  {!isCollapsed && (
                    <div
                      className={
                        isBottomLayout
                          ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5 p-2.5'
                          : 'divide-y divide-slate-100'
                      }
                    >
                      {prefSpots.map((spot, sIdx) => (
                        <SpotCardItem
                          key={`${spot.id}_${sIdx}`}
                          spot={spot}
                          isSelected={spot.id === selectedSpotId}
                          isMultiSelected={selectedSpotIds.includes(spot.id)}
                          orderIndex={selectedSpotIds.indexOf(spot.id)}
                          onSelect={onSelectSpot}
                          onToggleMultiSelect={onToggleSelectSpot}
                          onClearSelection={onClearSelection}
                          onToggleWantToGo={onToggleWantToGo}
                          onToggleHaunted={onToggleHaunted}
                          isGrid={isBottomLayout}
                          categories={categories}
                          routeInfo={routesInfo[spot.id]}
                          userLocation={userLocation}
                          isLocationEnabled={isLocationEnabled}
                          customLists={customLists}
                          onOpenListManager={onOpenListManager}
                          onEditSpot={onEditSpot}
                          onDeleteSpot={onDeleteSpot ? (s: Spot) => setSpotToDelete(s) : undefined}
                          onOpenDetailModal={onOpenDetailModal}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ============================================================
             全表示 / 行きたい場所 / 心リスト (SPOT LIST VIEW)
             ============================================================ */
          <div
            className={
              isBottomLayout
                ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5 p-2.5'
                : 'divide-y divide-slate-100 bg-white'
            }
          >
            {filteredSpots.map((spot, sIdx) => (
              <SpotCardItem
                key={`${spot.id}_${sIdx}`}
                spot={spot}
                isSelected={spot.id === selectedSpotId}
                isMultiSelected={selectedSpotIds.includes(spot.id)}
                orderIndex={selectedSpotIds.indexOf(spot.id)}
                onSelect={onSelectSpot}
                onToggleMultiSelect={onToggleSelectSpot}
                onClearSelection={onClearSelection}
                onToggleWantToGo={onToggleWantToGo}
                onToggleHaunted={onToggleHaunted}
                isGrid={isBottomLayout}
                categories={categories}
                routeInfo={routesInfo[spot.id]}
                userLocation={userLocation}
                isLocationEnabled={isLocationEnabled}
                customLists={customLists}
                onOpenListManager={onOpenListManager}
                onEditSpot={onEditSpot}
                onDeleteSpot={onDeleteSpot ? (s: Spot) => setSpotToDelete(s) : undefined}
                onOpenDetailModal={onOpenDetailModal}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer: Backup & Restore / CSV */}
      <div className="p-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-[11px] text-slate-600 gap-1 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {onOpenDataModal && (
            <button
              type="button"
              onClick={onOpenDataModal}
              title="CSVエクスポート・インポート / バックアップ管理"
              className="px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-900 border border-violet-200 font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-violet-600" />
              <span>CSV・データ入出力</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenDataModal || onExportData}
            title="登録データをJSONバックアップ"
            className="px-2 py-1 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1 cursor-pointer border border-transparent hover:border-slate-200"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">JSON</span>
          </button>

          <label
            title="JSONから復元"
            className="px-2 py-1 rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1 cursor-pointer border border-transparent hover:border-slate-200"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">復元</span>
            <input
              type="file"
              accept=".json"
              onChange={onImportData}
              className="hidden"
            />
          </label>

          {onOpenCloudSync && (
            <button
              type="button"
              onClick={onOpenCloudSync}
              title={
                isSyncing || autoSaveStatus === 'saving'
                  ? 'Google Drive APIで自動保存中...'
                  : autoSaveStatus === 'saved'
                  ? 'Google Driveへ保存完了'
                  : isCloudSyncActive && autoSyncEnabled
                  ? 'Google Drive API自動保存: ON（クリックして同期設定）'
                  : isCloudSyncActive && !autoSyncEnabled
                  ? 'Google Drive API自動保存: 一時停止中（クリックして再開）'
                  : 'Google Drive自動保存（クリックして接続）'
              }
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer border text-[11px] font-bold ${
                isSyncing || autoSaveStatus === 'saving'
                  ? 'bg-blue-50 text-blue-700 border-blue-300 animate-pulse shadow-2xs'
                  : autoSaveStatus === 'saved'
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300 shadow-2xs'
                  : isCloudSyncActive && autoSyncEnabled
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : isCloudSyncActive && !autoSyncEnabled
                  ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200 hover:border-slate-300 shadow-2xs'
              }`}
            >
              {isSyncing || autoSaveStatus === 'saving' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  <span className="hidden sm:inline">Drive自動保存中...</span>
                  <span className="sm:hidden">保存中...</span>
                </>
              ) : autoSaveStatus === 'saved' ? (
                <>
                  <CloudCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Drive保存完了</span>
                  <span className="sm:hidden">保存完了</span>
                </>
              ) : isCloudSyncActive ? (
                <>
                  <Cloud className={`w-3.5 h-3.5 ${autoSyncEnabled ? 'text-emerald-600' : 'text-amber-600'}`} />
                  <span className="hidden sm:inline">Drive自動保存: {autoSyncEnabled ? 'ON' : '停止中'}</span>
                  <span className="sm:hidden">Drive: {autoSyncEnabled ? 'ON' : '停止'}</span>
                  {autoSyncEnabled && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>}
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden sm:inline">Drive自動保存: 未接続</span>
                  <span className="sm:hidden">Drive接続</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* リスト削除確認モーダル */}
      {listToDelete && (
        <ConfirmDeleteModal
          isOpen={!!listToDelete}
          title="リストの削除"
          itemName={listToDelete.name}
          description="※このリストに登録されていたスポット自体は削除されません。"
          confirmLabel="リストを削除"
          onConfirm={() => {
            if (onDeleteCustomList) {
              onDeleteCustomList(listToDelete.id);
            }
            setViewMode('all');
            setListToDelete(null);
          }}
          onCancel={() => setListToDelete(null)}
        />
      )}

      {/* スポット登録削除確認モーダル */}
      {spotToDelete && (
        <ConfirmDeleteModal
          isOpen={!!spotToDelete}
          title="スポットの削除"
          itemName={spotToDelete.title}
          description="※登録されているスポットデータが完全に削除されます。"
          confirmLabel="リストから削除"
          onConfirm={() => {
            if (onDeleteSpot) {
              onDeleteSpot(spotToDelete.id);
            }
            setSpotToDelete(null);
          }}
          onCancel={() => setSpotToDelete(null)}
        />
      )}
    </div>
  );
};

// Reusable Spot Card Component with Multi-Selection and Local Road Routing Info
interface SpotCardItemProps {
  spot: Spot;
  isSelected: boolean;
  isMultiSelected: boolean;
  orderIndex?: number;
  onSelect: (id: string) => void;
  onToggleMultiSelect: (id: string) => void;
  onClearSelection?: () => void;
  onToggleWantToGo?: (id: string) => void;
  onToggleHaunted?: (id: string) => void;
  isGrid?: boolean;
  categories: CustomCategory[];
  routeInfo?: SpotRouteInfo;
  userLocation?: UserLocation | null;
  isLocationEnabled?: boolean;
  customLists?: CustomList[];
  onOpenListManager?: (spotId: string) => void;
  onEditSpot?: (spot: Spot) => void;
  onDeleteSpot?: (spot: Spot) => void;
  onOpenDetailModal?: (id: string) => void;
}

const SpotCardItem: React.FC<SpotCardItemProps> = ({
  spot,
  isSelected,
  isMultiSelected,
  orderIndex,
  onSelect,
  onToggleMultiSelect,
  onClearSelection,
  onToggleWantToGo,
  onToggleHaunted,
  isGrid = false,
  categories,
  routeInfo,
  userLocation,
  isLocationEnabled = true,
  customLists = [],
  onOpenListManager,
  onEditSpot,
  onDeleteSpot,
  onOpenDetailModal,
}) => {
  const categoryInfo = getCategoryDisplay(spot.category, categories);
  const mainCat = getSpotMainCategory(spot, categories);
  const photos = spot.photos || [];
  const coverPhoto = photos.find((p) => p.isCover) || photos[0];
  const hasCoverPhoto = Boolean(coverPhoto && coverPhoto.url && coverPhoto.url.trim() !== '');
  const photoCount = photos.length;
  const refCount = spot.referenceUrls?.length || 0;
  const hasOrderBadge = isMultiSelected && orderIndex !== undefined && orderIndex >= 0;
  const isHauntedChecked = spot.isHaunted ?? (spot.category === 'haunted');
  const assignedCustomLists = customLists.filter((cl) => spot.listIds?.includes(cl.id));

  const handleCardClick = () => {
    onSelect(spot.id);
    if (onOpenDetailModal) {
      onOpenDetailModal(spot.id);
    }
  };

  if (isGrid) {
    // Bento / Card format for bottom layout
    return (
      <div
        id={`spot-card-${spot.id}`}
        onClick={handleCardClick}
        className={`rounded-xl border p-2 transition-all cursor-pointer flex flex-col justify-between ${
          isSelected
            ? 'bg-violet-50/80 border-violet-500 shadow-md ring-2 ring-violet-300'
            : isMultiSelected
            ? 'bg-violet-50/50 border-violet-300 ring-1 ring-violet-200'
            : 'bg-white hover:bg-slate-50/90 border-slate-200 hover:border-slate-300 shadow-2xs'
        }`}
      >
        <div className="flex gap-2 items-start">
          <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200">
            {hasCoverPhoto ? (
              <img
                src={coverPhoto.url}
                alt={spot.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center select-none"
                style={{
                  backgroundColor: mainCat.color ? `${mainCat.color}15` : '#f1f5f9',
                }}
                title={mainCat.label || categoryInfo.label}
              >
                <span className="text-xl drop-shadow-2xs leading-none">
                  {mainCat.icon || categoryInfo.icon || '👻'}
                </span>
              </div>
            )}
            {photoCount > 1 && (
              <span className="absolute bottom-0.5 right-0.5 bg-black/75 text-white text-[8px] font-bold px-1 rounded">
                📷{photoCount}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 flex-wrap">
              {Array.from(new Set(spot.categories && spot.categories.length > 0 ? spot.categories : [spot.category]))
                .map((catId) => getCategoryDisplay(catId, categories))
                .filter((cInfo) => cInfo && cInfo.label && cInfo.label !== 'カスタム' && cInfo.id !== 'custom')
                .slice(0, 3)
                .map((cInfo, cIdx) => {
                  return (
                    <span
                      key={`${cInfo.id || 'cat'}_${cIdx}`}
                      className="text-[8.5px] font-bold px-1.5 py-0.2 rounded text-white shadow-2xs flex items-center gap-0.5 leading-tight"
                      style={{ backgroundColor: cInfo.color }}
                    >
                      <span>{cInfo.icon}</span>
                      <span>{cInfo.label}</span>
                    </span>
                  );
                })}
              {spot.prefecture && (
                <span className="text-[9px] text-slate-500 font-semibold truncate">
                  {spot.prefecture}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-1 mt-0.5">
              <div className="min-w-0 flex-1">
                <h3 className="text-[11.5px] font-bold text-slate-900 truncate leading-snug">
                  {spot.title}
                </h3>
                {spot.yomigana && (
                  <span className="text-[9px] text-slate-400 font-medium truncate block leading-tight">
                    {spot.yomigana}
                  </span>
                )}
              </div>
              {onDeleteSpot && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSpot(spot);
                  }}
                  className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                  title="このスポットをリストから削除"
                >
                  <Trash2 className="w-3 h-3 text-rose-500" />
                </button>
              )}
            </div>

            {/* Local Road Info in Card */}
            {routeInfo && routeInfo.status === 'success' && (
              <div className="text-[9px] font-bold text-violet-700 mt-0.5 flex items-center gap-1">
                <Car className="w-2.5 h-2.5 text-violet-600" />
                <span>最短下道 {formatDistanceJapanese(routeInfo.distanceKm)} (約{formatDurationJapanese(routeInfo.durationMinutes)})</span>
              </div>
            )}
            {spot.rating !== undefined && spot.rating !== null && Number(spot.rating) > 0 ? (
              <div className="flex items-center gap-1 mt-0.5 text-[9px] text-amber-700 font-bold bg-amber-50 px-1 py-0.2 rounded border border-amber-200/60 w-fit">
                <Star className="w-2 h-2 fill-amber-400 text-amber-400" />
                <span>★ {Number(spot.rating).toFixed(1)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 mt-0.5 text-[9px] text-slate-400 font-medium bg-slate-50 px-1 py-0.2 rounded border border-slate-200/60 w-fit">
                <Star className="w-2 h-2 text-slate-300" />
                <span>未評価</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-slate-100 text-[9px] text-slate-400 flex-wrap gap-1">
          <div className="flex items-center gap-1 flex-wrap">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleMultiSelect(spot.id);
              }}
              className={`px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold cursor-pointer transition-colors ${
                isMultiSelected
                  ? 'text-emerald-800 bg-emerald-100/90 border border-emerald-300'
                  : 'text-slate-400 hover:text-emerald-700 hover:bg-slate-100'
              }`}
              title="ピン同士の下道ルート対象に追加/解除"
            >
              {hasOrderBadge ? (
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-700 text-white text-[8px] font-black flex items-center justify-center">
                  {(orderIndex ?? 0) + 1}
                </span>
              ) : isMultiSelected ? (
                <CheckSquare className="w-3 h-3 text-emerald-700" />
              ) : (
                <Square className="w-3 h-3" />
              )}
              <span>{isMultiSelected ? 'ルート中' : '+ ルート'}</span>
            </button>

            {onToggleWantToGo && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleWantToGo(spot.id);
                }}
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer ${
                  spot.isWantToGo
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-slate-100 text-slate-400 hover:text-amber-800 hover:bg-amber-50'
                }`}
                title={spot.isWantToGo ? '「行きたい場所」から解除' : '「行きたい場所」に追加'}
              >
                <Bookmark className={`w-2.5 h-2.5 ${spot.isWantToGo ? 'fill-amber-500 text-amber-500' : ''}`} />
                <span>{spot.isWantToGo ? '行きたい' : '+行きたい'}</span>
              </button>
            )}

            {onToggleHaunted && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleHaunted(spot.id);
                }}
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer ${
                  isHauntedChecked
                    ? 'bg-violet-100 text-violet-900 border border-violet-300'
                    : 'bg-slate-100 text-slate-400 hover:text-violet-800 hover:bg-violet-50'
                }`}
                title={isHauntedChecked ? '「心リスト」から解除' : '「心リスト」に追加'}
              >
                <Ghost className="w-2.5 h-2.5 text-violet-600" />
                <span>{isHauntedChecked ? '心リスト' : '+心'}</span>
              </button>
            )}

            {onOpenListManager && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenListManager(spot.id);
                }}
                className="px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 bg-slate-100 text-slate-600 hover:text-violet-700 hover:bg-violet-50 border border-slate-200 transition-colors cursor-pointer"
                title="所属リストの管理・登録・解除"
              >
                <span>📋</span>
                <span>リスト</span>
              </button>
            )}

            {onEditSpot && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditSpot(spot);
                }}
                className="px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 transition-colors cursor-pointer"
                title="スポット内容を編集"
              >
                <Edit3 className="w-2.5 h-2.5 text-violet-600" />
                <span>編集</span>
              </button>
            )}
          </div>

          <span
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenDetailModal) {
                onOpenDetailModal(spot.id);
              } else {
                onSelect(spot.id);
              }
            }}
            className="text-violet-600 font-semibold flex items-center gap-0.5 hover:underline ml-auto cursor-pointer"
          >
            詳細 <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    );
  }

  // Row format for side sidebar
  return (
    <div
      id={`spot-item-${spot.id}`}
      onClick={handleCardClick}
      className={`p-2.5 flex items-start gap-2.5 cursor-pointer transition-all ${
        isSelected
          ? 'bg-violet-50/80 border-l-4 border-l-violet-600 shadow-2xs'
          : isMultiSelected
          ? 'bg-emerald-50/40 border-l-4 border-l-emerald-500'
          : 'hover:bg-slate-50/90 border-l-4 border-l-transparent'
      }`}
    >
      {/* Checkbox / Order Badge for multi-select route comparison */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleMultiSelect(spot.id);
        }}
        className={`p-1 rounded-md mt-2 transition-colors cursor-pointer flex flex-col items-center gap-0.5 ${
          isMultiSelected ? 'text-emerald-700 bg-emerald-100/90 border border-emerald-300' : 'text-slate-300 hover:text-emerald-600'
        }`}
        title="ピン同士の下道ルート対象に追加/解除"
      >
        {hasOrderBadge ? (
          <span className="w-3.5 h-3.5 rounded-full bg-emerald-700 text-white text-[8px] font-black flex items-center justify-center shadow-2xs">
            {(orderIndex ?? 0) + 1}
          </span>
        ) : isMultiSelected ? (
          <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
        ) : (
          <Square className="w-3.5 h-3.5" />
        )}
      </button>

      <div className="relative flex-shrink-0 w-13 h-13 min-w-[52px] min-h-[52px] max-w-[52px] max-h-[52px] rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
        {hasCoverPhoto ? (
          <img
            src={coverPhoto.url}
            alt={spot.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center select-none"
            style={{
              backgroundColor: mainCat.color ? `${mainCat.color}15` : '#f1f5f9',
            }}
            title={mainCat.label || categoryInfo.label}
          >
            <span className="text-2xl drop-shadow-2xs leading-none">
              {mainCat.icon || categoryInfo.icon || '👻'}
            </span>
          </div>
        )}
        {photoCount > 1 && (
          <span className="absolute bottom-0.5 right-0.5 bg-black/75 text-white text-[8px] font-bold px-1 py-0.2 rounded shadow">
            📷{photoCount}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          {Array.from(new Set(spot.categories && spot.categories.length > 0 ? spot.categories : [spot.category]))
            .map((catId) => getCategoryDisplay(catId, categories))
            .filter((cInfo) => cInfo && cInfo.label && cInfo.label !== 'カスタム' && cInfo.id !== 'custom')
            .slice(0, 3)
            .map((cInfo, cIdx) => {
              return (
                <span
                  key={`${cInfo.id || 'cat'}_${cIdx}`}
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white shadow-2xs flex items-center gap-0.5 leading-tight"
                  style={{ backgroundColor: cInfo.color }}
                >
                  <span>{cInfo.icon}</span>
                  <span>{cInfo.label}</span>
                </span>
              );
            })}
          {spot.prefecture && (
            <span className="text-[9.5px] text-slate-600 font-bold truncate">
              {spot.prefecture}
            </span>
          )}
          {refCount > 0 && (
            <span className="text-[9px] text-violet-600 font-medium ml-auto flex items-center gap-0.5">
              <ExternalLink className="w-2.5 h-2.5" />
              <span>URL {refCount}件</span>
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-1 mt-0.5">
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-bold text-slate-900 truncate leading-snug">
              {spot.title}
            </h3>
            {spot.yomigana && (
              <span className="text-[9.5px] text-slate-400 font-medium truncate block leading-tight">
                {spot.yomigana}
              </span>
            )}
          </div>
          {onDeleteSpot && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSpot(spot);
              }}
              className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
              title="このスポットをリストから削除"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            </button>
          )}
        </div>

        {/* Local Road Info: Distance & Duration from user location */}
        {isLocationEnabled && routeInfo && routeInfo.status === 'success' ? (
          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] bg-violet-50/80 px-1.5 py-0.5 rounded border border-violet-100 text-violet-900 font-bold">
            <Car className="w-2.5 h-2.5 text-violet-600 flex-shrink-0" />
            <span>最短下道: {formatDistanceJapanese(routeInfo.distanceKm)}</span>
            <span className="text-slate-400">•</span>
            <span className="text-violet-700">約 {formatDurationJapanese(routeInfo.durationMinutes)}</span>
          </div>
        ) : spot.notes ? (
          <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
            {spot.notes}
          </p>
        ) : null}

        {/* Bottom Actions: Rating & Want-to-go / Haunted list buttons */}
        <div className="flex items-center justify-between gap-1 mt-1.5 pt-1 border-t border-slate-100 text-[9px] text-slate-400 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            {spot.rating !== undefined && spot.rating !== null && Number(spot.rating) > 0 ? (
              <div className="flex items-center gap-0.5 text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 shadow-2xs text-[9px]">
                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                <span>★ {Number(spot.rating).toFixed(1)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-0.5 text-slate-400 font-medium bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/60 shadow-2xs text-[9px]">
                <Star className="w-2.5 h-2.5 text-slate-300" />
                <span>未評価</span>
              </div>
            )}

            {onToggleWantToGo && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleWantToGo(spot.id);
                }}
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer ${
                  spot.isWantToGo
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-slate-100 text-slate-500 hover:text-amber-800 hover:bg-amber-50'
                }`}
                title={spot.isWantToGo ? '「行きたい場所」から解除' : '「行きたい場所」に追加'}
              >
                <Bookmark className={`w-2.5 h-2.5 ${spot.isWantToGo ? 'fill-amber-500 text-amber-500' : ''}`} />
                <span>{spot.isWantToGo ? '行きたい' : '+行きたい'}</span>
              </button>
            )}

            {onToggleHaunted && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleHaunted(spot.id);
                }}
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer ${
                  isHauntedChecked
                    ? 'bg-violet-100 text-violet-900 border border-violet-300'
                    : 'bg-slate-100 text-slate-500 hover:text-violet-800 hover:bg-violet-50'
                }`}
                title={isHauntedChecked ? '「心リスト」から解除' : '「心リスト」に追加'}
              >
                <Ghost className="w-2.5 h-2.5 text-violet-600" />
                <span>{isHauntedChecked ? '心リスト' : '+心'}</span>
              </button>
            )}

            {onOpenListManager && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenListManager(spot.id);
                }}
                className="px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 bg-slate-100 text-slate-600 hover:text-violet-700 hover:bg-violet-50 border border-slate-200 transition-colors cursor-pointer"
                title="所属リストの管理・登録・解除"
              >
                <span>📋</span>
                <span>リスト</span>
              </button>
            )}

            {onEditSpot && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditSpot(spot);
                }}
                className="px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 transition-colors cursor-pointer shadow-2xs"
                title="スポット内容を編集"
              >
                <Edit3 className="w-2.5 h-2.5 text-violet-600" />
                <span>編集</span>
              </button>
            )}
          </div>

          <ChevronRight
            className={`w-4 h-4 flex-shrink-0 transition-transform ${
              isSelected ? 'text-violet-600 translate-x-0.5' : 'text-slate-300'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
