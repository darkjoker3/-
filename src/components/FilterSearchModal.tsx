import React from 'react';
import { CustomCategory, CustomList, SpotListTab } from '../types';
import { JAPAN_PREFECTURES } from '../data/sampleSpots';
import { CATEGORY_CONFIG } from '../data/categoryConfig';
import { X, Search, Star, ChevronDown, RotateCcw, ListOrdered, Settings2 } from 'lucide-react';

interface FilterSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPrefecture: string;
  onSelectPrefecture: (pref: string) => void;
  visitStatus: 'all' | 'unvisited' | 'visited';
  onSelectVisitStatus: (status: 'all' | 'unvisited' | 'visited') => void;
  minRating: number; // 0: all, 1: >=1, 2: >=2, 3: >=3, 4: >=4, 5: ==5
  onSelectMinRating: (rating: number) => void;
  categories: CustomCategory[];
  selectedCategoryIds: string[];
  onToggleCategory: (catId: string) => void;
  sortBy: string;
  onSelectSortBy: (sort: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onReset: () => void;
  totalFilteredCount: number;
  onOpenCategoryManager?: () => void;
  onOpenListSettings?: () => void;
  activeTab?: SpotListTab;
  onSelectTab?: (tab: SpotListTab) => void;
  customLists?: CustomList[];
}

export const FilterSearchModal: React.FC<FilterSearchModalProps> = ({
  isOpen,
  onClose,
  selectedPrefecture,
  onSelectPrefecture,
  visitStatus,
  onSelectVisitStatus,
  minRating,
  onSelectMinRating,
  categories,
  selectedCategoryIds,
  onToggleCategory,
  sortBy,
  onSelectSortBy,
  searchQuery,
  onSearchChange,
  onReset,
  totalFilteredCount,
  onOpenCategoryManager,
  onOpenListSettings,
  activeTab,
  onSelectTab,
  customLists,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1200] bg-black/80 backdrop-blur-sm flex flex-col justify-end sm:justify-center sm:items-center sm:p-4 animate-in fade-in duration-200">
      <div className="w-full sm:max-w-md bg-slate-950 text-white rounded-t-3xl sm:rounded-3xl border border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800/80 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
          >
            キャンセル
          </button>
          <h2 className="text-base font-bold text-white tracking-wide">
            検索・フィルター
          </h2>
          <button
            type="button"
            onClick={onReset}
            className="text-sm font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
          >
            リセット
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {/* 表示リスト (タブ選択) */}
          {onSelectTab && (
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                表示リスト
              </label>
              <div className="flex flex-wrap gap-1.5 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => onSelectTab('all')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    !activeTab || activeTab === 'all'
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  全リスト
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTab('want_to_go')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'want_to_go'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  📌 行きたい場所
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTab('haunted')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'haunted'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  👻 心リスト
                </button>
                {customLists?.filter((cl) => cl.id !== 'want_to_go' && cl.id !== 'haunted').map((cl) => (
                  <button
                    key={cl.id}
                    type="button"
                    onClick={() => onSelectTab(cl.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                      activeTab === cl.id
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <span>{cl.icon || '⭐'}</span>
                    <span>{cl.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 1. 都道府県 */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              都道府県
            </label>
            <div className="relative">
              <select
                value={selectedPrefecture}
                onChange={(e) => onSelectPrefecture(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
              >
                <option value="all">全国 (全47都道府県)</option>
                {JAPAN_PREFECTURES.map((pref) => (
                  <option key={pref} value={pref} className="bg-slate-900 text-white">
                    {pref}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* 2. 訪問状況 */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              訪問状況
            </label>
            <div className="grid grid-cols-3 gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => onSelectVisitStatus('all')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  visitStatus === 'all'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                すべて
              </button>
              <button
                type="button"
                onClick={() => onSelectVisitStatus('unvisited')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  visitStatus === 'unvisited'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                未訪問
              </button>
              <button
                type="button"
                onClick={() => onSelectVisitStatus('visited')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  visitStatus === 'visited'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                訪問済み
              </button>
            </div>
          </div>

          {/* 3. 危険度 */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              危険度
            </label>
            <div className="space-y-1.5">
              <div className="grid grid-cols-3 gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => onSelectMinRating(0)}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    minRating === 0
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  すべて
                </button>
                <button
                  type="button"
                  onClick={() => onSelectMinRating(1)}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    minRating === 1
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ★1以上
                </button>
                <button
                  type="button"
                  onClick={() => onSelectMinRating(2)}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    minRating === 2
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ★2以上
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => onSelectMinRating(3)}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    minRating === 3
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ★3以上
                </button>
                <button
                  type="button"
                  onClick={() => onSelectMinRating(4)}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    minRating === 4
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ★4以上
                </button>
                <button
                  type="button"
                  onClick={() => onSelectMinRating(5)}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    minRating === 5
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ★5のみ
                </button>
              </div>
            </div>
          </div>

          {/* 4. カテゴリ ★ */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300">
                カテゴリ <span className="text-red-500 font-normal">★</span>
              </label>
              <div className="flex items-center gap-2.5">
                {onOpenListSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenListSettings();
                    }}
                    className="text-[11px] text-violet-400 hover:text-violet-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="リストの作成・並び替え・名前変更"
                  >
                    <ListOrdered className="w-3 h-3 text-violet-400" />
                    <span>リスト編集</span>
                  </button>
                )}
                {onOpenCategoryManager && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCategoryManager();
                    }}
                    className="text-[11px] text-violet-400 hover:text-violet-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="カテゴリの編集・追加"
                  >
                    <Settings2 className="w-3 h-3 text-violet-400" />
                    <span>カテゴリ編集</span>
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => {
                const isSelected = selectedCategoryIds.includes(cat.id);
                const color = cat.color || CATEGORY_CONFIG[cat.id]?.color || '#E53935';
                const icon = cat.icon || CATEGORY_CONFIG[cat.id]?.icon || '📍';
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => onToggleCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                      isSelected
                        ? 'text-white border-transparent shadow-xs'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                    style={{
                      backgroundColor: isSelected ? color : undefined,
                    }}
                  >
                    <span>{icon}</span>
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. 並び替え */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              並び替え
            </label>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => onSelectSortBy(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
              >
                <option value="newest">おすすめ順 (新着順)</option>
                <option value="rating">危険度が高い順</option>
                <option value="distance">現在地から近い順</option>
                <option value="name">スポット名順</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* 6. フリーワード検索 */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              フリーワード検索
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="スポット名・住所・説明で検索"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-8 py-2.5 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="p-1 text-slate-400 hover:text-white absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Action Button (Full Width Vivid Red Button) */}
        <div className="p-4 border-t border-slate-800/80 flex-shrink-0 bg-slate-950 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-900/40 transition-all cursor-pointer text-center"
          >
            この条件で検索 ({totalFilteredCount}件)
          </button>
        </div>
      </div>
    </div>
  );
};
