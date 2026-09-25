import React, { useState } from 'react';
import { CustomCategory } from '../types';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { CategoryIconSelector } from './CategoryIconSelector';
import { SPOOKY_CATEGORY_PRESETS } from '../data/categoryIcons';
import {
  X,
  Plus,
  Check,
  Edit2,
  Trash2,
  Palette,
  Sparkles,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  GripVertical,
} from 'lucide-react';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CustomCategory[];
  onSaveCategories: (newCategories: CustomCategory[]) => void;
}

const PRESET_COLORS = [
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#64748b', // Slate
  '#1e293b', // Slate Dark
];

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  onSaveCategories,
}) => {
  const [list, setList] = useState<CustomCategory[]>(categories);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('📍');
  const [editColor, setEditColor] = useState('#64748b');

  // Drag and drop reordering states
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // New category inputs
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('👻');
  const [newColor, setNewColor] = useState('#8b5cf6');
  const [categoryToDelete, setCategoryToDelete] = useState<CustomCategory | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setList(categories);
      setEditingId(null);
      setShowAddForm(false);
      setErrorMessage(null);
      setDraggedIndex(null);
      setDragOverIndex(null);
    }
  }, [categories, isOpen]);

  if (!isOpen) return null;

  const handleMoveCategory = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    const updated = [...list];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setList(updated);
    onSaveCategories(updated);
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    const updated = [...list];
    const [moved] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, moved);
    setList(updated);
    onSaveCategories(updated);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const startEdit = (cat: CustomCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon);
    setEditColor(cat.color);
    setErrorMessage(null);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editName.trim()) return;
    const updated = list.map((cat) =>
      cat.id === editingId
        ? { ...cat, name: editName.trim(), icon: editIcon, color: editColor }
        : cat
    );
    setList(updated);
    onSaveCategories(updated);
    setEditingId(null);
  };

  const handleAddCategory = () => {
    if (!newName.trim()) return;
    const newId = `custom_${Date.now()}`;
    const newCat: CustomCategory = {
      id: newId,
      name: newName.trim(),
      icon: newIcon,
      color: newColor,
    };
    const updated = [...list, newCat];
    setList(updated);
    onSaveCategories(updated);
    setNewName('');
    setShowAddForm(false);
    setErrorMessage(null);
  };

  const handleDeleteCategoryClick = (cat: CustomCategory) => {
    if (list.length <= 1) {
      setErrorMessage('カテゴリは最低1つ以上必要です。');
      return;
    }
    setErrorMessage(null);
    setCategoryToDelete(cat);
  };

  const confirmDeleteCategory = () => {
    if (!categoryToDelete) return;
    const updated = list.filter((cat) => cat.id !== categoryToDelete.id);
    setList(updated);
    onSaveCategories(updated);
    setCategoryToDelete(null);
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏷️</span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">カテゴリの並び替え・管理</h3>
              <p className="text-xs text-slate-500">
                ドラッグまたは▲▼で並び替え、名前や色の編集ができます
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error notification banner */}
        {errorMessage && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* List of Categories */}
        <div className="p-4 overflow-y-auto space-y-2.5">
          {list.map((cat, idx) => {
            const isEditing = editingId === cat.id;

            if (isEditing) {
              return (
                <div
                  key={`${cat.id}_${idx}`}
                  className="p-3 bg-violet-50/70 rounded-xl border border-violet-200 space-y-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">名前:</span>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="カテゴリ名"
                      className="flex-1 px-2.5 py-1 text-xs border border-violet-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 font-bold"
                      autoFocus
                    />
                  </div>

                  {/* Icon Selector (心霊スポット特化アイコン & 自由入力) */}
                  <div className="pt-0.5">
                    <CategoryIconSelector
                      selectedIcon={editIcon}
                      onSelectIcon={setEditIcon}
                      accentColor={editColor}
                      compact={true}
                    />
                  </div>

                  {/* Color presets */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-500">カラー:</span>
                    {PRESET_COLORS.map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setEditColor(c)}
                        style={{ backgroundColor: c }}
                        className={`w-5 h-5 rounded-full cursor-pointer transition-transform ${
                          editColor === c ? 'ring-2 ring-offset-2 ring-slate-900 scale-120' : ''
                        }`}
                      />
                    ))}
                  </div>

                  {/* Save button */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="px-3 py-1 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>更新する</span>
                    </button>
                  </div>
                </div>
              );
            }

            const isDragging = draggedIndex === idx;
            const isDragOver = dragOverIndex === idx;

            return (
              <div
                key={`${cat.id}_${idx}`}
                draggable={editingId === null}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(idx));
                  setDraggedIndex(idx);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverIndex !== idx) {
                    setDragOverIndex(idx);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverIndex === idx) {
                    setDragOverIndex(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(idx);
                }}
                onDragEnd={() => {
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                  isDragging
                    ? 'opacity-30 scale-95 bg-slate-50 border-slate-300'
                    : isDragOver
                    ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-400'
                    : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing p-1"
                    title="ドラッグして並び替え"
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-base shadow-2xs text-white flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  >
                    {cat.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 truncate">
                      <span className="truncate">{cat.name}</span>
                      {cat.id === 'haunted' && (
                        <span className="text-[10px] font-normal px-1.5 py-0.2 bg-violet-100 text-violet-700 rounded-full flex-shrink-0">
                          初期
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {/* Up button */}
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMoveCategory(idx, 'up')}
                    title="上に移動"
                    className={`p-1 rounded-md transition-colors ${
                      idx === 0
                        ? 'text-slate-200 cursor-not-allowed'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer'
                    }`}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  {/* Down button */}
                  <button
                    type="button"
                    disabled={idx === list.length - 1}
                    onClick={() => handleMoveCategory(idx, 'down')}
                    title="下に移動"
                    className={`p-1 rounded-md transition-colors ${
                      idx === list.length - 1
                        ? 'text-slate-200 cursor-not-allowed'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer'
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  {/* Edit button */}
                  <button
                    type="button"
                    onClick={() => startEdit(cat)}
                    title="カテゴリ名を変更"
                    className="p-1.5 text-slate-500 hover:text-violet-700 hover:bg-violet-50 rounded-lg cursor-pointer transition-colors ml-0.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {/* Delete button */}
                  {list.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCategoryClick(cat)}
                      title="削除"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add Category Form */}
          {showAddForm ? (
            <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-2.5">
              <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>新規カテゴリを追加</span>
                <span className="text-[10px] text-slate-400 font-normal">心霊スポット向けプリセットから選択可</span>
              </div>

              {/* 心霊スポット向けおすすめプリセット */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                  <span>👻</span>
                  <span>よく使われる心霊スポットの例（ワンクリック入力）:</span>
                </span>
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
                  {SPOOKY_CATEGORY_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setNewName(preset.name);
                        setNewIcon(preset.icon);
                        setNewColor(preset.color);
                      }}
                      className="px-2 py-0.5 text-[11px] font-medium bg-white hover:bg-violet-50 hover:text-violet-700 hover:border-violet-300 border border-slate-200 rounded-lg flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors shadow-2xs"
                    >
                      <span>{preset.icon}</span>
                      <span>{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="カテゴリ名（例：怪奇現象・心霊現場、旧隧道など）"
                  className="flex-1 px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 font-medium"
                  autoFocus
                />
              </div>

              {/* Icon Selector (心霊スポット特化アイコン & 自由入力) */}
              <div className="pt-0.5">
                <CategoryIconSelector
                  selectedIcon={newIcon}
                  onSelectIcon={setNewIcon}
                  accentColor={newColor}
                  compact={true}
                />
              </div>

              {/* Color presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-500">カラー:</span>
                {PRESET_COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setNewColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-4 h-4 rounded-full cursor-pointer ${
                      newColor === c ? 'ring-2 ring-offset-2 ring-slate-900 scale-125' : ''
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="px-3 py-1 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>追加</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="w-full py-2.5 border border-dashed border-slate-300 hover:border-violet-400 hover:bg-violet-50/50 rounded-xl text-xs font-bold text-slate-600 hover:text-violet-700 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>新しいカテゴリを追加する</span>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
          >
            完了
          </button>
        </div>
      </div>

      {/* カテゴリ削除確認モーダル */}
      {categoryToDelete && (
        <ConfirmDeleteModal
          isOpen={!!categoryToDelete}
          title="カテゴリの削除"
          itemName={categoryToDelete.name}
          description="※このカテゴリが割り当てられているスポットは残ります。"
          confirmLabel="カテゴリを削除"
          onConfirm={confirmDeleteCategory}
          onCancel={() => setCategoryToDelete(null)}
        />
      )}
    </div>
  );
};
