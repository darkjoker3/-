import React from 'react';
import { Spot } from '../types';
import { computePrefectureStats } from '../utils/geoUtils';
import { X } from 'lucide-react';

interface PrefectureInfoCardProps {
  prefecture: string;
  spots: Spot[];
  onViewList: () => void;
  onClose: () => void;
}

export const PrefectureInfoCard: React.FC<PrefectureInfoCardProps> = ({
  prefecture,
  spots,
  onViewList,
  onClose,
}) => {
  if (!prefecture || prefecture === 'all') return null;

  const stats = computePrefectureStats(spots, prefecture);

  return (
    <div
      role="region"
      aria-label={`${prefecture}の情報カード`}
      className="absolute bottom-20 right-4 left-4 sm:left-auto sm:right-6 sm:w-52 z-[1100] bg-slate-950/95 backdrop-blur-md border border-slate-800 text-white rounded-xl shadow-2xl p-2.5 animate-in fade-in slide-in-from-bottom-3 duration-200 flex flex-col gap-1.5"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full border-2 border-white flex-shrink-0" />
            <h3 className="text-xs font-bold text-white tracking-wide">{prefecture}</h3>
          </div>
          <p className="text-[11px] text-slate-300 font-medium pl-3.5 mt-0.5">
            登録件数 {stats.total}件
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded-full bg-slate-900 border border-slate-800 cursor-pointer -mr-0.5 -mt-0.5"
          title="閉じる"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      <button
        type="button"
        onClick={onViewList}
        className="w-full py-1.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-red-900/40 text-center cursor-pointer mt-0.5"
      >
        一覧を見る
      </button>
    </div>
  );
};
