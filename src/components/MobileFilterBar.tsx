import React from 'react';
import { CustomCategory } from '../types';
import { CATEGORY_LIST, CategoryItem } from '../data/categoryConfig';
import {
  Search,
  X,
  SlidersHorizontal,
  ChevronDown,
  Check,
  ListOrdered,
  Settings2,
} from 'lucide-react';

export type BasicFilterType = 'all' | 'unvisited' | 'visited' | 'rating4' | 'popular';

interface MobileFilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedBasicFilter: BasicFilterType;
  onBasicFilterChange: (f: BasicFilterType) => void;
  selectedCategoryIds: string[]; // 複数カテゴリ選択対応
  onToggleCategory: (catId: string) => void;
  onClearCategories: () => void;
  totalFilteredCount: number;
  onOpenFilterModal?: () => void;
  sortOrder?: 'desc' | 'asc';
  onToggleSortOrder?: () => void;
  onOpenCategoryManager?: () => void;
  onOpenListSettings?: () => void;
  categories?: CustomCategory[];
}

export const MobileFilterBar: React.FC<MobileFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedBasicFilter,
  onBasicFilterChange,
  selectedCategoryIds,
  onToggleCategory,
  onClearCategories,
  totalFilteredCount,
  onOpenFilterModal,
  sortOrder = 'desc',
  onToggleSortOrder,
  onOpenCategoryManager,
  onOpenListSettings,
  categories,
}) => {
  const isAllCategories = selectedCategoryIds.length === 0;

  // Use dynamic custom categories if available, falling back to default CATEGORY_LIST
  const displayCategories = categories && categories.length > 0
    ? categories.map((c) => ({ id: c.id, label: c.name, color: c.color, icon: c.icon }))
    : CATEGORY_LIST;

  return (
    <header
      role="search"
      aria-label="検索とフィルター"
      className="flex-shrink-0 bg-slate-950/98 backdrop-blur-md border-b border-slate-800/80 text-slate-100 px-3 pt-2 pb-2 flex flex-col gap-2 z-30 shadow-md"
    >
      {/* 1. 上部検索バー (Screen 1準拠: スポット名・住所で検索) */}
      <div className="relative flex items-center w-full">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
        <input
          id="mobile-search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="スポット名・住所で検索"
          className="w-full bg-slate-900 border border-slate-700/80 rounded-2xl pl-10 pr-9 py-2 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 shadow-inner"
        />
        {searchQuery ? (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 p-1 text-slate-400 hover:text-white rounded-full bg-slate-800 cursor-pointer"
            title="検索をクリア"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={onOpenFilterModal}
            className="absolute right-2.5 p-1 text-slate-400 hover:text-white rounded-full bg-slate-800/80 cursor-pointer"
            title="検索条件・フィルターを開く"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 2. 基本フィルター (Screen 1準拠: 全国, 未訪問, ★4以上, 降順, 🎛️ボタン) */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5">
        {/* 全国 */}
        <button
          type="button"
          onClick={() => onBasicFilterChange('all')}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
            selectedBasicFilter === 'all'
              ? 'bg-white text-slate-950 border-white shadow-xs'
              : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
          }`}
        >
          全国
        </button>

        {/* 未訪問 */}
        <button
          type="button"
          onClick={() => onBasicFilterChange('unvisited')}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
            selectedBasicFilter === 'unvisited'
              ? 'bg-white text-slate-950 border-white shadow-xs'
              : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
          }`}
        >
          未訪問
        </button>

        {/* 訪問済み */}
        <button
          type="button"
          onClick={() => onBasicFilterChange('visited')}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
            selectedBasicFilter === 'visited'
              ? 'bg-white text-slate-950 border-white shadow-xs'
              : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
          }`}
        >
          訪問済み
        </button>

        {/* ★4以上 */}
        <button
          type="button"
          onClick={() => onBasicFilterChange('rating4')}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
            selectedBasicFilter === 'rating4'
              ? 'bg-white text-slate-950 border-white shadow-xs'
              : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
          }`}
        >
          ★4以上
        </button>

        {/* 降順 / 昇順 */}
        <button
          type="button"
          onClick={() => onToggleSortOrder && onToggleSortOrder()}
          className="flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700"
          title="並び替え順の切り替え"
        >
          {sortOrder === 'asc' ? '昇順' : '降順'}
        </button>

        {/* 🎛️ 詳細フィルターモーダルを開くボタン */}
        {onOpenFilterModal && (
          <button
            type="button"
            onClick={onOpenFilterModal}
            className="flex-shrink-0 p-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer bg-slate-900 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700 ml-auto"
            title="詳細検索・フィルターモーダルを開く"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 3. カテゴリフィルター (Screen 1準拠: 横スクロールチップ) */}
      <div className="flex items-center justify-between px-0.5 text-[11px] font-bold text-slate-400">
        <span className="text-[10px] text-slate-400">カテゴリ絞り込み</span>
        <div className="flex items-center gap-2.5">
          {onOpenListSettings && (
            <button
              type="button"
              onClick={onOpenListSettings}
              className="text-violet-400 hover:text-violet-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
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
              className="text-violet-400 hover:text-violet-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="カテゴリの編集・追加"
            >
              <Settings2 className="w-3 h-3 text-violet-400" />
              <span>カテゴリ編集</span>
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5">
        {/* 全カテゴリ解除 / すべて */}
        <button
          type="button"
          onClick={onClearCategories}
          className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border cursor-pointer ${
            isAllCategories
              ? 'bg-slate-100 text-slate-950 border-white shadow-xs font-black'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
        >
          <span>すべて</span>
        </button>

        {/* 各カテゴリのチップ (Screen 1準拠: 選択時はカテゴリ色で鮮やかに塗りつぶし) */}
        {displayCategories.map((cat) => {
          const isSelected = selectedCategoryIds.includes(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onToggleCategory(cat.id)}
              style={{
                backgroundColor: isSelected ? cat.color : undefined,
                borderColor: isSelected ? cat.color : undefined,
              }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                isSelected
                  ? 'text-white shadow-md font-bold border-transparent'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
            </button>
          );
        })}
      </div>
    </header>
  );
};

