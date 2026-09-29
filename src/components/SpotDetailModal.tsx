import React, { useState, useEffect } from 'react';
import { Spot, CustomCategory, UserLocation, SpotRouteInfo, CustomList } from '../types';
import { getCategoryDisplay, INITIAL_CATEGORIES } from '../data/sampleSpots';
import { formatDistanceJapanese, formatDurationJapanese, getGoogleMapsLocalRoadUrl } from '../utils/routeUtils';
import {
  X,
  MapPin,
  Star,
  ExternalLink,
  Edit3,
  Trash2,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Image as ImageIcon,
  Plus,
  Navigation,
  Compass,
  Car,
  Bookmark,
  Ghost,
  Route as RouteIcon,
} from 'lucide-react';
import { PhotoLightbox } from './PhotoLightbox';

interface SpotDetailModalProps {
  spot: Spot | null;
  isOpen: boolean;
  categories?: CustomCategory[];
  userLocation?: UserLocation | null;
  isLocationEnabled?: boolean;
  routeInfo?: SpotRouteInfo | null;
  onClose: () => void;
  onEdit: (spot: Spot) => void;
  onDelete: (spotId: string) => void;
  onAddMorePhotos?: (spot: Spot) => void;
  onFilterByPrefecture?: (pref: string) => void;
  onToggleSelectForRoute?: (spotId: string) => void;
  isSelectedForRoute?: boolean;
  onToggleWantToGo?: (spotId: string) => void;
  onToggleHaunted?: (spotId: string) => void;
  customLists?: CustomList[];
  onOpenListManager?: (spotId: string) => void;
  onToggleLocationEnabled?: () => void;
}

export const SpotDetailModal: React.FC<SpotDetailModalProps> = ({
  spot,
  isOpen,
  categories = INITIAL_CATEGORIES,
  userLocation,
  isLocationEnabled = true,
  routeInfo,
  onClose,
  onEdit,
  onDelete,
  onAddMorePhotos,
  onFilterByPrefecture,
  onToggleSelectForRoute,
  isSelectedForRoute = false,
  onToggleWantToGo,
  onToggleHaunted,
  customLists = [],
  onOpenListManager,
  onToggleLocationEnabled,
}) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // 上のバー（ヘッダー・即ピン設置バー・マップ内コマンド等）にかぶらないよう動的に最大高さを算出
  const [maxAvailableHeight, setMaxAvailableHeight] = useState<number>(480);

  useEffect(() => {
    if (!isOpen) return;

    const calculateMaxHeight = () => {
      // 画面上部に存在するすべてのバー・コマンド要素を検索
      const headerEl = document.querySelector('header');
      const quickPinEl = document.getElementById('quick-pin-bar-container');
      const mobileFilterEl = document.getElementById('mobile-filter-bar');
      const mapTopRightEl = document.getElementById('map-top-right-controls');
      const mapTopCenterEl = document.getElementById('map-top-center-banner');
      const mapTopLeftEl = document.getElementById('map-top-left-controls');
      const routeToggleEl = document.getElementById('map-route-multiselect-toggle-btn');
      const locToggleEl = document.getElementById('map-location-toggle-btn');

      const candidateElements = [
        headerEl,
        quickPinEl,
        mobileFilterEl,
        mapTopRightEl,
        mapTopCenterEl,
        mapTopLeftEl,
        routeToggleEl,
        locToggleEl,
      ];

      let maxObstacleBottom = 0;
      for (const el of candidateElements) {
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.height > 0 && rect.bottom > maxObstacleBottom) {
            maxObstacleBottom = rect.bottom;
          }
        }
      }

      const isMobile = window.innerWidth < 640;
      // 要素が未取得の場合の安全マージンフォールバック
      if (maxObstacleBottom <= 0) {
        maxObstacleBottom = isMobile ? 168 : 156;
      }

      // 上部バーやコマンドとの間の安全マージン（12px）
      const topClearance = 12;
      const minAllowedTop = maxObstacleBottom + topClearance;

      // 下部余白（モバイルは下部ナビ+余白で約76px、PCは下部16px+余白で約24px）
      const bottomSpace = isMobile ? 76 : 24;

      const vh = window.innerHeight;
      // 上のバー・コマンドの下端〜下部マージンまでの有効高さ
      const available = vh - minAllowedTop - bottomSpace;

      // 最小160px〜利用可能高さの範囲で自動設定
      const calculated = Math.max(160, Math.floor(available));
      setMaxAvailableHeight(calculated);
    };

    calculateMaxHeight();

    // ResizeObserverで画面やバーのサイズ変化を常に監視
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => calculateMaxHeight());
      const elementsToWatch = [
        document.body,
        document.querySelector('header'),
        document.getElementById('quick-pin-bar-container'),
        document.getElementById('mobile-filter-bar'),
        document.getElementById('map-top-right-controls'),
        document.getElementById('map-top-center-banner'),
      ];
      elementsToWatch.forEach((el) => {
        if (el) resizeObserver?.observe(el);
      });
    }

    window.addEventListener('resize', calculateMaxHeight);
    window.addEventListener('scroll', calculateMaxHeight, { passive: true });

    return () => {
      window.removeEventListener('resize', calculateMaxHeight);
      window.removeEventListener('scroll', calculateMaxHeight);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [isOpen]);

  if (!isOpen || !spot) return null;

  const photos = spot.photos && spot.photos.length > 0 ? spot.photos : [];
  const currentPhoto = photos[activePhotoIndex] || photos[0];
  const categoryInfo = getCategoryDisplay(spot.category, categories);

  const handleCopyCoordinates = () => {
    navigator.clipboard.writeText(`${spot.lat},${spot.lng}`);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  const googleMapsUrl = spot.googleMapsUrl && spot.googleMapsUrl.startsWith('http')
    ? spot.googleMapsUrl
    : `https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lng}`;

  const localRoadNavUrl = getGoogleMapsLocalRoadUrl(
    userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null,
    { lat: spot.lat, lng: spot.lng, title: spot.title }
  );

  return (
    <>
      <div
        id={isExpanded ? 'spot-detail-modal-backdrop' : 'spot-detail-docked-panel'}
        className={
          isExpanded
            ? 'fixed inset-0 z-[1200] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200'
            : 'fixed bottom-16 sm:bottom-4 left-3 right-3 sm:left-auto sm:right-6 z-[1200] w-auto sm:w-full sm:max-w-lg md:max-w-xl max-w-[95vw] pointer-events-none flex flex-col justify-end p-0 animate-in slide-in-from-bottom-4 duration-200'
        }
        onClick={(e) => {
          if (isExpanded && e.target === e.currentTarget) onClose();
        }}
      >
        <div
          id="spot-detail-modal-content"
          style={{
            maxHeight: isExpanded ? 'calc(90vh - 40px)' : `${maxAvailableHeight}px`,
          }}
          className={
            isExpanded
              ? 'bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in duration-200 border border-slate-100'
              : 'pointer-events-auto bg-white w-full rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col text-slate-800 ring-1 ring-black/5 transition-all duration-150'
          }
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-white flex-shrink-0">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              {Array.from(new Set(spot.categories && spot.categories.length > 0 ? spot.categories : [spot.category]))
                .map((catId) => getCategoryDisplay(catId, categories))
                .filter((cInfo) => cInfo && cInfo.label && cInfo.label !== 'カスタム' && cInfo.id !== 'custom')
                .map((cInfo, cIdx) => {
                  return (
                    <span
                      key={`${cInfo.id || 'cat'}_${cIdx}`}
                      className="px-2.5 py-0.5 text-xs font-bold rounded-full border flex items-center gap-1 text-white shadow-2xs"
                      style={{ backgroundColor: cInfo.color, borderColor: cInfo.color }}
                    >
                      <span>{cInfo.icon}</span>
                      <span>{cInfo.label}</span>
                    </span>
                  );
                })}
              {spot.prefecture && (
                <button
                  onClick={() => {
                    if (onFilterByPrefecture) {
                      onFilterByPrefecture(spot.prefecture!);
                      onClose();
                    }
                  }}
                  title={`「${spot.prefecture}」のスポットのみ表示`}
                  className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-violet-100 text-slate-700 hover:text-violet-700 transition-colors cursor-pointer flex items-center gap-1 border border-slate-200 hover:border-violet-300"
                >
                  <span>🗾 {spot.prefecture}</span>
                  <span className="text-[10px] text-slate-400 hover:text-violet-500">のみ表示</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Want-to-go quick toggle */}
              {onToggleWantToGo && (
                <button
                  onClick={() => onToggleWantToGo(spot.id)}
                  className={`px-2 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                    spot.isWantToGo
                      ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs'
                      : 'bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800'
                  }`}
                  title={spot.isWantToGo ? '「行きたい場所」から解除' : '「行きたい場所」に追加'}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${spot.isWantToGo ? 'fill-amber-500 text-amber-500' : ''}`} />
                  <span>{spot.isWantToGo ? '行きたい' : '+行きたい'}</span>
                </button>
              )}

              {/* Haunted list quick toggle */}
              {onToggleHaunted && (
                <button
                  onClick={() => onToggleHaunted(spot.id)}
                  className={`px-2 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                    (spot.isHaunted ?? (spot.category === 'haunted'))
                      ? 'bg-violet-100 text-violet-900 border border-violet-300 shadow-2xs'
                      : 'bg-slate-100 hover:bg-violet-50 text-slate-700 hover:text-violet-800'
                  }`}
                  title={(spot.isHaunted ?? (spot.category === 'haunted')) ? '「心リスト」から解除' : '「心リスト」に追加'}
                >
                  <Ghost className="w-3.5 h-3.5 text-violet-600" />
                  <span>{(spot.isHaunted ?? (spot.category === 'haunted')) ? '心リスト' : '+心'}</span>
                </button>
              )}

              <button
                id="edit-spot-btn"
                onClick={() => onEdit(spot)}
                className="p-1.5 text-slate-500 hover:text-violet-700 hover:bg-violet-50 rounded-lg transition-colors cursor-pointer"
                title="編集"
              >
                <Edit3 className="w-4 h-4" />
              </button>

              <button
                id="delete-spot-btn"
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title="削除"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <div className="w-px h-4 bg-slate-200 mx-0.5"></div>

              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer hidden sm:flex items-center justify-center"
                title={isExpanded ? 'サイド表示に戻す' : '全画面表示に切り替え'}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <button
                id="close-spot-detail-btn"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="閉じる"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Delete Confirmation Alert */}
          {showDeleteConfirm && (
            <div className="bg-rose-50 border-b border-rose-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
              <div className="text-xs text-rose-800 font-medium">
                「{spot.title}」を削除してもよろしいですか？この操作は取り消せません。
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1 text-xs font-medium text-slate-600 hover:bg-white rounded-lg border border-slate-200 cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => {
                    onDelete(spot.id);
                    onClose();
                  }}
                  className="px-3 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm cursor-pointer"
                >
                  削除する
                </button>
              </div>
            </div>
          )}

          {/* Scrollable Content */}
          <div className={`flex-1 min-h-0 overflow-y-auto ${isExpanded ? 'p-5 space-y-5' : 'p-3.5 space-y-3.5'}`}>
            {/* Title & Rating & Custom Lists */}
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {spot.yomigana && (
                    <span className="text-xs text-violet-600 font-semibold block mb-0.5 tracking-wider">
                      {spot.yomigana}
                    </span>
                  )}
                  <h2 className={`${isExpanded ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'} font-extrabold text-slate-900 leading-snug`}>
                    {spot.title}
                  </h2>
                </div>
                <button
                  id="title-edit-spot-btn"
                  onClick={() => onEdit(spot)}
                  className="flex-shrink-0 px-2.5 py-1 text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-200 flex items-center gap-1 transition-colors cursor-pointer"
                  title="スポット内容を編集"
                >
                  <Edit3 className="w-3 h-3 text-violet-600" />
                  <span>編集</span>
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-500">
                {spot.rating !== undefined && spot.rating !== null && Number(spot.rating) > 0 ? (
                  <div className="flex items-center gap-1.5 text-amber-500 font-semibold mr-2 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <div key={star} className="relative w-3.5 h-3.5 flex items-center justify-center">
                          <Star className="w-3.5 h-3.5 text-slate-200 fill-slate-100" />
                          {Number(spot.rating) >= star ? (
                            <div className="absolute inset-0 overflow-hidden">
                              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            </div>
                          ) : Number(spot.rating) >= star - 0.5 ? (
                            <div className="absolute inset-0 w-1/2 overflow-hidden">
                              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <span className="text-amber-800 font-bold text-xs">{Number(spot.rating).toFixed(1)}</span>
                  </div>
                ) : (
                  <span className="text-slate-400 font-medium text-xs mr-2 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                    未評価
                  </span>
                )}

                {/* Custom Lists Badges */}
                {customLists
                  .filter((cl) => spot.listIds?.includes(cl.id))
                  .map((cl, clIdx) => (
                    <span
                      key={`${cl.id}_${clIdx}`}
                      className="px-2 py-0.5 rounded-md font-bold text-[11px] border flex items-center gap-1"
                      style={{
                        backgroundColor: `${cl.color}15`,
                        borderColor: `${cl.color}40`,
                        color: cl.color,
                      }}
                    >
                      <span>{cl.icon || '⭐'}</span>
                      <span>{cl.name}</span>
                    </span>
                  ))}

                {onOpenListManager && (
                  <button
                    type="button"
                    onClick={() => onOpenListManager(spot.id)}
                    className="px-2 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-1 bg-slate-100 hover:bg-violet-100 text-slate-700 hover:text-violet-700 border border-slate-200 hover:border-violet-300 transition-colors cursor-pointer"
                    title="所属リストの管理・登録"
                  >
                    <span>📋</span>
                    <span>リスト管理</span>
                  </button>
                )}
              </div>
            </div>

            {/* Local Road (下道) Route Status Banner */}
            <div className="bg-gradient-to-r from-violet-50 via-slate-50 to-indigo-50/60 rounded-xl p-3.5 border border-violet-200/90 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-violet-600 text-white flex items-center justify-center font-bold flex-shrink-0 shadow-xs">
                    <Car className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-violet-900 uppercase tracking-wide flex items-center gap-1.5 flex-wrap">
                      <span>現在地からの最短下道ルート</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-bold border border-emerald-300">
                        高速・有料不使用 / 最短距離
                      </span>
                    </div>
                    <div className="text-xs text-slate-700 font-medium mt-0.5">
                      {!isLocationEnabled ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-slate-500 text-xs">現在地機能: OFF</span>
                          {onToggleLocationEnabled && (
                            <button
                              type="button"
                              onClick={onToggleLocationEnabled}
                              className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold cursor-pointer transition-colors shadow-2xs"
                            >
                              ONにする
                            </button>
                          )}
                        </div>
                      ) : !userLocation ? (
                        <span className="text-slate-500 text-xs">現在地を取得中...</span>
                      ) : routeInfo && routeInfo.status === 'success' ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-extrabold text-violet-950">
                            最短 {formatDistanceJapanese(routeInfo.distanceKm)}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-sm font-extrabold text-violet-700">
                            所要時間 約{formatDurationJapanese(routeInfo.durationMinutes)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs">最短下道ルートを計算中...</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {onToggleSelectForRoute && (
                    <button
                      type="button"
                      onClick={() => onToggleSelectForRoute(spot.id)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-2xs whitespace-nowrap ${
                        isSelectedForRoute
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-300'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}
                      title="巡回ルート（複数選択）に追加または解除"
                    >
                      <RouteIcon className="w-3.5 h-3.5" />
                      <span>{isSelectedForRoute ? '✓ ルート巡回中' : '＋ ルートに追加'}</span>
                    </button>
                  )}
                  <a
                    href={localRoadNavUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap"
                    title="Googleマップで高速・有料道路回避の下道ナビを開く"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>ここへ行く ↗</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Photo Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <ImageIcon className="w-4 h-4 text-violet-500" />
                  <span>現地写真 ({photos.length}枚)</span>
                </div>
                {onAddMorePhotos && (
                  <button
                    onClick={() => onAddMorePhotos(spot)}
                    className="text-xs text-violet-600 hover:text-violet-700 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    写真を追加・編集
                  </button>
                )}
              </div>

              {photos.length > 0 ? (
                <div className="space-y-2">
                  {/* Hero Photo Viewer */}
                  <div className={`relative group w-full ${isExpanded ? 'h-56 sm:h-72' : 'h-44 sm:h-48'} rounded-xl overflow-hidden bg-slate-900 shadow-inner`}>
                    <img
                      src={currentPhoto.url}
                      alt={currentPhoto.caption || spot.title}
                      className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-105"
                      onClick={() => setLightboxOpen(true)}
                    />
                    {currentPhoto.caption && (
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-6 text-white text-xs font-medium">
                        {currentPhoto.caption}
                      </div>
                    )}
                    <button
                      onClick={() => setLightboxOpen(true)}
                      className="absolute top-3 right-3 bg-black/50 hover:bg-black/80 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs cursor-pointer"
                      title="拡大表示"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-xs text-white text-[11px] px-2 py-0.5 rounded-md">
                      {activePhotoIndex + 1} / {photos.length}
                    </div>
                  </div>

                  {/* Thumbnail Row if more than 1 photo */}
                  {photos.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1">
                      {photos.map((photo, idx) => (
                        <button
                          key={photo.id ? `${photo.id}_${idx}` : `photo_${idx}`}
                          onClick={() => setActivePhotoIndex(idx)}
                          className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                            idx === activePhotoIndex
                              ? 'border-violet-500 ring-2 ring-violet-200'
                              : 'border-slate-200 opacity-70 hover:opacity-100'
                          }`}
                        >
                          <img src={photo.url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  onClick={() => onAddMorePhotos && onAddMorePhotos(spot)}
                  className="w-full h-28 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-1.5 hover:border-violet-300 hover:text-violet-500 transition-colors cursor-pointer bg-slate-50/50"
                >
                  <ImageIcon className="w-6 h-6" />
                  <span className="text-xs font-medium">写真がまだ添付されていません（クリックで追加）</span>
                </div>
              )}
            </div>

            {/* Reference URLs Section (Up to 5 URLs) */}
            {spot.referenceUrls && spot.referenceUrls.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <ExternalLink className="w-4 h-4 text-violet-600" />
                  <span>参考URL・関連サイト ({spot.referenceUrls.length}件)</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {spot.referenceUrls.map((ref, idx) => (
                    <a
                      key={ref.id ? `${ref.id}_${idx}` : `ref_${idx}`}
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-violet-50/60 hover:border-violet-300 transition-all flex items-center justify-between group shadow-2xs"
                    >
                      <div className="flex items-center gap-2 overflow-hidden mr-2">
                        <span className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs flex-shrink-0 text-slate-600 group-hover:text-violet-600">
                          🌐
                        </span>
                        <div className="truncate">
                          <div className="text-xs font-bold text-slate-800 group-hover:text-violet-700 truncate">
                            {ref.title || ref.url}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {ref.url}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-violet-600 group-hover:text-violet-800 flex items-center gap-0.5 flex-shrink-0 bg-white px-2 py-1 rounded-lg border border-slate-200 group-hover:border-violet-200">
                        <span>サイトへ移動</span>
                        <ExternalLink className="w-3 h-3" />
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Rumors (噂されている現象) */}
            {spot.rumors && (
              <div className="bg-purple-950/20 rounded-xl p-4 border border-purple-900/40">
                <div className="text-xs font-bold text-purple-400 mb-1.5 flex items-center gap-1.5">
                  <span>👻</span>
                  <span>噂されている怪奇現象・目撃談</span>
                </div>
                <p className="text-sm text-purple-200 whitespace-pre-wrap leading-relaxed">
                  {spot.rumors}
                </p>
              </div>
            )}

            {/* Notes / Impressions */}
            {spot.notes && (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="text-xs font-bold text-slate-500 mb-1.5">概要・逸話・メモ</div>
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {spot.notes}
                </p>
              </div>
            )}

            {/* SNS Links (Instagram, TikTok, YouTube) */}
            {(spot.instagramUrl || spot.tiktokUrl || spot.youtubeUrl) && (
              <div className="space-y-2 pt-2">
                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span>📱</span>
                  <span>SNS・動画リンク</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {spot.instagramUrl && (
                    <a
                      href={spot.instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm hover:opacity-90"
                    >
                      <span>📸 Instagram</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {spot.tiktokUrl && (
                    <a
                      href={spot.tiktokUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-slate-800"
                    >
                      <span>🎵 TikTok</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {spot.youtubeUrl && (
                    <a
                      href={spot.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-red-700"
                    >
                      <span>▶️ YouTube</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Location & Coordinates */}
            <div className="space-y-2 text-xs">
              {spot.address && (
                <div className="flex items-start gap-2 text-slate-600">
                  <MapPin className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
                  <span className="font-medium text-slate-700">{spot.address}</span>
                </div>
              )}

              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-slate-500">
                <span className="font-mono">
                  緯度経度: {spot.lat.toFixed(5)}, {spot.lng.toFixed(5)}
                </span>
                <button
                  onClick={handleCopyCoordinates}
                  className="flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium px-2 py-0.5 rounded hover:bg-slate-200 transition-colors cursor-pointer"
                  title="座標をコピー"
                >
                  {copiedCoords ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600">コピー完了</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>コピー</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="p-3 sm:p-3.5 border-t border-slate-100 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto flex-wrap">
              <button
                id="footer-edit-spot-btn"
                onClick={() => onEdit(spot)}
                className="flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 sm:py-2 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                title="スポット内容（タイトル、カテゴリ、メモ、写真、URL）を編集"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>内容を編集</span>
              </button>
              <a
                id="open-google-maps-btn"
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 sm:py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                <span>Googleマップで開く</span>
              </a>
              <a
                id="get-directions-btn"
                href={localRoadNavUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-initial px-3 sm:px-4 py-1.5 sm:py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold rounded-xl border border-violet-200 shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Car className="w-3.5 h-3.5 text-violet-600" />
                <span>下道ルート案内</span>
              </a>
            </div>

            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-1.5 sm:py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Photo Lightbox */}
      <PhotoLightbox
        photos={photos}
        currentIndex={activePhotoIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={(idx) => setActivePhotoIndex(idx)}
        spotTitle={spot.title}
      />
    </>
  );
};
