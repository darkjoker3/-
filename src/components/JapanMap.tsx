import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { Spot, CustomCategory, UserLocation, SpotRouteInfo, MultiSpotRouteResult, CustomList, SpotListTab } from '../types';
import {
  REGIONAL_CENTERS,
  JAPAN_PREFECTURES,
  PREFECTURE_COORDINATES,
  INITIAL_CATEGORIES,
  getCategoryDisplay,
  CATEGORY_CONFIG,
  getSpotMainCategory,
  getSpotAllCategories,
} from '../data/sampleSpots';
import { findPrefectureFromGeoJson, calculateDistanceKm } from '../utils/geoUtils';
import {
  formatDistanceJapanese,
  formatDurationJapanese,
  getGoogleMapsLocalRoadUrl,
  fetchMultiSpotRoute,
  getGoogleMapsMultiSpotNavUrl,
} from '../utils/routeUtils';
import {
  Compass,
  Layers,
  MapPin,
  ZoomIn,
  ZoomOut,
  Check,
  Tag,
  X,
  Building2,
  ChevronDown,
  ChevronUp,
  Navigation,
  NavigationOff,
  Car,
  Loader2,
  ExternalLink,
  Route as RouteIcon,
  CheckSquare,
  Square,
  Sparkles,
  ArrowRight,
  ArrowUpDown,
  MoveUp,
  MoveDown,
  Trash2,
  Share2,
  Maximize2,
  Edit3,
  Plus,
  FileText,
} from 'lucide-react';

interface JapanMapProps {
  spots: Spot[];
  selectedSpotId: string | null;
  selectedSpotIds: string[]; // 複数選択（ピン同士ルート順）
  onSelectSpot: (id: string, options?: { keepMultiSelect?: boolean; openDetail?: boolean }) => void;
  onOpenDetailModal?: (id: string) => void; // 全画面モーダルを明示的に開く用
  onCloseDetailModal?: () => void; // 詳細カードを閉じる用
  isDetailModalOpen?: boolean; // 詳細カードの開閉状態
  onToggleSelectSpot: (id: string) => void;
  onClearSelectedSpots: () => void;
  onClearSelection?: () => void; // 地図余白クリック等でピン選択を全解除して初期状態に戻す
  onReorderSelectedSpots?: (newIds: string[]) => void;
  onMapClickAdd?: (lat: number, lng: number) => void;
  isAddMode?: boolean;
  selectedPrefecture: string;
  onSelectPrefecture: (prefecture: string) => void;
  categories: CustomCategory[];
  userLocation: UserLocation | null;
  isLocationEnabled: boolean;
  onToggleLocationEnabled: () => void;
  routesInfo: Record<string, SpotRouteInfo>;
  onRequestUserLocation: () => void;
  isLocating: boolean;
  onToggleWantToGo?: (spotId: string) => void;
  onToggleHaunted?: (spotId: string) => void;
  customLists?: CustomList[];
  onOpenListManager?: (spotId: string) => void;
  onEditSpot?: (spot: Spot) => void;
  activeTab?: SpotListTab;
  onSelectTab?: (tab: SpotListTab) => void;
}

type TileType = 'dark' | 'carto' | 'osm' | 'gsi';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const JAPAN_REGIONS_WITH_PREFECTURES: Record<string, string[]> = {
  '北海道・東北': ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県'],
  '関東': ['茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県'],
  '中部・北陸': ['新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県'],
  '近畿・関西': ['三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県'],
  '中国・四国': ['鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県'],
  '九州・沖縄': ['福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'],
};

// Route polyline colors for multi-select
const ROUTE_COLORS = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#06b6d4'];

export const JapanMap: React.FC<JapanMapProps> = ({
  spots,
  selectedSpotId,
  selectedSpotIds,
  onSelectSpot,
  onOpenDetailModal,
  onCloseDetailModal,
  isDetailModalOpen = false,
  onToggleSelectSpot,
  onClearSelectedSpots,
  onClearSelection,
  onReorderSelectedSpots,
  onMapClickAdd,
  isAddMode = false,
  selectedPrefecture,
  onSelectPrefecture,
  categories = INITIAL_CATEGORIES,
  userLocation,
  isLocationEnabled,
  onToggleLocationEnabled,
  routesInfo,
  onRequestUserLocation,
  isLocating,
  onToggleWantToGo,
  onToggleHaunted,
  customLists = [],
  onOpenListManager,
  onEditSpot,
  activeTab,
  onSelectTab,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const prefMarkersRef = useRef<Record<string, L.Marker>>({});
  const userMarkerRef = useRef<L.Marker | null>(null);
  const polylinesRef = useRef<Record<string, L.Polyline>>({});
  const multiRoutePolylineRef = useRef<L.Polyline | null>(null);
  const legDistanceMarkersRef = useRef<L.Marker[]>([]);
  const userRouteDistanceMarkersRef = useRef<L.Marker[]>([]);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const isMarkerOrControlClickedRef = useRef(false);
  const prefectureBoundaryLayerRef = useRef<L.GeoJSON | null>(null);
  const prefectureInteractiveLayerRef = useRef<L.GeoJSON | null>(null);
  const prefectureGeoJsonCacheRef = useRef<any | null>(null);

  const [currentTile, setCurrentTile] = useState<TileType>('osm');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showPrefectureModal, setShowPrefectureModal] = useState(false);
  const [showRouteDrawer, setShowRouteDrawer] = useState(true);

  // ピン同士のルート情報ステート
  const [multiSpotRoute, setMultiSpotRoute] = useState<MultiSpotRouteResult | null>(null);
  const [isCalculatingMultiRoute, setIsCalculatingMultiRoute] = useState(false);
  const [showPinToPinPanel, setShowPinToPinPanel] = useState(true);
  const [routePanelTab, setRoutePanelTab] = useState<'pinToPin' | 'userLocation'>('pinToPin');
  const [isRouteSelectMode, setIsRouteSelectMode] = useState(false);

  // Move spot up/down in route sequence
  const handleMoveSpotOrder = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= selectedSpotIds.length) return;
    const newIds = [...selectedSpotIds];
    const temp = newIds[index];
    newIds[index] = newIds[newIndex];
    newIds[newIndex] = temp;
    if (onReorderSelectedSpots) {
      onReorderSelectedSpots(newIds);
    }
  };

  // 訪問順序を最短距離に最適化
  const handleOptimizeOrder = () => {
    if (selectedSpotsInOrder.length <= 2) return;
    const spotsToOrder = [...selectedSpotsInOrder];
    const ordered: Spot[] = [];
    let currentPoint = userLocation || { lat: spotsToOrder[0].lat, lng: spotsToOrder[0].lng };
    let remaining = [...spotsToOrder];

    while (remaining.length > 0) {
      let nearestIdx = 0;
      let minDistance = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = calculateDistanceKm(currentPoint.lat, currentPoint.lng, remaining[i].lat, remaining[i].lng);
        if (d < minDistance) {
          minDistance = d;
          nearestIdx = i;
        }
      }
      const [nextSpot] = remaining.splice(nearestIdx, 1);
      ordered.push(nextSpot);
      currentPoint = { lat: nextSpot.lat, lng: nextSpot.lng };
    }

    if (onReorderSelectedSpots) {
      onReorderSelectedSpots(ordered.map((s) => s.id));
    }
  };

  // Zoom map to fit all selected spots in the route
  const handleFitMultiRoute = () => {
    const map = mapInstanceRef.current;
    if (map && selectedSpotsInOrder.length >= 2) {
      const bounds = L.latLngBounds(selectedSpotsInOrder.map((s) => [s.lat, s.lng]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    }
  };

  // 全ブラウザ・スマホ・PCで日本全国が画面いっぱいに最も美しく収まる境界
  // [南西端 (沖縄・八重山諸島), 北東端 (北海道最北・最東端)]
  const JAPAN_BOUNDS = useMemo<L.LatLngBoundsLiteral>(() => [
    [24.0, 122.8],
    [45.6, 145.8],
  ], []);

  // 端末サイズ・縦横比（スマホの縦画面 / PCの横長 / 下リストモード）に合わせた最適フィット処理
  // ユーザー様のご要望: 地図の大きさと位置を少し左寄りに配置し、右側の詳細カードと被らず日本全体が見渡せる構図に調整
  const fitToJapanBounds = useCallback((animate = true) => {
    const map = mapInstanceRef.current;
    const container = mapContainerRef.current;
    if (!map || !container) return;

    // 現在のコンテナサイズを確実に最新化
    map.invalidateSize({ animate: false });

    const width = container.clientWidth;
    const height = container.clientHeight;

    // パディング設定: 右側のパディングを大きくすることで日本列島を画像のように少し左寄りに配置
    const padTop = height < 400 ? 12 : 24;
    const padBottom = height < 400 ? 12 : 24;
    const padLeft = width < 480 ? 12 : width < 768 ? 20 : 36;
    // PCやタブレットで右側に詳細カードや情報が重なっても、日本全体が美しく左寄りに収まるように右パディングを調整
    const padRight =
      width < 480
        ? 16
        : width < 768
        ? Math.round(width * 0.16)
        : Math.min(460, Math.max(220, Math.round(width * 0.32)));

    const boundsOptions: L.FitBoundsOptions = {
      paddingTopLeft: [padLeft, padTop],
      paddingBottomRight: [padRight, padBottom],
      maxZoom: 6,
    };

    if (animate) {
      map.flyToBounds(JAPAN_BOUNDS, {
        ...boundsOptions,
        duration: 1.0,
      });
    } else {
      map.fitBounds(JAPAN_BOUNDS, boundsOptions);
    }
  }, [JAPAN_BOUNDS]);

  // Spot counts per prefecture
  const countsMap = useMemo(() => {
    const map: Record<string, number> = {};
    spots.forEach((spot) => {
      if (spot.prefecture) {
        map[spot.prefecture] = (map[spot.prefecture] || 0) + 1;
      }
    });
    return map;
  }, [spots]);

  // Spots filtered by selected prefecture for the map
  const visibleSpots = useMemo(() => {
    const list = selectedPrefecture === 'all' ? spots : spots.filter((s) => s.prefecture === selectedPrefecture);
    const seen = new Set<string>();
    return list.filter((s) => {
      if (!s || !s.id || seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [spots, selectedPrefecture]);

  // 選択中のリスト情報
  const activeList = useMemo(() => {
    if (!activeTab || activeTab === 'all') return null;
    if (activeTab === 'want_to_go') {
      return { id: 'want_to_go', name: '行きたい場所', icon: '📌', color: '#f59e0b' };
    }
    if (activeTab === 'haunted') {
      return { id: 'haunted', name: '心リスト', icon: '👻', color: '#8b5cf6' };
    }
    if (activeTab === 'prefecture') {
      return { id: 'prefecture', name: '県別リスト', icon: '🗾', color: '#06b6d4' };
    }
    const found = customLists?.find((cl) => cl.id === activeTab);
    if (found) {
      return { id: found.id, name: found.name, icon: found.icon || '⭐', color: found.color || '#3b82f6' };
    }
    return null;
  }, [activeTab, customLists]);

  // リスト（タブ）切り替え時に、該当リストのピンが収まるようにカメラをスムーズに移動
  const prevActiveTabRef = useRef<SpotListTab | undefined>(activeTab);
  useEffect(() => {
    if (prevActiveTabRef.current !== activeTab) {
      prevActiveTabRef.current = activeTab;
      const map = mapInstanceRef.current;
      if (!map) return;

      if (activeTab && activeTab !== 'all') {
        if (visibleSpots.length === 1) {
          map.flyTo([visibleSpots[0].lat, visibleSpots[0].lng], Math.max(map.getZoom(), 12), { duration: 0.8 });
        } else if (visibleSpots.length > 1) {
          const bounds = L.latLngBounds(visibleSpots.map((s) => [s.lat, s.lng]));
          if (bounds.isValid()) {
            map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 13, duration: 0.8 });
          }
        }
      }
    }
  }, [activeTab, visibleSpots]);

  // Initialize Map: 全てのブラウザ・スマホ・PCで最適なサイズになるレスポンシブ初期化
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // 初回初期化: zoomControlはカスタムボタンで美しく制御（日本列島が左寄りに収まる初期中心）
    const map = L.map(mapContainerRef.current, {
      center: [37.6, 142.0],
      zoom: 5,
      minZoom: 3,
      maxZoom: 18,
      zoomControl: false,
    });

    const tileConfigs: Record<TileType, { url: string; attribution: string }> = {
      dark: {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      },
      osm: {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      },
      carto: {
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      },
      gsi: {
        url: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
        attribution: '&copy; 国土地理院 (GSI Japan)',
      },
    };

    const initialConfig = tileConfigs.osm;
    const tileLayer = L.tileLayer(initialConfig.url, {
      attribution: initialConfig.attribution,
      maxZoom: 19,
    }).addTo(map);

    tileLayerRef.current = tileLayer;
    mapInstanceRef.current = map;

    // Inject SVG grid pattern definitions into Leaflet pane's SVG renderer
    const injectSvgPattern = () => {
      const container = mapContainerRef.current;
      if (!container) return;
      const svg = container.querySelector('svg');
      if (svg && !svg.querySelector('#pref-grid-pattern')) {
        let defs = svg.querySelector('defs');
        if (!defs) {
          defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
          svg.insertBefore(defs, svg.firstChild);
        }
        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute('id', 'pref-grid-pattern');
        pattern.setAttribute('width', '10');
        pattern.setAttribute('height', '10');
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        pattern.innerHTML = `
          <rect width="10" height="10" fill="#7c3aed" fill-opacity="0.12" />
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#7c3aed" stroke-width="1.2" stroke-opacity="0.4" />
          <circle cx="5" cy="5" r="1" fill="#7c3aed" fill-opacity="0.6" />
        `;
        defs.appendChild(pattern);
      }
    };
    injectSvgPattern();

    // 初回マウント時: コンテナ描画完了を待って画面比率に最適フィット
    const initTimer = setTimeout(() => {
      if (mapInstanceRef.current && mapContainerRef.current) {
        map.invalidateSize({ animate: false });
        fitToJapanBounds(false);
      }
    }, 60);

    // ResizeObserver: パネル開閉やブラウザリサイズにミリ秒単位で追従 (未対応の古いOS/ブラウザでも安全に動作)
    let resizeDebounce: NodeJS.Timeout;
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize({ animate: false });
        clearTimeout(resizeDebounce);
        resizeDebounce = setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize({ animate: false });
          }
        }, 100);
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    // ウィンドウリサイズ & スマホの画面回転（縦⇄横）リスナー
    const handleWindowResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize({ animate: false });
      }
    };
    window.addEventListener('resize', handleWindowResize);
    window.addEventListener('orientationchange', handleWindowResize);

    return () => {
      clearTimeout(initTimer);
      clearTimeout(resizeDebounce);
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('orientationchange', handleWindowResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      userRouteDistanceMarkersRef.current.forEach((m) => m.remove());
      userRouteDistanceMarkersRef.current = [];
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [fitToJapanBounds]);

  // Update Tile Layer
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;

    const tileUrls: Record<TileType, { url: string; attribution: string }> = {
      dark: {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      },
      carto: {
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      },
      osm: {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap contributors',
      },
      gsi: {
        url: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
        attribution: '&copy; 国土地理院 (GSI Japan)',
      },
    };

    tileLayerRef.current.setUrl(tileUrls[currentTile].url);
  }, [currentTile]);

  // Click on map: add pin (in add mode) or clear selection when clicking empty space (何もないところ)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      // If a pin marker or UI button was just clicked, ignore map click
      if (isMarkerOrControlClickedRef.current) {
        return;
      }

      if (isAddMode && onMapClickAdd) {
        onMapClickAdd(e.latlng.lat, e.latlng.lng);
        return;
      }

      // Check if user clicked on an interactive element (e.g. popup, controls, prefecture badge)
      const originalTarget = e.originalEvent?.target as HTMLElement | null;
      if (
        originalTarget?.closest('.leaflet-popup') ||
        originalTarget?.closest('.leaflet-control') ||
        originalTarget?.closest('.prefecture-pill') ||
        originalTarget?.closest('button') ||
        originalTarget?.closest('.user-location-marker-custom')
      ) {
        return;
      }

      // 何もないところ（地図余白・背景・タイル）をクリックした時：
      map.closePopup();
      if (onCloseDetailModal) {
        onCloseDetailModal();
      }

      // 【20. 地図の空白部分タップ】所属都道府県を判定して選択
      try {
        const foundPref = findPrefectureFromGeoJson(
          e.latlng.lat,
          e.latlng.lng,
          prefectureGeoJsonCacheRef.current
        );
        if (foundPref) {
          onSelectPrefecture(foundPref);
        }
      } catch (err) {
        console.warn('Failed to detect prefecture on click:', err);
      }
    };

    // ポップアップが閉じられた時（右上の✕ボタンや背景クリック時）の同期
    const handlePopupClose = () => {
      // ピンの切り替え中などでなければ、詳細カードも同期して閉じる
      if (!isMarkerOrControlClickedRef.current) {
        if (onCloseDetailModal) {
          onCloseDetailModal();
        }
      }
    };

    map.on('click', handleClick);
    map.on('popupclose', handlePopupClose);
    return () => {
      map.off('click', handleClick);
      map.off('popupclose', handlePopupClose);
    };
  }, [isAddMode, onMapClickAdd, onCloseDetailModal]);

  // 県が選択されたときに、その県の境界線をわかりやすく囲む (Prefecture Boundary Highlight)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 既存の県境界線レイヤーを削除
    if (prefectureBoundaryLayerRef.current) {
      map.removeLayer(prefectureBoundaryLayerRef.current);
      prefectureBoundaryLayerRef.current = null;
    }

    // 全表示または未選択時は境界線を描画しない
    if (!selectedPrefecture || selectedPrefecture === 'all') {
      return;
    }

    let isCancelled = false;

    const renderBoundary = (geoJsonData: any) => {
      if (isCancelled || !mapInstanceRef.current) return;

      const targetFeature = geoJsonData.features?.find(
        (f: any) => f.properties?.name === selectedPrefecture
      );

      if (!targetFeature) {
        // GeoJSONに無い場合は座標リストからフォールバック移動
        const coord = PREFECTURE_COORDINATES[selectedPrefecture];
        if (coord) {
          mapInstanceRef.current.flyTo([coord.lat, coord.lng], coord.zoom, { duration: 1.0 });
        }
        return;
      }

      // 県の境界線をハイライト描画（太い紫色の破線枠＋薄紫色の塗りつぶし）
      const boundaryLayer = L.geoJSON(targetFeature, {
        style: {
          color: '#7c3aed', // 鮮やかなバイオレット
          weight: 4, // 太い境界線
          opacity: 0.95,
          fillColor: '#8b5cf6',
          fillOpacity: 0.16, // 県全体がふんわり浮き立つ
          dashArray: '6, 6',
          lineCap: 'round',
          lineJoin: 'round',
        },
      });

      // 境界線に県名バッジのツールチップをバインド
      boundaryLayer.bindTooltip(
        `<div class="font-bold text-xs text-violet-950 py-0.5 px-1.5 flex items-center gap-1.5">
          <span class="text-base">🗾</span>
          <span>${selectedPrefecture}</span>
          <span class="text-[10px] text-violet-600 font-semibold bg-violet-100 px-1 py-0.2 rounded">境界エリア</span>
        </div>`,
        { sticky: true, className: 'prefecture-boundary-tooltip shadow-lg border border-violet-200 rounded-lg' }
      );

      boundaryLayer.addTo(mapInstanceRef.current);
      prefectureBoundaryLayerRef.current = boundaryLayer;

      // 境界線全体が画面内に美しく収まるようにスムーズにカメラを移動
      try {
        const bounds = boundaryLayer.getBounds();
        if (bounds.isValid()) {
          mapInstanceRef.current.fitBounds(bounds, {
            padding: [45, 45],
            maxZoom: 11,
            duration: 1.0,
          });
        }
      } catch (e) {
        console.error('Failed to fit prefecture bounds:', e);
      }
    };

    if (prefectureGeoJsonCacheRef.current) {
      renderBoundary(prefectureGeoJsonCacheRef.current);
    } else {
      fetch('/prefectures.geojson')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load prefectures.geojson');
          return res.json();
        })
        .then((data) => {
          prefectureGeoJsonCacheRef.current = data;
          renderBoundary(data);
        })
        .catch((err) => {
          console.warn('Prefecture boundary load error:', err);
          // フォールバック: 既存の中心座標でズーム
          const coord = PREFECTURE_COORDINATES[selectedPrefecture];
          if (coord) {
            map.flyTo([coord.lat, coord.lng], coord.zoom, { duration: 1.0 });
          }
        });
    }

    return () => {
      isCancelled = true;
    };
  }, [selectedPrefecture]);

  // User Current Location Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (isLocationEnabled && userLocation) {
      const userIcon = L.divIcon({
        className: 'user-location-marker-custom',
        html: `
          <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 select-none pointer-events-auto cursor-pointer group" title="あなたの現在地（クリックで詳細）">
            <!-- Pulsating GPS Radar Wave 1 -->
            <div class="user-pulse-ring-1"></div>
            <!-- Pulsating GPS Radar Wave 2 (Staggered) -->
            <div class="user-pulse-ring-2"></div>
            <!-- Breathing Core Marker -->
            <div class="user-pulse-core"></div>
            <!-- High-Contrast Current Location Label Badge -->
            <div class="user-location-badge group-hover:scale-105 transition-transform">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              <span>現在地</span>
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([userLocation.lat, userLocation.lng], {
        icon: userIcon,
        zIndexOffset: 2500,
      }).addTo(map);

      // Bind informative popup to user location marker
      marker.bindPopup(`
        <div class="p-3.5 text-center min-w-[200px]">
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200/80 mb-1.5">
            <span class="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
            あなたの現在地 (GPS)
          </div>
          <div class="text-[11px] text-slate-500 font-mono">
            ${userLocation.lat.toFixed(4)}°N, ${userLocation.lng.toFixed(4)}°E
          </div>
          <div class="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600 leading-snug">
            🚗 各ピンを選択すると、現在地からの<strong class="text-blue-700 font-bold">下道ルート・到着時間・距離</strong>が自動計算されます。
          </div>
        </div>
      `, {
        className: 'spot-custom-popup',
        offset: [0, -12],
      });

      userMarkerRef.current = marker;
    }
  }, [userLocation, isLocationEnabled]);

  // Combined route target IDs (ensure currently selected spot is always included)
  const targetRouteSpotIds = useMemo(() => {
    const set = new Set(selectedSpotIds);
    if (selectedSpotId) set.add(selectedSpotId);
    return Array.from(set);
  }, [selectedSpotIds, selectedSpotId]);

  // Selected spots list in exact routing order (ピン同士の巡回順リスト)
  const selectedSpotsInOrder = useMemo(() => {
    const seen = new Set<string>();
    return selectedSpotIds
      .map((id) => spots.find((s) => s.id === id))
      .filter((s): s is Spot => {
        if (!s || !s.id || seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
  }, [selectedSpotIds, spots]);

  // Calculate Pin-to-Pin Route (選択したピン同士での下道ルートと距離)
  useEffect(() => {
    if (selectedSpotsInOrder.length < 2) {
      setMultiSpotRoute(null);
      return;
    }

    let isMounted = true;
    setIsCalculatingMultiRoute(true);

    fetchMultiSpotRoute(selectedSpotsInOrder)
      .then((result) => {
        if (isMounted) {
          setMultiSpotRoute(result);
          setIsCalculatingMultiRoute(false);
          setShowRouteDrawer(true);
          setRoutePanelTab('pinToPin');

          // Fit map bounds to encompass all selected spots in the route smoothly
          const map = mapInstanceRef.current;
          if (map && selectedSpotsInOrder.length >= 2) {
            const bounds = L.latLngBounds(selectedSpotsInOrder.map((s) => [s.lat, s.lng]));
            map.fitBounds(bounds, { padding: [70, 70], maxZoom: 13, duration: 0.9 });
          }
        }
      })
      .catch((err) => {
        console.error('Failed to calculate pin-to-pin route:', err);
        if (isMounted) {
          setIsCalculatingMultiRoute(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSpotsInOrder]);

  // Draw Pin-to-Pin Route Polyline & Leg Distance Badges on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing pin-to-pin polyline
    if (multiRoutePolylineRef.current) {
      multiRoutePolylineRef.current.remove();
      multiRoutePolylineRef.current = null;
    }

    // Remove existing leg distance badge markers
    legDistanceMarkersRef.current.forEach((m) => m.remove());
    legDistanceMarkersRef.current = [];

    if (!multiSpotRoute || multiSpotRoute.coordinates.length === 0) return;

    // Draw main pin-to-pin local road polyline (鮮やかなシアンブルー)
    const polyline = L.polyline(multiSpotRoute.coordinates, {
      color: '#0284c7', // Sky/Cyan matching Screen 3 & 4
      weight: 6,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    multiRoutePolylineRef.current = polyline;

    // Draw distance badges for each leg between consecutive spots on the map
    if (multiSpotRoute.legs && multiSpotRoute.legs.length > 0) {
      multiSpotRoute.legs.forEach((leg, index) => {
        const fromSpot = spots.find((s) => s.id === leg.fromSpotId);
        const toSpot = spots.find((s) => s.id === leg.toSpotId);
        if (!fromSpot || !toSpot) return;

        // Midpoint coordinates for leg badge (along road coordinates if available)
        let midLat = (fromSpot.lat + toSpot.lat) / 2;
        let midLng = (fromSpot.lng + toSpot.lng) / 2;
        if (leg.coordinates && leg.coordinates.length > 0) {
          const midPoint = leg.coordinates[Math.floor(leg.coordinates.length / 2)];
          if (midPoint && midPoint.length >= 2) {
            midLat = midPoint[0];
            midLng = midPoint[1];
          }
        }

        const badgeIcon = L.divIcon({
          className: 'leg-distance-badge-marker',
          html: `
            <div class="route-distance-chip" style="display:inline-flex;align-items:center;gap:8px;background:#090d16 !important;background-color:#090d16 !important;color:#ffffff !important;padding:6px 14px !important;border-radius:9999px !important;border:2px solid #10b981 !important;box-shadow:0 6px 20px rgba(0,0,0,0.85), 0 0 14px rgba(16,185,129,0.5) !important;white-space:nowrap !important;transform:translate(-50%, -50%) !important;pointer-events:auto;cursor:pointer;font-family:inherit;z-index:1000;" title="区間 ${index + 1}: ${escapeHtml(fromSpot.title)} → ${escapeHtml(toSpot.title)}">
              <span style="width:20px;height:20px;border-radius:9999px;background:#10b981 !important;color:#020617 !important;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,0.5);">${index + 1}</span>
              <span style="display:flex;align-items:center;gap:4px;">
                <span style="font-size:13px;line-height:1;">🚗</span>
                <span style="font-size:13px;font-weight:900;color:#ffffff !important;letter-spacing:0.02em;text-shadow:0 1px 3px rgba(0,0,0,0.9);">${formatDistanceJapanese(leg.distanceKm)}</span>
              </span>
              <span style="font-size:12px;font-weight:800;color:#38bdf8 !important;letter-spacing:0.01em;text-shadow:0 1px 3px rgba(0,0,0,0.9);">(${formatDurationJapanese(leg.durationMinutes)})</span>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const marker = L.marker([midLat, midLng], {
          icon: badgeIcon,
          zIndexOffset: 1500,
          interactive: true,
        }).addTo(map);

        marker.bindTooltip(`
          <div style="padding:4px 6px;text-align:left;color:#ffffff;">
            <div style="display:flex;align-items:center;gap:6px;font-weight:900;font-size:12px;color:#34d399;">
              <span style="width:18px;height:18px;border-radius:9999px;background:#10b981;color:#020617;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;">${index + 1}</span>
              <span>区間 ${index + 1}: ${escapeHtml(fromSpot.title)} → ${escapeHtml(toSpot.title)}</span>
            </div>
            <div style="margin-top:6px;font-size:12px;font-weight:800;display:flex;align-items:center;gap:8px;">
              <span style="color:#ffffff;">距離: <strong style="color:#ffffff;font-weight:900;">${formatDistanceJapanese(leg.distanceKm)}</strong></span>
              <span style="color:#38bdf8;">所要時間: <strong style="color:#38bdf8;font-weight:900;">約${formatDurationJapanese(leg.durationMinutes)}</strong></span>
            </div>
            <div style="font-size:10px;color:#94a3b8;font-weight:600;margin-top:3px;">🚗 高速・有料道路不使用 (最短下道)</div>
          </div>
        `, { direction: 'top', offset: [0, -10], className: 'route-leg-tooltip shadow-2xl rounded-xl' });

        legDistanceMarkersRef.current.push(marker);
      });
    }
  }, [multiSpotRoute, spots]);

  // Update Route Polylines & Distance Badges from userLocation to target spots on the map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing user polylines
    Object.values(polylinesRef.current).forEach((polyline) => polyline.remove());
    polylinesRef.current = {};

    // Remove existing user route distance markers
    userRouteDistanceMarkersRef.current.forEach((m) => m.remove());
    userRouteDistanceMarkersRef.current = [];

    if (!userLocation || !isLocationEnabled) return;

    // Draw route polyline from userLocation to each selected spot
    // If multiSpotRoute exists, make user routes lighter/dashed so pin-to-pin route is primary
    const isMultiActive = selectedSpotsInOrder.length >= 2;

    targetRouteSpotIds.forEach((spotId, index) => {
      const route = routesInfo[spotId];
      if (route && route.coordinates && route.coordinates.length > 0) {
        const isCurrentSpot = spotId === selectedSpotId;
        const isFirstSpotInMulti = isMultiActive && selectedSpotsInOrder[0]?.id === spotId;
        const isPrimaryUserRoute = isFirstSpotInMulti || isCurrentSpot || (!isMultiActive && targetRouteSpotIds.length === 1);
        const color = isCurrentSpot || isFirstSpotInMulti ? '#0284c7' : ROUTE_COLORS[index % ROUTE_COLORS.length];
        const isApprox = route.isApproximate || route.status === 'loading';
        const polyline = L.polyline(route.coordinates, {
          color,
          weight: isCurrentSpot || isFirstSpotInMulti ? (isMultiActive ? 5 : 6) : 3,
          opacity: isCurrentSpot || isFirstSpotInMulti ? 0.95 : (isMultiActive ? 0.6 : 0.75),
          dashArray: isApprox ? '6, 6' : undefined,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        polylinesRef.current[spotId] = polyline;

        // 【ご要望対応】現在地から1ピン目（または選択ピン）までのルート上に距離と走行時間を鮮明・見やすく表示
        if (isPrimaryUserRoute && route.distanceKm > 0) {
          const targetSpot = spots.find((s) => s.id === spotId);
          if (targetSpot) {
            // ルート座標の中間点（約45%地点）を取得
            const coordIndex = Math.floor(route.coordinates.length * 0.45);
            const [badgeLat, badgeLng] = route.coordinates[coordIndex] || [
              (userLocation.lat + targetSpot.lat) / 2,
              (userLocation.lng + targetSpot.lng) / 2,
            ];

            const badgeLabel = isFirstSpotInMulti
              ? '現在地 ➔ 1ピン目'
              : '現在地 ➔ 目的地';

            const userRouteBadgeIcon = L.divIcon({
              className: 'user-route-distance-badge-marker',
              html: `
                <div class="user-route-chip-card" style="display:inline-flex;align-items:center;gap:8px;background:rgba(9,13,22,0.96) !important;color:#ffffff !important;padding:7px 16px !important;border-radius:9999px !important;border:2.5px solid #38bdf8 !important;box-shadow:0 8px 24px rgba(0,0,0,0.85), 0 0 16px rgba(56,189,248,0.6) !important;white-space:nowrap !important;transform:translate(-50%, -50%) !important;pointer-events:auto;cursor:pointer;font-family:inherit;z-index:3000;">
                  <span style="display:inline-flex;align-items:center;gap:4px;background:#0284c7 !important;color:#ffffff !important;padding:3px 9px !important;border-radius:9999px !important;font-size:11px !important;font-weight:900 !important;letter-spacing:0.02em;box-shadow:0 1px 4px rgba(0,0,0,0.4);">
                    <span style="font-size:11px;">📍</span>
                    <span>${badgeLabel}</span>
                  </span>
                  <span style="display:flex;align-items:center;gap:4px;font-size:14px !important;font-weight:900 !important;color:#ffffff !important;letter-spacing:0.02em;text-shadow:0 1px 3px rgba(0,0,0,0.9);">
                    <span style="font-size:14px;">🚗</span>
                    <span>${formatDistanceJapanese(route.distanceKm)}</span>
                  </span>
                  <span style="font-size:12px !important;font-weight:800 !important;color:#38bdf8 !important;background:rgba(56,189,248,0.18) !important;padding:3px 9px !important;border-radius:9999px !important;border:1px solid rgba(56,189,248,0.4) !important;letter-spacing:0.02em;text-shadow:0 1px 3px rgba(0,0,0,0.9);">
                    下道 約${formatDurationJapanese(route.durationMinutes)}
                  </span>
                </div>
              `,
              iconSize: [0, 0],
              iconAnchor: [0, 0],
            });

            const marker = L.marker([badgeLat, badgeLng], {
              icon: userRouteBadgeIcon,
              zIndexOffset: 3000,
              interactive: true,
            }).addTo(map);

            marker.bindTooltip(`
              <div style="padding:6px 8px;text-align:left;color:#ffffff;">
                <div style="display:flex;align-items:center;gap:6px;font-weight:900;font-size:13px;color:#38bdf8;">
                  <span>📍 現在地 ➔ ${escapeHtml(targetSpot.title)}</span>
                </div>
                <div style="margin-top:6px;font-size:13px;font-weight:900;display:flex;align-items:center;gap:10px;">
                  <span style="color:#ffffff;">下道距離: <strong style="color:#ffffff;">${formatDistanceJapanese(route.distanceKm)}</strong></span>
                  <span style="color:#38bdf8;">所要時間: <strong style="color:#38bdf8;">約${formatDurationJapanese(route.durationMinutes)}</strong></span>
                </div>
                <div style="font-size:11px;color:#94a3b8;font-weight:600;margin-top:4px;">🚗 高速道路・有料道路不使用 (下道ルート)</div>
              </div>
            `, { direction: 'top', offset: [0, -14], className: 'route-leg-tooltip shadow-2xl rounded-xl' });

            userRouteDistanceMarkersRef.current.push(marker);
          }
        }
      }
    });
  }, [userLocation, isLocationEnabled, targetRouteSpotIds, selectedSpotId, routesInfo, selectedSpotsInOrder, spots]);

  // Automatically open speech-bubble popup when selectedSpotId changes, or close when null
  useEffect(() => {
    if (!selectedSpotId) {
      const map = mapInstanceRef.current;
      if (map) {
        map.closePopup();
      }
      return;
    }
    const timer = setTimeout(() => {
      const marker = markersRef.current[selectedSpotId];
      if (marker && !marker.isPopupOpen()) {
        marker.openPopup();
      }
    }, 25);
    return () => clearTimeout(timer);
  }, [selectedSpotId]);

  // 47都道府県のインタラクティブ・ホバーオーバーレイ（ホバーでグリッド表示＋登録件数の吹き出しコメントを表示）
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 旧レイヤーのクリーンアップ
    if (prefectureInteractiveLayerRef.current) {
      map.removeLayer(prefectureInteractiveLayerRef.current);
      prefectureInteractiveLayerRef.current = null;
    }
    // 旧バッジマーカーが残っていれば全削除
    Object.values(prefMarkersRef.current).forEach((m) => m.remove());
    prefMarkersRef.current = {};

    let isCancelled = false;

    // SVG pattern defs が存在するか確認し、なければ生成
    const ensureSvgPattern = () => {
      const container = mapContainerRef.current;
      if (!container) return;
      const svg = container.querySelector('svg');
      if (svg && !svg.querySelector('#pref-grid-pattern')) {
        let defs = svg.querySelector('defs');
        if (!defs) {
          defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
          svg.insertBefore(defs, svg.firstChild);
        }
        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute('id', 'pref-grid-pattern');
        pattern.setAttribute('width', '10');
        pattern.setAttribute('height', '10');
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        pattern.innerHTML = `
          <rect width="10" height="10" fill="#7c3aed" fill-opacity="0.14" />
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#7c3aed" stroke-width="1.2" stroke-opacity="0.45" />
          <circle cx="5" cy="5" r="1" fill="#7c3aed" fill-opacity="0.7" />
        `;
        defs.appendChild(pattern);
      }
    };

    const renderInteractiveLayer = (geoJsonData: any) => {
      if (isCancelled || !mapInstanceRef.current) return;
      ensureSvgPattern();

      // 通常時の透明スタイル（地図の視認性を邪魔しない）
      const defaultStyle = (feature: any) => {
        const prefName = feature?.properties?.name;
        const isSelected = selectedPrefecture === prefName;
        if (isSelected) {
          return {
            color: '#7c3aed',
            weight: 2.5,
            opacity: 0.9,
            fillColor: '#8b5cf6',
            fillOpacity: 0.15,
            className: 'prefecture-polygon-selected cursor-pointer',
          };
        }
        return {
          color: '#94a3b8',
          weight: 0.8,
          opacity: 0.35,
          fillColor: '#6366f1',
          fillOpacity: 0.001, // ほぼ透明だがホバーイベントを確実に拾う
          className: 'prefecture-polygon cursor-pointer transition-all duration-150',
        };
      };

      const interactiveLayer = L.geoJSON(geoJsonData, {
        style: defaultStyle,
        onEachFeature: (feature, layer: any) => {
          const prefName = feature.properties?.name || '不明';
          const count = countsMap[prefName] || 0;
          const isSelected = selectedPrefecture === prefName;

          // ホバー時のツールチップ（吹き出しコメント風）
          const tooltipContent = `
            <div style="display:flex;align-items:center;gap:8px;padding:3px 2px;">
              <span style="font-size:16px;line-height:1;">🗾</span>
              <div style="display:flex;flex-direction:column;text-align:left;">
                <span style="font-weight:800;font-size:13px;color:#ffffff !important;line-height:1.2;letter-spacing:0.02em;">${prefName}</span>
                <span style="font-size:11px;color:#cbd5e1 !important;font-weight:600;margin-top:2px;display:flex;align-items:center;gap:4px;">
                  登録スポット: <strong style="color:${count > 0 ? '#38bdf8' : '#94a3b8'} !important;font-weight:800;">${count}件</strong>
                </span>
              </div>
              ${
                count > 0
                  ? `<span style="margin-left:6px;background:#38bdf8 !important;color:#0f172a !important;font-size:11px;font-weight:900;padding:2px 7px;border-radius:9999px;box-shadow:0 1px 3px rgba(0,0,0,0.3);line-height:1.2;">${count}</span>`
                  : ''
              }
            </div>
          `;

          layer.bindTooltip(tooltipContent, {
            sticky: true,
            className: 'prefecture-hover-tooltip',
            direction: 'top',
            offset: [0, -10],
          });

          // マウスホバー・アウト・クリック挙動
          layer.on({
            mouseover: (e: L.LeafletMouseEvent) => {
              ensureSvgPattern();
              const target = e.target;
              // ホバー時にグリッドパターンを適用し、境界線を強調
              target.setStyle({
                color: '#7c3aed',
                weight: 2.5,
                opacity: 0.95,
                fillColor: '#8b5cf6',
                fillOpacity: 0.22,
                dashArray: '',
              });
              if (target._path) {
                target._path.classList.add('prefecture-grid-active');
              }
              if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                target.bringToFront();
              }
            },
            mouseout: (e: L.LeafletMouseEvent) => {
              const target = e.target;
              if (target._path) {
                target._path.classList.remove('prefecture-grid-active');
              }
              interactiveLayer.resetStyle(target);
            },
            click: (e: L.LeafletMouseEvent) => {
              isMarkerOrControlClickedRef.current = true;
              setTimeout(() => {
                isMarkerOrControlClickedRef.current = false;
              }, 300);
              if (e && e.originalEvent) {
                L.DomEvent.stopPropagation(e);
              }
              onSelectPrefecture(selectedPrefecture === prefName ? 'all' : prefName);
            },
          });
        },
      });

      interactiveLayer.addTo(mapInstanceRef.current);
      prefectureInteractiveLayerRef.current = interactiveLayer;
    };

    if (prefectureGeoJsonCacheRef.current) {
      renderInteractiveLayer(prefectureGeoJsonCacheRef.current);
    } else {
      fetch('/prefectures.geojson')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load prefectures.geojson');
          return res.json();
        })
        .then((data) => {
          prefectureGeoJsonCacheRef.current = data;
          renderInteractiveLayer(data);
        })
        .catch((err) => {
          console.warn('Failed to load prefectures for interactive layer:', err);
        });
    }

    return () => {
      isCancelled = true;
      if (prefectureInteractiveLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(prefectureInteractiveLayerRef.current);
        prefectureInteractiveLayerRef.current = null;
      }
    };
  }, [countsMap, selectedPrefecture, onSelectPrefecture]);

  // Update Spot Markers on the map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old markers
    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    visibleSpots.forEach((spot) => {
      const isSelected = spot.id === selectedSpotId;
      const isMultiSelected = selectedSpotIds.includes(spot.id);
      const multiSelectIndex = selectedSpotIds.indexOf(spot.id);
      const route = routesInfo[spot.id];
      const mainCat = getSpotMainCategory(spot, categories);
      const coverPhoto = spot.photos.find((p) => p.isCover) || spot.photos[0];
      const escapedTitle = escapeHtml(spot.title);

      const routeColor =
        multiSelectIndex >= 0
          ? ROUTE_COLORS[multiSelectIndex % ROUTE_COLORS.length]
          : mainCat.color;

      const iconHtml = `
        <div class="relative group cursor-pointer transform -translate-x-1/2 -translate-y-full transition-all duration-200 ${
          isSelected || isMultiSelected ? 'scale-110 z-[1000]' : 'hover:scale-105 z-20'
        }">
          <div class="flex flex-col items-center">
            ${
              isMultiSelected
                ? `<div class="absolute -top-3.5 -right-2.5 w-6 h-6 rounded-full bg-emerald-500 text-white text-[11px] font-black flex items-center justify-center shadow-lg ring-2 ring-white z-30">
                    ${multiSelectIndex + 1}
                   </div>`
                : selectedSpotIds.length > 0
                ? `<div class="absolute -top-2.5 -right-2 w-4 h-4 rounded-full bg-emerald-700 text-white text-[9px] font-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-30">
                    +
                   </div>`
                : ''
            }

            <div class="py-0.5 px-2 rounded-lg shadow-md border transition-all duration-200 font-bold text-[11px] tracking-tight whitespace-nowrap max-w-[170px] truncate flex items-center gap-1 ${
              isMultiSelected
                ? 'bg-slate-950 text-white border-2 border-emerald-400 ring-2 ring-emerald-500/40 shadow-emerald-500/30'
                : isSelected
                ? 'bg-slate-950 text-white border-2 ring-2 shadow-xl'
                : 'bg-slate-900/95 text-white border-slate-700 hover:border-slate-500 hover:scale-105'
            }" style="${
              isSelected
                ? `border-color: ${mainCat.color}; --tw-ring-color: ${mainCat.color}50;`
                : !isMultiSelected
                ? `border-left-width: 4px; border-left-color: ${mainCat.color};`
                : ''
            }">
              <span class="text-xs flex-shrink-0">${mainCat.icon}</span>
              <span class="truncate">${escapedTitle}</span>
            </div>

            <div class="w-2.5 h-2.5 rotate-45 -mt-1 border-r border-b ${
              isMultiSelected
                ? 'bg-slate-950 border-emerald-400'
                : 'bg-slate-900 border-slate-700'
            }" style="${isSelected ? `background-color: ${mainCat.color}; border-color: ${mainCat.color};` : ''}"></div>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-spot-pin-container',
        html: iconHtml,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([spot.lat, spot.lng], {
        icon: customIcon,
        zIndexOffset: isSelected || isMultiSelected ? 1000 : 100,
      }).addTo(map);

      // Pin Click Event:
      // ユーザー要望:
      // 「ピン選択したときは複数選択にしないで大丈夫です。ピンごとに１つ１つピン見えるようにして欲しい。
      //  地図上の複数選択を押したとき、またはリストのチェックボックスを入れたときにだけ複数選択にほしい。」
      marker.on("click", (e) => {
        isMarkerOrControlClickedRef.current = true;
        setTimeout(() => {
          isMarkerOrControlClickedRef.current = false;
        }, 300);

        if (e && e.originalEvent) {
          L.DomEvent.stopPropagation(e);
        }

        // 開いているポップアップがあれば閉じる
        map.closePopup();

        if (isRouteSelectMode) {
          // 「ルート複数選択」モードがONの時: ピンをタップして複数選択（ルート追加／解除）
          onToggleSelectSpot(spot.id);
          setShowRouteDrawer(true);
        } else {
          // 通常時: ピンごとに１つ１つピンを見る（単一選択）
          onSelectSpot(spot.id);
          if (onOpenDetailModal) {
            onOpenDetailModal(spot.id);
          }
        }
      });

      markersRef.current[spot.id] = marker;
    });
  }, [
    visibleSpots,
    selectedSpotId,
    selectedSpotIds,
    routesInfo,
    userLocation,
    isLocationEnabled,
    categories,
    onSelectSpot,
    onOpenDetailModal,
    isRouteSelectMode,
    onToggleSelectSpot,
  ]);

  // Currently active spot object
  const activeSpot = useMemo(() => {
    if (!selectedSpotId) return null;
    return spots.find((s) => s.id === selectedSpotId) || null;
  }, [selectedSpotId, spots]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-slate-900">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Left Controls: Tile Layer Selector & Prefecture Modal Button & Fit Bounds */}
      {!isDetailModalOpen && (
        <div id="map-top-left-controls" className="absolute top-4 left-4 z-[500] flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {/* Layer Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLayerMenu(!showLayerMenu)}
                className="p-2.5 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200/90 text-slate-700 hover:text-violet-600 hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                title="地図レイヤー変更"
              >
                <Layers className="w-4 h-4 text-violet-600" />
                <span className="hidden sm:inline">
                  {currentTile === 'osm' ? '標準地図 (OSM)' : currentTile === 'dark' ? 'ダーク' : currentTile === 'carto' ? 'シンプル' : '国土地理院'}
                </span>
              </button>

              {showLayerMenu && (
                <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 flex flex-col gap-1 min-w-[140px] z-50">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentTile('osm');
                      setShowLayerMenu(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-left transition-colors flex items-center justify-between ${
                      currentTile === 'osm' ? 'bg-violet-100 text-violet-800' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span>標準地図 (OSM / OCM)</span>
                    {currentTile === 'osm' && <Check className="w-3.5 h-3.5 text-violet-600" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentTile('dark');
                      setShowLayerMenu(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-left transition-colors flex items-center justify-between ${
                      currentTile === 'dark' ? 'bg-violet-100 text-violet-800' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span>ダーク (Dark)</span>
                    {currentTile === 'dark' && <Check className="w-3.5 h-3.5 text-violet-600" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentTile('carto');
                      setShowLayerMenu(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-left transition-colors flex items-center justify-between ${
                      currentTile === 'carto' ? 'bg-violet-100 text-violet-800' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span>シンプル (Carto)</span>
                    {currentTile === 'carto' && <Check className="w-3.5 h-3.5 text-violet-600" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentTile('gsi');
                      setShowLayerMenu(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-left transition-colors flex items-center justify-between ${
                      currentTile === 'gsi' ? 'bg-violet-100 text-violet-800' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span>国土地理院 (淡色)</span>
                    {currentTile === 'gsi' && <Check className="w-3.5 h-3.5 text-violet-600" />}
                  </button>
                </div>
              )}
            </div>

            {/* 47都道府県一覧モーダルを開くボタン */}
            <button
              type="button"
              onClick={() => setShowPrefectureModal(true)}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-white/95 backdrop-blur-md rounded-xl shadow-md sm:shadow-lg border border-slate-200/90 text-slate-700 hover:text-violet-600 hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 text-xs font-bold"
              title="日本全国47都道府県一覧から選択"
            >
              <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-600" />
              <span className="hidden sm:inline">
                {selectedPrefecture === 'all' ? '47都道府県' : selectedPrefecture}
              </span>
              <span className="sm:hidden text-xs">県一覧</span>
            </button>

            {/* 全体表示（日本列島にフィット） */}
            <button
              type="button"
              onClick={() => fitToJapanBounds(true)}
              className="p-2 sm:p-2.5 bg-white/95 backdrop-blur-md rounded-xl shadow-md sm:shadow-lg border border-slate-200/90 text-slate-700 hover:text-violet-600 hover:bg-slate-50 transition-all cursor-pointer flex items-center justify-center"
              title="日本全体を表示"
            >
              <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>

          {/* 選択中の都道府県バッジ */}
          {selectedPrefecture !== 'all' && (
            <div className="flex items-center gap-1 sm:gap-1.5 bg-violet-900/90 backdrop-blur-md text-white px-2.5 py-1 sm:px-3 rounded-xl shadow-md text-[11px] sm:text-xs font-bold w-fit animate-in fade-in">
              <span>📍 {selectedPrefecture}を表示中</span>
              <button
                type="button"
                onClick={() => onSelectPrefecture('all')}
                className="ml-1 text-violet-300 hover:text-white p-0.5 rounded-full cursor-pointer"
                title="解除"
              >
                <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            </div>
          )}

          {/* 選択中のリストバッジ（リストに該当するものだけピン表示中） */}
          {activeList && (
            <div
              id="map-active-list-badge"
              className="flex items-center gap-1.5 sm:gap-2 bg-slate-900/95 backdrop-blur-md text-white px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl shadow-lg border text-[11px] sm:text-xs font-bold w-fit animate-in fade-in select-none"
              style={{ borderLeftWidth: '4px', borderLeftColor: activeList.color }}
            >
              <span className="text-sm">{activeList.icon}</span>
              <span className="truncate max-w-[150px] sm:max-w-[220px]">「{activeList.name}」表示中</span>
              <span
                className="px-1.5 py-0.2 rounded-full text-[10px] font-black"
                style={{ backgroundColor: `${activeList.color}25`, color: activeList.color }}
              >
                {visibleSpots.length}件
              </span>
              {onSelectTab && (
                <button
                  type="button"
                  onClick={() => onSelectTab('all')}
                  className="ml-1 text-slate-400 hover:text-white p-0.5 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
                  title="全リストのピン表示に戻す"
                >
                  <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Top Right Controls: Route Select Mode & Manual Location Toggle
          詳細カードが開いている時は、重なりを自動回避するため地図の空いている左上エリアへ自動移動 */}
      {(() => {
        const hasTopBanner = Boolean(isRouteSelectMode || selectedSpotsInOrder.length > 0 || !!selectedSpotId);
        return (
          <div
            id="map-top-right-controls"
            className={`absolute z-[700] flex flex-col gap-1.5 sm:gap-2 pointer-events-auto transition-all duration-300 ease-in-out ${
              isDetailModalOpen
                ? hasTopBanner
                  ? 'top-14 sm:top-15 left-2 sm:left-4 items-start'
                  : 'top-3 sm:top-4 left-2 sm:left-4 items-start'
                : 'top-3 right-2 sm:top-4 sm:right-4 items-end'
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* ルート複数選択モードのトグルボタン (ON/OFF 切り替え) */}
              <button
                type="button"
                id="map-route-multiselect-toggle-btn"
                onClick={() => {
                  const nextMode = !isRouteSelectMode;
                  setIsRouteSelectMode(nextMode);
                  if (nextMode) {
                    setShowRouteDrawer(true);
                    // もしすでにピンが1つ単一選択されていて、ルート一覧に未追加なら追加する
                    if (selectedSpotId && !selectedSpotIds.includes(selectedSpotId)) {
                      onToggleSelectSpot(selectedSpotId);
                    }
                  }
                }}
                className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl shadow-md sm:shadow-lg backdrop-blur-md border text-[11px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 cursor-pointer transition-all select-none whitespace-nowrap ${
                  isRouteSelectMode
                    ? 'bg-emerald-600 text-white border-emerald-400 ring-2 ring-emerald-300 shadow-emerald-500/30'
                    : selectedSpotsInOrder.length > 0
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                    : 'bg-white/95 text-slate-700 border-slate-200/90 hover:bg-slate-50'
                }`}
                title={isRouteSelectMode ? 'ルート複数選択をOFFにする（ピン個別選択モード）' : 'ルート複数選択をONにする（連続ピン選択でルート作成）'}
              >
                <RouteIcon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isRouteSelectMode ? 'text-white' : 'text-emerald-600'}`} />
                <span>
                  {isRouteSelectMode
                    ? `ルート複数選択: ON${selectedSpotsInOrder.length > 0 ? ` (${selectedSpotsInOrder.length})` : ''}`
                    : `ルート複数選択: OFF${selectedSpotsInOrder.length > 0 ? ` (${selectedSpotsInOrder.length})` : ''}`}
                </span>
              </button>

              {/* 手動切り替え (ON / OFF) 現在地ボタン */}
              <button
                type="button"
                id="map-location-toggle-btn"
                onClick={onToggleLocationEnabled}
                className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl shadow-md sm:shadow-lg backdrop-blur-md border text-[11px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 cursor-pointer transition-all select-none whitespace-nowrap ${
                  isLocationEnabled
                    ? 'bg-blue-600 text-white border-blue-500 hover:bg-blue-700 shadow-blue-500/20'
                    : 'bg-white/95 text-slate-700 border-slate-200/90 hover:bg-slate-50'
                }`}
                title={isLocationEnabled ? '現在地機能をOFFにする' : '現在地機能をONにする（手動）'}
              >
                {isLocating ? (
                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-blue-200" />
                ) : isLocationEnabled ? (
                  <Navigation className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white animate-pulse" />
                ) : (
                  <NavigationOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
                )}
                <span>現在地: {isLocationEnabled ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            {isAddMode && (
              <div className="bg-emerald-600 text-white px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl shadow-lg text-[11px] sm:text-xs font-bold flex items-center gap-1.5 animate-pulse border border-emerald-400 select-none">
                <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>地図をタップしてピン設置</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Top Center: Route Selection Active Banner & 現在地からの距離・走行時間HUD
          詳細カードが開いている時は、重なりを自動回避するため上部左寄りの安全エリアへ移動 */}
      {(isRouteSelectMode || selectedSpotsInOrder.length > 0 || !!selectedSpotId) && (() => {
        const activeSpot = selectedSpotsInOrder[0] || (selectedSpotId ? spots.find((s) => s.id === selectedSpotId) : null);
        const activeRoute = activeSpot ? routesInfo[activeSpot.id] : null;
        const hasRouteInfo = activeRoute && activeRoute.status === 'success' && activeRoute.distanceKm > 0;

        return (
          <div
            id="map-top-center-banner"
            className={`absolute z-[650] bg-slate-950 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.85)] border-2 border-sky-400 flex items-center gap-2 sm:gap-2.5 text-[11px] sm:text-xs font-bold animate-in fade-in transition-all duration-300 ease-in-out select-none ${
              isDetailModalOpen
                ? 'top-3 sm:top-3.5 left-2 sm:left-4 translate-x-0 max-w-[clamp(280px,calc(50vw-2rem),480px)]'
                : 'top-14 md:top-4 left-1/2 -translate-x-1/2 max-w-[96vw] sm:max-w-[85vw]'
            }`}
          >
            {/* Live indicator dot */}
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500"></span>
            </span>

            {selectedSpotsInOrder.length >= 2 ? (
              /* 複数ピン巡回ルート */
              <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] sm:text-[11px] font-black tracking-wide flex-shrink-0 shadow-xs">
                  巡回 {selectedSpotsInOrder.length}箇所
                </span>
                <span className="text-white font-black text-xs sm:text-sm tracking-tight flex-shrink-0 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-700">
                  🚗 {multiSpotRoute ? formatDistanceJapanese(multiSpotRoute.totalDistanceKm) : '計算中'}
                </span>
                <span className="text-sky-300 font-black bg-sky-950 px-2 py-0.5 rounded-md border border-sky-500/50 text-[10px] sm:text-[11px] flex-shrink-0">
                  下道 約{multiSpotRoute ? formatDurationJapanese(multiSpotRoute.totalDurationMinutes) : '...'}
                </span>
                {hasRouteInfo && (
                  <span className="hidden md:inline-flex text-[10px] text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                    現在地➔1: {formatDistanceJapanese(activeRoute.distanceKm)}
                  </span>
                )}
              </div>
            ) : activeSpot ? (
              /* 単一ピン選択時のルート詳細 */
              hasRouteInfo ? (
                <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                  <span className="px-2 py-0.5 rounded-full bg-sky-600 text-white text-[10px] sm:text-[11px] font-black tracking-wide flex-shrink-0 shadow-xs">
                    現在地 ➔ 目的地
                  </span>
                  <span className="truncate max-w-[90px] sm:max-w-[160px] text-slate-100 font-bold">
                    {activeSpot.title}
                  </span>
                  <span className="text-white font-black text-xs sm:text-sm tracking-tight flex-shrink-0 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-700">
                    🚗 {formatDistanceJapanese(activeRoute.distanceKm)}
                  </span>
                  <span className="text-sky-300 font-black bg-sky-950 px-2 py-0.5 rounded-md border border-sky-500/50 text-[10px] sm:text-[11px] flex-shrink-0">
                    下道 約{formatDurationJapanese(activeRoute.durationMinutes)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                  <span className="px-2 py-0.5 rounded-full bg-violet-600 text-white text-[10px] sm:text-[11px] font-black tracking-wide flex-shrink-0 shadow-xs">
                    📍 選択中
                  </span>
                  <span className="truncate max-w-[100px] sm:max-w-[180px] text-slate-100 font-bold">
                    {activeSpot.title}
                  </span>
                  {!isLocationEnabled ? (
                    <button
                      type="button"
                      onClick={onToggleLocationEnabled}
                      className="text-sky-300 hover:text-white underline text-[10px] sm:text-[11px] font-bold cursor-pointer flex-shrink-0"
                    >
                      現在地ONで下道計算
                    </button>
                  ) : isLocating ? (
                    <span className="text-slate-300 text-[10px] flex-shrink-0">現在地取得中...</span>
                  ) : (
                    <span className="text-slate-300 text-[10px] flex-shrink-0">下道ルート計算中...</span>
                  )}
                </div>
              )
            ) : (
              /* ルート複数選択モードON（ピン未選択状態） */
              <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] sm:text-[11px] font-black tracking-wide flex-shrink-0 shadow-xs">
                  📍 ルート複数選択: ON
                </span>
                <span className="truncate text-slate-200 text-[11px] sm:text-xs font-semibold hidden sm:inline">
                  続けてピンをタップして追加可能
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                if (onClearSelection) {
                  onClearSelection();
                } else {
                  onClearSelectedSpots();
                }
                if (isRouteSelectMode) {
                  setIsRouteSelectMode(false);
                }
              }}
              className="ml-auto px-2.5 py-1 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-full text-[10px] sm:text-xs font-extrabold cursor-pointer transition-colors shadow-sm flex items-center gap-1 flex-shrink-0"
              title="選択ピンをすべて解除"
            >
              <X className="w-3 h-3" />
              <span>全解除</span>
            </button>
          </div>
        );
      })()}

      {/* Bottom Right Controls: Zoom Buttons */}
      <div className="absolute bottom-4 right-4 z-[500] flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => mapInstanceRef.current?.zoomIn()}
          className="p-2.5 bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-slate-200/90 text-slate-700 hover:text-violet-600 hover:bg-slate-50 transition-all cursor-pointer"
          title="ズームイン"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => mapInstanceRef.current?.zoomOut()}
          className="p-2.5 bg-white/95 backdrop-blur-md rounded-xl shadow-md border border-slate-200/90 text-slate-700 hover:text-violet-600 hover:bg-slate-50 transition-all cursor-pointer"
          title="ズームアウト"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      {/* Mobile Screen 4: 複数ピン最短ルート */}
      {selectedSpotsInOrder.length >= 2 && showRouteDrawer && (
        <div className="sm:hidden absolute bottom-[max(3.8rem,calc(env(safe-area-inset-bottom)+3.4rem))] left-2.5 right-2.5 z-[700] bg-slate-950/98 backdrop-blur-xl rounded-2xl border border-slate-800 text-white p-3.5 shadow-2xl flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white tracking-wide">
              選択したスポット ({selectedSpotsInOrder.length}件)
            </h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOptimizeOrder}
                className="px-2.5 py-1 rounded-lg border border-blue-500/80 bg-blue-500/10 text-blue-400 font-bold text-[11px] flex items-center gap-1 active:bg-blue-950/50 cursor-pointer"
                title="訪問順序を最短距離に最適化"
              >
                <span>⇄</span>
                <span>順番を最適化</span>
              </button>
              <button
                type="button"
                onClick={() => setShowRouteDrawer(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white bg-slate-900 border border-slate-800 cursor-pointer"
                title="閉じる"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Itinerary List */}
          <div className="space-y-1.5 max-h-36 overflow-y-auto no-scrollbar py-0.5">
            {/* Start: 現在地 */}
            <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-2 truncate">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                  S
                </span>
                <span className="truncate text-slate-200 font-medium">現在地</span>
              </div>
              {selectedSpotsInOrder.length > 0 && routesInfo[selectedSpotsInOrder[0].id]?.status === 'success' && (
                <div className="flex items-center gap-1.5 text-right flex-shrink-0">
                  <span className="text-white font-black text-[11px]">
                    1ピン目へ {formatDistanceJapanese(routesInfo[selectedSpotsInOrder[0].id].distanceKm)}
                  </span>
                  <span className="text-sky-300 font-extrabold text-[10px] bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-500/30">
                    下道 約{formatDurationJapanese(routesInfo[selectedSpotsInOrder[0].id].durationMinutes)}
                  </span>
                </div>
              )}
            </div>

            {/* Waypoints */}
            {selectedSpotsInOrder.map((spot, idx) => {
              const isLast = idx === selectedSpotsInOrder.length - 1;
              const leg = multiSpotRoute?.legs?.[idx];
              const dist = leg
                ? formatDistanceJapanese(leg.distanceKm)
                : (routesInfo[spot.id]?.status === 'success' ? formatDistanceJapanese(routesInfo[spot.id].distanceKm) : '');
              return (
                <div key={spot.id} className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div className="flex items-center gap-2 truncate">
                    <span className={`w-5 h-5 rounded-full ${isLast ? 'bg-red-600' : 'bg-slate-700'} text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0`}>
                      {isLast ? 'G' : idx + 1}
                    </span>
                    <span className="truncate text-white font-medium">{spot.title}</span>
                  </div>
                  {dist && (
                    <span className="text-slate-400 font-semibold text-[11px] ml-2 flex-shrink-0">
                      {dist}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Stats Summary (総距離 / 走行時間 / ルート種別) */}
          {multiSpotRoute && (
            <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-slate-900/90 rounded-xl border border-slate-800 text-center">
              <div>
                <div className="text-[10px] text-slate-400 font-medium">総距離</div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {multiSpotRoute.totalDistanceKm}km
                </div>
              </div>
              <div className="border-x border-slate-800">
                <div className="text-[10px] text-slate-400 font-medium">走行時間</div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {formatDurationJapanese(multiSpotRoute.totalDurationMinutes)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-medium">ルート種別</div>
                <div className="text-[11px] font-bold text-cyan-400 mt-0.5">
                  下道 <span className="text-[9px] font-normal text-cyan-300">(最速ルート)</span>
                </div>
              </div>
            </div>
          )}

          {/* Full-width Red Button: このルートでナビを開始 */}
          <a
            href={getGoogleMapsMultiSpotNavUrl(selectedSpotsInOrder)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-900/40 flex items-center justify-center gap-1.5 cursor-pointer text-center"
          >
            <Navigation className="w-3.5 h-3.5 fill-current" />
            <span>このルートでナビを開始</span>
          </a>
        </div>
      )}

      {/* Floating Panel (Bottom-Left): PC版 複数選択ピンの下道ルート計算カード
          詳細カード（右側）が開いている時は重なりを防ぐため幅と高さを自動調整し、画面サイズ・マップ領域に合わせてレスポンシブに伸縮 */}
      {selectedSpotsInOrder.length > 0 && showRouteDrawer && (
        <div
          id="map-route-floating-panel"
          className={`hidden sm:flex absolute bottom-4 left-4 z-[700] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden animate-in slide-in-from-bottom duration-300 flex-col transition-all ease-in-out ${
            isDetailModalOpen
              ? 'w-[clamp(260px,calc(48%-1rem),410px)] max-h-[min(65vh,calc(100vh-140px))]'
              : 'w-[clamp(280px,calc(56%-1rem),460px)] max-h-[min(74vh,calc(100vh-120px))]'
          }`}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <RouteIcon className="w-4 h-4 text-emerald-300 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="font-extrabold text-xs truncate">
                      {selectedSpotsInOrder.length >= 2
                        ? `下道ルート案内 (${selectedSpotsInOrder.length}箇所巡回)`
                        : `選択中スポット (1箇所)`}
                    </h4>
                    <span className="text-[9px] px-1.5 py-0.5 bg-emerald-700/80 text-emerald-100 rounded-full font-bold border border-emerald-500/50">
                      高速・有料不使用 / 最短距離
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* 詳細カード 表示／非表示切り替え */}
                <button
                  type="button"
                  onClick={() => {
                    if (isDetailModalOpen) {
                      if (onCloseDetailModal) onCloseDetailModal();
                    } else {
                      const targetId = selectedSpotId || selectedSpotsInOrder[0]?.id;
                      if (targetId) {
                        onSelectSpot(targetId);
                        if (onOpenDetailModal) onOpenDetailModal(targetId);
                      }
                    }
                  }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    isDetailModalOpen
                      ? 'bg-emerald-400 text-slate-950 font-black shadow-xs'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                  title={isDetailModalOpen ? '詳細カードを非表示にする' : 'ピンの詳細カードを表示する'}
                >
                  <FileText className="w-3 h-3" />
                  <span>{isDetailModalOpen ? '詳細非表示' : '詳細'}</span>
                </button>

                {selectedSpotsInOrder.length >= 2 && (
                  <button
                    type="button"
                    onClick={handleFitMultiRoute}
                    className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                    title="ルート全体を地図に収める"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>全体</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowRouteDrawer(false)}
                  className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="最小化"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Total distance & duration and Main "ここへ行く" button */}
            {selectedSpotsInOrder.length >= 2 ? (
              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-emerald-500/40 flex items-center justify-between gap-2 shadow-inner">
                <div className="min-w-0">
                  <div className="text-[10px] text-emerald-300 font-extrabold flex items-center gap-1">
                    <span>全行程 合計</span>
                    <span className="text-[9px] text-slate-300 font-normal">(高速・有料道路なし)</span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                    <span className="text-base font-black text-white">
                      最短 {multiSpotRoute ? formatDistanceJapanese(multiSpotRoute.totalDistanceKm) : '計算中...'}
                    </span>
                    <span className="text-xs font-extrabold text-emerald-300">
                      約{multiSpotRoute ? formatDurationJapanese(multiSpotRoute.totalDurationMinutes) : '...'}
                    </span>
                  </div>
                </div>

                {/* 全ルート下道ナビ「ここへ行く」ボタン */}
                <a
                  href={getGoogleMapsMultiSpotNavUrl(selectedSpotsInOrder)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 hover:from-emerald-300 hover:to-teal-200 active:scale-95 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/30 transition-all cursor-pointer whitespace-nowrap flex-shrink-0"
                  title="Googleマップで全経由地の下道ナビを開始（高速・有料道路回避）"
                >
                  <Navigation className="w-4 h-4 text-slate-950" />
                  <span>ここへ行く ↗</span>
                </a>
              </div>
            ) : (
              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-emerald-500/40 flex items-center justify-between gap-2">
                <div className="text-[11px] text-emerald-200">
                  ピンを追加して巡回ルートを作成できます
                </div>
                <button
                  type="button"
                  onClick={() => setIsRouteSelectMode(true)}
                  className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors"
                >
                  ＋ ピンを追加
                </button>
              </div>
            )}
          </div>

          {/* Spot List & Legs in Route */}
          <div className="p-3 overflow-y-auto flex-1 min-h-0 max-h-[min(38vh,calc(100vh-320px))] space-y-1.5">
            {selectedSpotsInOrder.map((spot, index) => {
              const isCurrent = spot.id === selectedSpotId;
              const leg = multiSpotRoute?.legs?.find((l) => l.fromSpotId === spot.id);
              const routeFromUser = routesInfo[spot.id];
              const prevSpot = index > 0 ? selectedSpotsInOrder[index - 1] : null;
              // Google Maps navigation url for this specific spot:
              const singleSpotNavUrl = getGoogleMapsLocalRoadUrl(
                userLocation || (prevSpot ? { lat: prevSpot.lat, lng: prevSpot.lng } : null),
                spot
              );

              return (
                <div key={spot.id} className="space-y-1">
                  <div
                    className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                      isCurrent
                        ? 'bg-violet-50/90 border-violet-400 ring-2 ring-violet-200 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="w-5 h-5 rounded-full bg-violet-700 text-white flex items-center justify-center text-[10px] font-black flex-shrink-0 shadow-xs">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectSpot(spot.id, { keepMultiSelect: true });
                            const map = mapInstanceRef.current;
                            if (map) {
                              map.panTo([spot.lat, spot.lng], { animate: true, duration: 0.5 });
                            }
                          }}
                          className="font-extrabold text-xs text-slate-900 hover:text-violet-700 truncate text-left block w-full cursor-pointer"
                          title="地図上でこのピンにズーム"
                        >
                          {spot.title}
                        </button>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                          {spot.prefecture && <span>{spot.prefecture}</span>}
                          {isLocationEnabled && userLocation && routeFromUser && routeFromUser.status === 'success' && (
                            <span className="text-violet-700 font-semibold">
                              (現在地から {formatDistanceJapanese(routeFromUser.distanceKm)})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* 個別スポット「ここへ行く」ボタン */}
                      <a
                        href={singleSpotNavUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                        title={`Googleマップで「${spot.title}」への下道ナビを開始`}
                      >
                        <Navigation className="w-3 h-3" />
                        <span>ここへ行く ↗</span>
                      </a>

                      {/* 順番移動 */}
                      {selectedSpotsInOrder.length > 1 && (
                        <div className="flex items-center">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveSpotOrder(index, 'up')}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 disabled:hover:text-slate-400 cursor-pointer"
                            title="上へ移動"
                          >
                            <MoveUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={index === selectedSpotsInOrder.length - 1}
                            onClick={() => handleMoveSpotOrder(index, 'down')}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 disabled:hover:text-slate-400 cursor-pointer"
                            title="下へ移動"
                          >
                            <MoveDown className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {/* 詳細ボタン (表示／非表示切り替え) */}
                      <button
                        type="button"
                        onClick={() => {
                          const isThisSpotOpen = isDetailModalOpen && spot.id === selectedSpotId;
                          if (isThisSpotOpen) {
                            if (onCloseDetailModal) {
                              onCloseDetailModal();
                            }
                          } else {
                            onSelectSpot(spot.id, { keepMultiSelect: true });
                            if (onOpenDetailModal) {
                              onOpenDetailModal(spot.id);
                            }
                          }
                        }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs whitespace-nowrap ${
                          isDetailModalOpen && spot.id === selectedSpotId
                            ? 'bg-violet-600 text-white shadow-violet-500/20'
                            : 'bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200'
                        }`}
                        title={isDetailModalOpen && spot.id === selectedSpotId ? '詳細カードを非表示にする' : '詳細カードを表示する'}
                      >
                        <FileText className="w-3 h-3" />
                        <span>{isDetailModalOpen && spot.id === selectedSpotId ? '詳細閉じる' : '詳細'}</span>
                      </button>

                      {/* ルートから外す */}
                      <button
                        type="button"
                        onClick={() => onToggleSelectSpot(spot.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="ルートから外す"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Leg distance & duration between spots */}
                  {leg && (
                    <div className="mx-2 my-1 px-3 py-1 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/90 rounded-xl flex items-center justify-between text-[11px] font-bold text-emerald-950 shadow-2xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] font-black flex-shrink-0">
                          {index + 1}
                        </span>
                        <span className="text-emerald-900 font-bold text-xs truncate">
                          区間 {index + 1}:
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-black text-emerald-950 flex-shrink-0">
                        <span>下道 {formatDistanceJapanese(leg.distanceKm)}</span>
                        <span className="text-emerald-700 font-bold text-[11px]">(約{formatDurationJapanese(leg.durationMinutes)})</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setIsRouteSelectMode(!isRouteSelectMode)}
              className={`text-xs font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                isRouteSelectMode
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isRouteSelectMode ? 'ピン追加中 (完了)' : 'ピンを追加'}</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-medium">
                {selectedSpotsInOrder.length}箇所選択中
              </span>
              <button
                type="button"
                onClick={onClearSelectedSpots}
                className="text-xs text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
              >
                すべて解除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toggle if route panel is closed but items are selected */}
      {selectedSpotsInOrder.length > 0 && !showRouteDrawer && (
        <div className="absolute bottom-16 sm:bottom-4 left-3 sm:left-4 z-[700] flex items-center gap-2 flex-wrap max-w-[calc(100vw-1.5rem)]">
          <button
            type="button"
            onClick={() => setShowRouteDrawer(true)}
            className="bg-emerald-900 hover:bg-emerald-800 text-white px-3.5 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold cursor-pointer transition-colors border border-emerald-600/60"
          >
            <RouteIcon className="w-4 h-4 text-emerald-300" />
            <span>
              {selectedSpotsInOrder.length >= 2
                ? `下道ルート (${selectedSpotsInOrder.length}箇所: ${multiSpotRoute ? formatDistanceJapanese(multiSpotRoute.totalDistanceKm) : '計算中'} / 約${multiSpotRoute ? formatDurationJapanese(multiSpotRoute.totalDurationMinutes) : '...'})`
                : `下道ルート案内 (${selectedSpotsInOrder.length}件)`}
            </span>
          </button>
          {selectedSpotsInOrder.length >= 2 && (
            <a
              href={getGoogleMapsMultiSpotNavUrl(selectedSpotsInOrder)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 rounded-xl shadow-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap"
              title="Googleマップで全経由地の下道ナビを開始"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>ここへ行く ↗</span>
            </a>
          )}
        </div>
      )}

      {/* 47都道府県一覧・選択モーダル */}
      {showPrefectureModal && (
        <div
          className="fixed inset-0 z-[800] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowPrefectureModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-slate-100 animate-in fade-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-violet-600" />
                <h3 className="font-extrabold text-base text-slate-900">47都道府県から選ぶ</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPrefectureModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4">
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => {
                    onSelectPrefecture('all');
                    fitToJapanBounds(true);
                    setShowPrefectureModal(false);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    selectedPrefecture === 'all'
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  日本全国を表示 (すべて)
                </button>
              </div>

              {Object.entries(JAPAN_REGIONS_WITH_PREFECTURES).map(([region, prefs]) => (
                <div key={region} className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{region}</h4>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
                    {prefs.map((pref) => {
                      const count = countsMap[pref] || 0;
                      const isSelected = selectedPrefecture === pref;

                      return (
                        <button
                          key={pref}
                          type="button"
                          onClick={() => {
                            onSelectPrefecture(pref);
                            setShowPrefectureModal(false);
                          }}
                          className={`p-2 rounded-xl text-xs font-bold border transition-all text-left flex flex-col justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                              : count > 0
                              ? 'bg-violet-50 hover:bg-violet-100 text-violet-900 border-violet-200'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span className="truncate">{pref}</span>
                          <span
                            className={`text-[10px] mt-1 self-end font-extrabold ${
                              isSelected
                                ? 'text-violet-200'
                                : count > 0
                                ? 'text-violet-700'
                                : 'text-slate-400'
                            }`}
                          >
                            {count}件
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};