import React, { useState } from 'react';
import { parseAndResolveMapInput, extractPrefectureFromAddress, isValidLatLng } from '../utils/mapParser';
import { Spot, CustomCategory } from '../types';
import { Link2, MapPin, Search, Loader2, Sparkles, Plus, Check, ArrowRight } from 'lucide-react';

interface QuickPinBarProps {
  categories: CustomCategory[];
  onPinCreated: (spotData: Omit<Spot, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onOpenFullFormWithData?: (initialData: Partial<Spot>) => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const QuickPinBar: React.FC<QuickPinBarProps> = ({
  categories,
  onPinCreated,
  onOpenFullFormWithData,
  showToast,
}) => {
  const [input, setInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0]?.id || 'haunted');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleQuickPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = input.trim();
    if (!raw) {
      showToast('Googleマップの共有リンクまたは住所を入力してください', 'info');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Googleマップ共有リンク（短縮URL含む）または住所から位置情報を解析・取得
      const parsed = await parseAndResolveMapInput(raw);

      const targetLat = parsed.lat !== undefined && isValidLatLng(parsed.lat, parsed.lng!) ? parsed.lat : 35.6895;
      const targetLng = parsed.lng !== undefined && isValidLatLng(targetLat, parsed.lng) ? parsed.lng : 139.6917;

      const title = parsed.title || parsed.address || (raw.startsWith('http') ? '共有リンクスポット' : raw);
      const address = parsed.address || (raw.startsWith('http') ? undefined : raw);
      const prefecture = parsed.prefecture || extractPrefectureFromAddress(address) || extractPrefectureFromAddress(raw);

      // 選択中のカテゴリ（デフォルト: ユーザー指定カテゴリ）
      const targetCategory = selectedCategory || categories[0]?.id || 'haunted';

      const newSpotData: Omit<Spot, 'id' | 'createdAt' | 'updatedAt'> = {
        title,
        lat: targetLat,
        lng: targetLng,
        address,
        prefecture,
        category: targetCategory,
        categories: [targetCategory],
        rating: 0,
        notes: '',
        googleMapsUrl: raw.startsWith('http')
          ? raw
          : `https://www.google.com/maps?q=${targetLat},${targetLng}`,
        referenceUrls: [],
        photos: [],
        isWantToGo: false,
        isHaunted: targetCategory === 'haunted',
        listIds: targetCategory === 'haunted' ? ['haunted'] : [],
      };

      onPinCreated(newSpotData);
      setInput('');
      setIsExpanded(false);

      if (parsed.isFallbackCoordinate) {
        showToast(
          `📍 共有リンクから「${title}」のピンを立てました！（※地図上で位置をクリックまたはドラッグして微調整できます）`,
          'info'
        );
      } else {
        showToast(
          `📍 「${title}」にピンを立てました！${prefecture ? `（${prefecture}）` : ''}`,
          'success'
        );
      }
    } catch (err) {
      console.error('Quick pin failed:', err);
      showToast('解析中にエラーが発生しました。住所表記をご確認ください。', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative z-20">
      <form
        onSubmit={handleQuickPin}
        className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-2 py-1.5 rounded-2xl shadow-md border border-violet-200 hover:border-violet-300 transition-all text-xs w-full max-w-full"
      >
        <div className="flex items-center gap-1.5 pl-1.5 text-violet-700 font-bold flex-shrink-0">
          <Link2 className="w-3.5 h-3.5 text-violet-600" />
          <span className="hidden md:inline text-[11px]">共有リンク・住所:</span>
        </div>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setIsExpanded(true)}
          placeholder="Googleマップ共有リンク または 住所（例: 東京都八王子市...）"
          className="flex-1 min-w-0 bg-transparent py-1 px-1.5 text-slate-800 placeholder-slate-400 focus:outline-none text-xs font-medium"
          disabled={isLoading}
        />

        {input.trim() && (
          <button
            type="button"
            onClick={() => setInput('')}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
            title="入力をクリア"
          >
            ✕
          </button>
        )}

        {/* カテゴリ ドロップダウンリスト */}
        <div className="flex-shrink-0">
          <select
            id="quick-pin-category-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-200 text-xs font-bold rounded-xl px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500/20 cursor-pointer transition-colors max-w-[130px] sm:max-w-[150px] truncate"
            title="ピンのカテゴリをドロップダウンから選択"
            disabled={isLoading}
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          id="quick-pin-submit-btn"
          className="px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          title="共有リンクまたは住所から直接ピンを立てる"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="hidden sm:inline">解析中...</span>
            </>
          ) : (
            <>
              <MapPin className="w-3.5 h-3.5" />
              <span>ピンを立てる</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
