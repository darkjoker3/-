import React, { useState } from 'react';
import { Spot, UserLocation, SpotRouteInfo, CustomCategory } from '../types';
import { getSpotAllCategories, getSpotMainCategory } from '../data/categoryConfig';
import { calculateDistanceKm } from '../utils/geoUtils';
import { formatDistanceJapanese, formatDurationJapanese, getGoogleMapsLocalRoadUrl } from '../utils/routeUtils';
import {
  MapPin,
  X,
  Navigation,
  Star,
  CheckCircle2,
  Circle,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface MobileSpotBottomSheetProps {
  spot: Spot | null;
  userLocation: UserLocation | null;
  routeInfo?: SpotRouteInfo;
  isMultiSelected?: boolean;
  onClose: () => void;
  onOpenDetail: (spotId: string) => void;
  onStartRoute: (spot: Spot) => void;
  onToggleMultiSelect: (spotId: string) => void;
  onToggleVisited?: (spotId: string) => void;
  categories?: CustomCategory[];
}

export const MobileSpotBottomSheet: React.FC<MobileSpotBottomSheetProps> = ({
  spot,
  userLocation,
  routeInfo,
  isMultiSelected = false,
  onClose,
  onOpenDetail,
  onStartRoute,
  onToggleMultiSelect,
  onToggleVisited,
  categories,
}) => {
  const [startY, setStartY] = useState<number | null>(null);
  const [currentTranslateY, setCurrentTranslateY] = useState(0);

  if (!spot) return null;

  const allCategories = getSpotAllCategories(spot, categories);
  const mainCat = getSpotMainCategory(spot, categories);
  const photos = spot.photos || [];
  const coverPhoto = photos.find((p) => p.isCover) || photos[0];
  const hasCoverPhoto = Boolean(coverPhoto && coverPhoto.url && coverPhoto.url.trim() !== '');
  const danger = Math.round(spot.dangerLevel ?? spot.rating ?? 0);

  // 現在地からの距離
  let distanceKm: number | null = null;
  if (routeInfo && routeInfo.status === 'success') {
    distanceKm = routeInfo.distanceKm;
  } else if (userLocation) {
    distanceKm = calculateDistanceKm(userLocation.lat, userLocation.lng, spot.lat, spot.lng);
  }

  const isRouteActive = Boolean(routeInfo && routeInfo.status === 'success' && routeInfo.coordinates && routeInfo.coordinates.length > 0);

  // スワイプハンドラ
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY === null) return;
    const diff = e.touches[0].clientY - startY;
    if (diff < 0) {
      setCurrentTranslateY(Math.max(diff, -50));
    } else {
      setCurrentTranslateY(Math.min(diff, 120));
    }
  };

  const handleTouchEnd = () => {
    if (currentTranslateY < -35) {
      onOpenDetail(spot.id);
    } else if (currentTranslateY > 50) {
      onClose();
    }
    setStartY(null);
    setCurrentTranslateY(0);
  };

  // Google Maps 下道ナビURL
  const navUrl = getGoogleMapsLocalRoadUrl(userLocation, {
    lat: spot.lat,
    lng: spot.lng,
    title: spot.title,
  });

  return (
    <div
      role="dialog"
      aria-label={`${spot.title}の概要シート`}
      style={{
        transform: `translateY(${currentTranslateY}px)`,
        transition: startY === null ? 'transform 0.2s ease-out' : 'none',
      }}
      className="fixed bottom-[max(3.8rem,calc(env(safe-area-inset-bottom)+3.4rem))] left-2.5 right-2.5 sm:hidden z-[1050] bg-slate-950/98 backdrop-blur-xl text-white rounded-2xl border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200 max-h-[80vh] flex flex-col"
    >
      {/* 閉じるボタン（右上に固定配置し、いかなる場合も押しやすく見切れない） */}
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="absolute top-2.5 right-2.5 z-30 w-8 h-8 rounded-full bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700/80 active:scale-95 shadow-md cursor-pointer transition-transform"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="p-3.5 flex flex-col gap-2.5 overflow-y-auto no-scrollbar">
        {/* 上部スワイプ用バー */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="w-10 h-1 rounded-full bg-slate-700/80 mx-auto -mt-1 mb-0.5 flex-shrink-0 cursor-grab active:cursor-grabbing"
        />

        {/* Top Info Row */}
        <div className="flex items-start gap-3">
          {/* Thumbnail: 確実に80x80pxの正方形枠に収め、縦長・高解像度写真でもカードが突き破られないよう厳格化 */}
          {hasCoverPhoto ? (
            <div
              onClick={() => onOpenDetail(spot.id)}
              className="w-20 h-20 min-w-[80px] min-h-[80px] max-w-[80px] max-h-[80px] rounded-xl overflow-hidden flex-shrink-0 bg-slate-900 border border-slate-800 relative cursor-pointer group shadow-xs"
              style={{ width: '80px', height: '80px', minWidth: '80px', minHeight: '80px', maxWidth: '80px', maxHeight: '80px' }}
            >
              <img
                src={coverPhoto.url}
                alt={spot.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                loading="lazy"
              />
              {photos.length > 1 && (
                <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-xs">
                  +{photos.length}
                </span>
              )}
            </div>
          ) : (
            <div
              onClick={() => onOpenDetail(spot.id)}
              className="w-20 h-20 min-w-[80px] min-h-[80px] max-w-[80px] max-h-[80px] rounded-xl flex-shrink-0 border border-slate-800 flex flex-col items-center justify-center cursor-pointer shadow-xs select-none"
              style={{
                width: '80px',
                height: '80px',
                minWidth: '80px',
                minHeight: '80px',
                maxWidth: '80px',
                maxHeight: '80px',
                backgroundColor: mainCat.color ? `${mainCat.color}25` : '#0f172a',
              }}
            >
              <span className="text-3xl drop-shadow-2xs leading-none">{mainCat.icon || '👻'}</span>
            </div>
          )}

          {/* Details (タイトル, 都道府県 市区町村, ★★★★★, 訪問済み) */}
          <div className="flex-1 min-w-0 pr-7">
            <h3
              onClick={() => onOpenDetail(spot.id)}
              className="text-sm font-bold text-white tracking-tight line-clamp-2 cursor-pointer hover:text-slate-200 leading-snug"
            >
              {spot.title}
            </h3>

            {/* Location (長野県 千曲市) */}
            <div className="text-xs text-slate-400 mt-1 truncate font-medium flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <span className="truncate">{spot.prefecture || ''} {spot.city || spot.address || ''}</span>
            </div>

            {/* Stars & Visit Status (★★★★☆ + 訪問済み) */}
            <div className="flex items-center gap-2 mt-1.5">
              {danger > 0 ? (
                <div className="flex items-center text-amber-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-3.5 h-3.5 ${
                        star <= danger ? 'fill-amber-400 text-amber-400' : 'text-slate-600'
                      }`}
                    />
                  ))}
                </div>
              ) : (
                <span className="text-[11px] text-slate-400 font-medium">未評価</span>
              )}

              {/* 訪問ステータスバッジ */}
              <button
                type="button"
                onClick={() => onToggleVisited && onToggleVisited(spot.id)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                  spot.isVisited
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {spot.isVisited ? '訪問済み' : '未訪問'}
              </button>
            </div>

            {/* Category Badges ([廃墟] [ホテル] [心霊現象]) */}
            {!isRouteActive && (
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {allCategories
                  .filter((cat) => cat && cat.label && cat.label !== 'カスタム' && cat.id !== 'custom')
                  .map((cat) => (
                    <span
                      key={cat.id}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-xs"
                      style={{ backgroundColor: cat.color }}
                    >
                      {cat.label}
                    </span>
                  ))}
                {spot.notes && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                    心霊現象
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 現在地からの距離（ルート未開始時でもGPSオンなら表示） */}
        {!isRouteActive && distanceKm !== null && distanceKm > 0 && (
          <div className="flex items-center justify-between text-xs py-1.5 px-3 bg-slate-900/80 rounded-xl border border-slate-800 text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
              <Navigation className="w-3.5 h-3.5 text-blue-400" />
              <span>現在地からの下道直線目安</span>
            </span>
            <span className="font-bold text-white text-xs">
              約 {formatDistanceJapanese(distanceKm)}
            </span>
          </div>
        )}

        {/* ================= SCREEN 3: ルート結果 統計情報 (下道最短) ================= */}
        {isRouteActive && routeInfo && (
          <div className="grid grid-cols-3 gap-2 py-2 px-3 bg-slate-900/90 rounded-xl border border-slate-800 text-center">
            <div>
              <div className="text-[10px] text-slate-400 font-medium">総距離</div>
              <div className="text-base font-bold text-white mt-0.5">
                {routeInfo.distanceKm}km
              </div>
            </div>
            <div className="border-x border-slate-800">
              <div className="text-[10px] text-slate-400 font-medium">走行時間</div>
              <div className="text-base font-bold text-white mt-0.5">
                {formatDurationJapanese(routeInfo.durationMinutes)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-medium">ルート種別</div>
              <div className="text-xs font-bold text-cyan-400 mt-1">
                下道 <span className="text-[10px] font-normal text-cyan-300">(最速ルート)</span>
              </div>
            </div>
          </div>
        )}

        {/* ================= ACTION BUTTONS (Screen 2 & Screen 3 準拠) ================= */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          {/* 左ボタン: 詳細を見る / ルート詳細 */}
          <button
            type="button"
            onClick={() => onOpenDetail(spot.id)}
            className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all border border-slate-700/80 cursor-pointer min-h-[44px] text-center"
          >
            {isRouteActive ? 'ルート詳細' : '詳細を見る'}
          </button>

          {/* 右ボタン: ルート案内 / ナビを開始 (鮮やかな赤色) */}
          {isRouteActive ? (
            <a
              href={navUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-900/40 flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px] text-center"
            >
              <Navigation className="w-3.5 h-3.5 fill-current" />
              <span>ナビを開始</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => onStartRoute(spot)}
              className="py-2.5 px-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-900/40 flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
            >
              <Navigation className="w-3.5 h-3.5 fill-current" />
              <span>ルート案内</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
