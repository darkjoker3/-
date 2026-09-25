import React from 'react';
import { Map, ListFilter, Plus, CheckCircle2, Settings } from 'lucide-react';

export type MobileTab = 'map' | 'list' | 'visited' | 'settings';

interface MobileBottomNavProps {
  currentTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  onOpenAddSpot: () => void;
  spotsCount: number;
  visitedCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenAddSpot,
  spotsCount,
  visitedCount,
}) => {
  return (
    <nav
      id="mobile-bottom-navigation-bar"
      aria-label="モバイル下部ナビゲーション"
      className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/98 backdrop-blur-md border-t border-slate-850 text-slate-400 shadow-2xl px-2 py-1 flex items-center justify-around pb-[max(0.6rem,env(safe-area-inset-bottom))]"
    >
      {/* 1. 地図 */}
      <button
        type="button"
        onClick={() => onSelectTab('map')}
        className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer min-h-[44px] ${
          currentTab === 'map'
            ? 'text-white font-bold'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Map className={`w-5 h-5 mb-0.5 ${currentTab === 'map' ? 'text-white' : 'text-slate-400'}`} />
        <span className="text-[10px]">地図</span>
      </button>

      {/* 2. 一覧 */}
      <button
        type="button"
        onClick={() => onSelectTab('list')}
        className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer min-h-[44px] relative ${
          currentTab === 'list'
            ? 'text-white font-bold'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <div className="relative">
          <ListFilter className={`w-5 h-5 mb-0.5 ${currentTab === 'list' ? 'text-white' : 'text-slate-400'}`} />
          {spotsCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full min-w-4 text-center">
              {spotsCount}
            </span>
          )}
        </div>
        <span className="text-[10px]">一覧</span>
      </button>

      {/* 3. ＋登録 (中央で大きく強調: 鮮やかな赤色) */}
      <button
        type="button"
        onClick={onOpenAddSpot}
        className="flex flex-col items-center justify-center flex-1 py-0.5 cursor-pointer group min-h-[44px]"
        title="新規スポット登録"
      >
        <div className="w-11 h-11 rounded-full bg-red-600 hover:bg-red-500 active:bg-red-700 text-white flex items-center justify-center shadow-lg shadow-red-600/40 -mt-4 group-hover:scale-105 active:scale-95 transition-all ring-4 ring-slate-950">
          <Plus className="w-6 h-6 stroke-[3]" />
        </div>
        <span className="text-[10px] font-black text-red-500 mt-0.5">登録</span>
      </button>

      {/* 4. 訪問 */}
      <button
        type="button"
        onClick={() => onSelectTab('visited')}
        className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer min-h-[44px] relative ${
          currentTab === 'visited'
            ? 'text-white font-bold'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <div className="relative">
          <CheckCircle2 className={`w-5 h-5 mb-0.5 ${currentTab === 'visited' ? 'text-white' : 'text-slate-400'}`} />
          {visitedCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full min-w-4 text-center">
              {visitedCount}
            </span>
          )}
        </div>
        <span className="text-[10px]">訪問</span>
      </button>

      {/* 5. 設定 */}
      <button
        type="button"
        onClick={() => onSelectTab('settings')}
        className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer min-h-[44px] ${
          currentTab === 'settings'
            ? 'text-white font-bold'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Settings className={`w-5 h-5 mb-0.5 ${currentTab === 'settings' ? 'text-white' : 'text-slate-400'}`} />
        <span className="text-[10px]">設定</span>
      </button>
    </nav>
  );
};
