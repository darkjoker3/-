import React, { useState, useMemo } from 'react';
import { Spot, UserLocation, SpotRouteInfo, CustomCategory } from '../types';
import { CATEGORY_CONFIG, getSpotMainCategory, getSpotAllCategories, getCategoryMeta } from '../data/categoryConfig';
import { calculateDistanceKm } from '../utils/geoUtils';
import {
  ChevronLeft,
  ChevronRight,
  Star,
  ChevronDown,
  Check,
  ListOrdered,
  Settings2,
} from 'lucide-react';

interface MobileSpotListViewProps {
  spots: Spot[];
  selectedPrefecture: string;
  onClearPrefecture: () => void;
  onSelectSpot: (id: string) => void;
  onOpenDetailModal: (id: string) => void;
  onBackToMap: () => void;
  categories: CustomCategory[];
  userLocation: UserLocation | null;
  routesInfo: Record<string, SpotRouteInfo>;
  onOpenCategoryManager?: () => void;
  onOpenListSettings?: () => void;
}

export const MobileSpotListView: React.FC<MobileSpotListViewProps> = ({
  spots,
  selectedPrefecture,
  onClearPrefecture,
  onSelectSpot,
  onOpenDetailModal,
  onBackToMap,
  categories,
  userLocation,
  routesInfo,
  onOpenCategoryManager,
  onOpenListSettings,
}) => {
  // Local filters matching Screen 6
  const [basicFilter, setBasicFilter] = useState<'all' | 'unvisited' | 'visited' | 'rating4'>('all');
  const [selectedCatIds, setSelectedCatIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'rating' | 'newest' | 'distance'>('rating');

  const filteredSpots = useMemo(() => {
    let result = spots.filter((s) => {
      // Prefecture filter
      if (selectedPrefecture && selectedPrefecture !== 'all' && s.prefecture !== selectedPrefecture) {
        return false;
      }
      // Basic filter
      if (basicFilter === 'unvisited' && s.isVisited) return false;
      if (basicFilter === 'visited' && !s.isVisited) return false;
      if (basicFilter === 'rating4') {
        const rating = s.dangerLevel ?? s.rating ?? 0;
        if (rating < 4) return false;
      }
      // Category filter
      if (selectedCatIds.length > 0) {
        const spotCats = s.categories && s.categories.length > 0 ? s.categories : [s.category || 'other'];
        const hasMatch = selectedCatIds.some((id) => spotCats.includes(id));
        if (!hasMatch) return false;
      }
      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'rating') {
        const rA = a.dangerLevel ?? a.rating ?? 0;
        const rB = b.dangerLevel ?? b.rating ?? 0;
        return rB - rA;
      }
      if (sortBy === 'distance' && userLocation) {
        const distA = routesInfo[a.id]?.distanceKm ?? calculateDistanceKm(userLocation.lat, userLocation.lng, a.lat, a.lng);
        const distB = routesInfo[b.id]?.distanceKm ?? calculateDistanceKm(userLocation.lat, userLocation.lng, b.lat, b.lng);
        return distA - distB;
      }
      // Newest
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return result;
  }, [spots, selectedPrefecture, basicFilter, selectedCatIds, sortBy, userLocation, routesInfo]);

  const prefTitle = selectedPrefecture && selectedPrefecture !== 'all' ? `${selectedPrefecture}のスポット一覧` : '登録スポット一覧';
  const countLabel = selectedPrefecture && selectedPrefecture !== 'all' ? `${selectedPrefecture}の登録スポット` : '登録スポット';

  return (
    <div className="h-full flex flex-col bg-slate-950 text-white select-none">
      {/* 1. Top Header with Back Button (Screen 6 準拠) */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-850 flex-shrink-0 bg-slate-950">
        <button
          type="button"
          onClick={() => {
            if (selectedPrefecture && selectedPrefecture !== 'all') {
              onClearPrefecture();
            }
            onBackToMap();
          }}
          className="p-1.5 -ml-1 text-slate-300 hover:text-white rounded-lg active:bg-slate-900 cursor-pointer"
          title="地図に戻る"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-bold text-white tracking-wide truncate">
          {prefTitle}
        </h1>
      </div>

      {/* 2. Basic Filters Row (Screen 6 準拠: 未訪問, 訪問済み, ★4以上, すべて) */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-900 overflow-x-auto no-scrollbar scroll-smooth flex-shrink-0 bg-slate-950/80">
        <button
          type="button"
          onClick={() => setBasicFilter('unvisited')}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
            basicFilter === 'unvisited'
              ? 'bg-white text-slate-950 border-white shadow-xs'
              : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
          }`}
        >
          未訪問
        </button>
        <button
          type="button"
          onClick={() => setBasicFilter('visited')}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
            basicFilter === 'visited'
              ? 'bg-white text-slate-950 border-white shadow-xs'
              : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
          }`}
        >
          訪問済み
        </button>
        <button
          type="button"
          onClick={() => setBasicFilter('rating4')}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
            basicFilter === 'rating4'
              ? 'bg-white text-slate-950 border-white shadow-xs'
              : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
          }`}
        >
          ★4以上
        </button>
        <button
          type="button"
          onClick={() => setBasicFilter('all')}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
            basicFilter === 'all'
              ? 'bg-white text-slate-950 border-white shadow-xs'
              : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
          }`}
        >
          すべて
        </button>
      </div>

      {/* 3. Category Chips Row (Screen 6 準拠) */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-850 bg-slate-950 text-xs">
        <span className="text-[11px] font-bold text-slate-400">カテゴリ</span>
        <div className="flex items-center gap-2.5">
          {onOpenListSettings && (
            <button
              type="button"
              onClick={onOpenListSettings}
              className="text-violet-400 hover:text-violet-300 font-bold flex items-center gap-1 cursor-pointer transition-colors text-[11px]"
              title="リストの作成・並び替え・名前変更"
            >
              <ListOrdered className="w-3 h-3 text-violet-400" />
              <span>リスト編集</span>
            </button>
          )}
          {onOpenCategoryManager && (
            <button
              type="button"
              onClick={onOpenCategoryManager}
              className="text-violet-400 hover:text-violet-300 font-bold flex items-center gap-1 cursor-pointer transition-colors text-[11px]"
              title="カテゴリの編集・追加"
            >
              <Settings2 className="w-3 h-3 text-violet-400" />
              <span>カテゴリ編集</span>
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-850 overflow-x-auto no-scrollbar scroll-smooth flex-shrink-0 bg-slate-950">
        {categories.map((cat) => {
          const isSelected = selectedCatIds.includes(cat.id);
          const config = CATEGORY_CONFIG[cat.id] || { color: cat.color || '#E53935' };
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setSelectedCatIds((prev) =>
                  prev.includes(cat.id) ? prev.filter((id) => id !== cat.id) : [...prev, cat.id]
                );
              }}
              style={{
                backgroundColor: isSelected ? config.color : undefined,
                borderColor: isSelected ? config.color : undefined,
              }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                isSelected
                  ? 'text-white border-transparent shadow-xs'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* 4. Subheader: Count & Sort Dropdown (Screen 6 準拠: 長野県の登録スポット 24件 [評価順 ▼]) */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950 border-b border-slate-900 flex-shrink-0">
        <div className="text-xs font-bold text-slate-200">
          {countLabel} <span className="text-slate-400 font-semibold ml-1">{filteredSpots.length}件</span>
        </div>
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-900 border border-slate-800 rounded-lg pl-2.5 pr-6 py-1 text-xs text-slate-300 appearance-none focus:outline-none cursor-pointer font-medium"
          >
            <option value="rating">評価順</option>
            <option value="newest">新着順</option>
            <option value="distance">近い順</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* 5. Spot List Cards (Screen 6 準拠) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 no-scrollbar pb-24">
        {filteredSpots.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            該当するスポットがありません
          </div>
        ) : (
          filteredSpots.map((spot) => {
            const allCats = getSpotAllCategories(spot);
            const mainCat = getSpotMainCategory(spot);
            const coverPhoto = spot.photos.find((p) => p.isCover) || spot.photos[0];
            const danger = Math.round(spot.dangerLevel ?? spot.rating ?? 4);

            let distanceKm: number | null = null;
            if (routesInfo[spot.id]?.status === 'success') {
              distanceKm = routesInfo[spot.id].distanceKm;
            } else if (userLocation) {
              distanceKm = calculateDistanceKm(userLocation.lat, userLocation.lng, spot.lat, spot.lng);
            }

            return (
              <div
                key={spot.id}
                onClick={() => {
                  onSelectSpot(spot.id);
                  onBackToMap();
                }}
                className="bg-slate-900/90 hover:bg-slate-850 active:bg-slate-800 border border-slate-800 rounded-2xl p-2.5 flex items-center gap-3 transition-colors cursor-pointer shadow-sm group"
              >
                {/* Photo Thumbnail */}
                {coverPhoto ? (
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-slate-800 border border-slate-700">
                    <img
                      src={coverPhoto.url}
                      alt={spot.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl flex-shrink-0 bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl">
                    {mainCat.icon}
                  </div>
                )}

                {/* Info Center */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-bold text-white tracking-tight truncate">
                    {spot.title}
                  </h3>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5 font-medium">
                    {spot.prefecture || ''} {spot.city || spot.address || ''}
                  </div>

                  {/* Stars */}
                  <div className="flex items-center text-amber-400 mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-3 h-3 ${
                          star <= danger ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {allCats.slice(0, 2).map((cat) => (
                      <span
                        key={cat.id}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-2xs"
                        style={{ backgroundColor: cat.color }}
                      >
                        {cat.label}
                      </span>
                    ))}
                    {spot.isVisited && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white">
                        訪問済み
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Distance & Chevron */}
                <div className="flex items-center gap-1 text-slate-400 flex-shrink-0 pl-1">
                  {distanceKm !== null && (
                    <span className="text-xs text-slate-300 font-medium">
                      {distanceKm}km
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
