import React, { useState } from 'react';
import {
  SPOOKY_ICON_GROUPS,
  QUICK_SPOOKY_ICONS,
} from '../data/categoryIcons';
import { ChevronDown, ChevronUp, Sparkles, Smile } from 'lucide-react';

interface CategoryIconSelectorProps {
  selectedIcon: string;
  onSelectIcon: (icon: string) => void;
  accentColor?: string;
  compact?: boolean;
}

export const CategoryIconSelector: React.FC<CategoryIconSelectorProps> = ({
  selectedIcon,
  onSelectIcon,
  accentColor = '#8b5cf6',
  compact = false,
}) => {
  const [activeGroup, setActiveGroup] = useState<string>('spooky');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [customEmojiInput, setCustomEmojiInput] = useState<string>('');

  const currentGroup =
    SPOOKY_ICON_GROUPS.find((g) => g.id === activeGroup) || SPOOKY_ICON_GROUPS[0];

  const handleCustomInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customEmojiInput.trim()) {
      onSelectIcon(customEmojiInput.trim());
      setCustomEmojiInput('');
    }
  };

  return (
    <div className="space-y-2">
      {/* Top Header: Current Icon Preview & Quick Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-600">選択中:</span>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-lg shadow-sm border border-slate-200 transition-all font-emoji"
            style={{
              backgroundColor: `${accentColor}18`,
              borderColor: accentColor,
            }}
          >
            {selectedIcon}
          </div>
          <span className="text-[11px] text-slate-500 font-medium truncate max-w-[120px]">
            {SPOOKY_ICON_GROUPS.flatMap((g) => g.icons).find((i) => i.emoji === selectedIcon)
              ?.label || 'カスタム'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-2 py-1 text-[11px] font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg flex items-center gap-1 transition-colors border border-violet-200 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-violet-600" />
          <span>{isExpanded ? '一覧を閉じる' : '心霊アイコン一覧を開く'}</span>
          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Quick Picks (Top ~12-16 most frequent spooky icons) */}
      <div className="flex items-center gap-1 flex-wrap">
        {QUICK_SPOOKY_ICONS.slice(0, compact ? 12 : 16).map((icon) => {
          const isSelected = selectedIcon === icon;
          return (
            <button
              type="button"
              key={icon}
              onClick={() => onSelectIcon(icon)}
              className={`w-7 h-7 text-sm rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                isSelected
                  ? 'bg-white shadow-md scale-110 ring-2 ring-violet-500 z-10'
                  : 'bg-slate-100/80 hover:bg-white hover:shadow-xs'
              }`}
            >
              {icon}
            </button>
          );
        })}
      </div>

      {/* Expanded Categorized Panel */}
      {isExpanded && (
        <div className="p-2.5 bg-slate-50 rounded-xl border border-violet-200 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
            {SPOOKY_ICON_GROUPS.map((group) => {
              const isActive = activeGroup === group.id;
              return (
                <button
                  type="button"
                  key={group.id}
                  onClick={() => setActiveGroup(group.id)}
                  className={`px-2 py-1 text-[11px] font-bold rounded-lg flex items-center gap-1 whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>{group.badge}</span>
                  <span>{group.name}</span>
                </button>
              );
            })}
          </div>

          {/* Active Group Icons Grid */}
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 max-h-40 overflow-y-auto p-1 bg-white rounded-lg border border-slate-200">
            {currentGroup.icons.map((item) => {
              const isSelected = selectedIcon === item.emoji;
              return (
                <button
                  type="button"
                  key={item.emoji + item.label}
                  onClick={() => onSelectIcon(item.emoji)}
                  title={`${item.emoji} ${item.label}`}
                  className={`h-9 rounded-lg flex flex-col items-center justify-center text-base cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-violet-100 ring-2 ring-violet-500 scale-105 shadow-xs'
                      : 'hover:bg-slate-100'
                  }`}
                >
                  <span className="leading-none">{item.emoji}</span>
                  <span className="text-[9px] text-slate-500 scale-75 truncate max-w-[42px] leading-tight">
                    {item.label.split('・')[0]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Custom Emoji Input Form */}
          <div className="pt-1 border-t border-slate-200 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Smile className="w-3.5 h-3.5 text-slate-400" />
              <span>自由入力:</span>
            </span>
            <form onSubmit={handleCustomInputSubmit} className="flex-1 flex items-center gap-1.5">
              <input
                type="text"
                maxLength={4}
                value={customEmojiInput}
                onChange={(e) => setCustomEmojiInput(e.target.value)}
                placeholder="好みの絵文字を直接入力・貼付け (例: 👹)"
                className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-violet-400 text-center"
              />
              <button
                type="submit"
                disabled={!customEmojiInput.trim()}
                className="px-2.5 py-1 text-[11px] font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 rounded-md transition-colors cursor-pointer"
              >
                適用
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
