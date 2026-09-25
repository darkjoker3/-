import React, { useState, useEffect } from 'react';
import { CustomList } from '../types';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { X, Plus, Sparkles, Tag, Check, Edit3, Trash2 } from 'lucide-react';

interface CreateListModalProps {
  isOpen: boolean;
  initialList?: CustomList | null;
  onClose: () => void;
  onCreateList: (newList: Omit<CustomList, 'id' | 'createdAt'>) => void;
  onUpdateList?: (listId: string, updated: Omit<CustomList, 'id' | 'createdAt'>) => void;
  onDeleteList?: (listId: string) => void;
}

const PRESET_ICONS = ['📌', '👻', '⭐', '🚗', '🌙', '🍜', '🏕️', '📸', '🌲', '🏛️', '☕', '🔥', '🌊', '🏯', '🏨', '🎒', '⛩️', '🧭', '🗝️', '🖤'];

const PRESET_COLORS = [
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#ec4899', // Pink
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#6366f1', // Indigo
  '#64748b', // Slate
];

export const CreateListModal: React.FC<CreateListModalProps> = ({
  isOpen,
  initialList = null,
  onClose,
  onCreateList,
  onUpdateList,
  onDeleteList,
}) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('⭐');
  const [color, setColor] = useState('#f59e0b');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isEditing = !!initialList;

  useEffect(() => {
    if (initialList) {
      setName(initialList.name);
      setIcon(initialList.icon || '⭐');
      setColor(initialList.color || '#f59e0b');
      setDescription(initialList.description || '');
      setError('');
    } else {
      setName('');
      setIcon('⭐');
      setColor('#f59e0b');
      setDescription('');
      setError('');
    }
  }, [initialList, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('リスト名を入力してください');
      return;
    }

    if (isEditing && initialList && onUpdateList) {
      onUpdateList(initialList.id, {
        name: trimmed,
        icon,
        color,
        description: description.trim(),
      });
    } else {
      onCreateList({
        name: trimmed,
        icon,
        color,
        description: description.trim(),
      });
    }

    setName('');
    setDescription('');
    setIcon('⭐');
    setColor('#f59e0b');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-2xs"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {icon}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                {isEditing ? (
                  <>
                    <Edit3 className="w-4 h-4 text-violet-600" />
                    <span>リストを編集</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-violet-600" />
                    <span>新しいリストを作成</span>
                  </>
                )}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isEditing ? 'リスト名やアイコン、カラーを変更できます' : 'スポットを整理・分類するためのオリジナルリスト'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-2.5 rounded-xl bg-red-50 text-red-600 text-xs font-bold border border-red-200">
              {error}
            </div>
          )}

          {/* List Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              リスト名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="例: 夜景ドライブ、お気に入りラーメン、廃墟巡り..."
              className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              maxLength={24}
              autoFocus
            />
          </div>

          {/* Icon Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              アイコン絵文字
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {PRESET_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all cursor-pointer ${
                    icon === emoji
                      ? 'bg-violet-100 ring-2 ring-violet-500 scale-110 shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Color Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              カラー
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full transition-transform cursor-pointer shadow-2xs ${
                    color === c ? 'ring-2 ring-offset-2 ring-slate-800 scale-115' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              メモ・説明 <span className="text-slate-400 font-normal">(任意)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例: 週末の下道ドライブで行きたいスポット"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              maxLength={60}
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            {isEditing && initialList && onDeleteList ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-2 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                title="このリストを削除"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>リストを削除</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {isEditing ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>変更を保存</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>リストを作成する</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 削除確認モーダル */}
      {showDeleteConfirm && initialList && onDeleteList && (
        <ConfirmDeleteModal
          isOpen={showDeleteConfirm}
          title="リストの削除"
          itemName={initialList.name}
          description="※このリストに登録されていたスポット自体は削除されません。"
          confirmLabel="リストを削除"
          onConfirm={() => {
            onDeleteList(initialList.id);
            setShowDeleteConfirm(false);
            onClose();
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
};
