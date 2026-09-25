import React, { useState } from 'react';
import { CustomList, Spot } from '../types';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { X, Plus, Edit3, Trash2, ChevronUp, ChevronDown, ListOrdered, GripVertical } from 'lucide-react';

interface ListSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customLists: CustomList[];
  spots: Spot[];
  onOpenCreateList: () => void;
  onEditCustomList: (customList: CustomList) => void;
  onMoveCustomList: (listId: string, direction: 'up' | 'down') => void;
  onReorderCustomLists?: (newLists: CustomList[]) => void;
  onDeleteCustomList: (listId: string) => void;
  onResetCustomList?: (listId: string) => void;
  onRestoreDefaultLists?: () => void;
}

export const ListSettingsModal: React.FC<ListSettingsModalProps> = ({
  isOpen,
  onClose,
  customLists,
  spots,
  onOpenCreateList,
  onEditCustomList,
  onMoveCustomList,
  onReorderCustomLists,
  onDeleteCustomList,
  onRestoreDefaultLists,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [listToDelete, setListToDelete] = useState<CustomList | null>(null);

  if (!isOpen) return null;

  // Calculate count per list (including built-in want_to_go & haunted)
  const listCounts: Record<string, number> = {};
  customLists.forEach((cl) => {
    if (cl.id === 'want_to_go') {
      listCounts[cl.id] = spots.filter((s) => Boolean(s.isWantToGo || s.listIds?.includes('want_to_go'))).length;
    } else if (cl.id === 'haunted') {
      listCounts[cl.id] = spots.filter((s) => Boolean(s.isHaunted ?? (s.category === 'haunted' || s.listIds?.includes('haunted')))).length;
    } else {
      listCounts[cl.id] = spots.filter((s) => s.listIds && s.listIds.includes(cl.id)).length;
    }
  });

  const handleDrop = (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...customLists];
    const [moved] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    if (onReorderCustomLists) {
      onReorderCustomLists(reordered);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
              <ListOrdered className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">リストの並び替え・編集</h3>
              <p className="text-[11px] text-slate-500">
                ドラッグまたは▲▼で並び替え、編集やゴミ箱で削除ができます
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

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {customLists.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              <p className="text-sm font-medium mb-3">リストがまだありません</p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCreateList();
                }}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新しいリストを作成</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-400 mb-1 px-1 flex items-center justify-between">
                <span>リスト名（{customLists.length}件）※ドラッグで並び替え</span>
                <span>順番 / 編集 / 削除</span>
              </div>

              {customLists.map((customList, index) => {
                const count = listCounts[customList.id] || 0;
                const isDragging = draggedIndex === index;
                const isDragOver = dragOverIndex === index;

                return (
                  <div
                    key={`${customList.id}_${index}`}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(index));
                      setDraggedIndex(index);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverIndex !== index) {
                        setDragOverIndex(index);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverIndex === index) {
                        setDragOverIndex(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDrop(index);
                    }}
                    onDragEnd={() => {
                      setDraggedIndex(null);
                      setDragOverIndex(null);
                    }}
                    className={`p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                      isDragging
                        ? 'opacity-40 ring-2 ring-violet-400 bg-violet-50/50 border-violet-300'
                        : isDragOver
                        ? 'border-violet-500 ring-2 ring-violet-200 bg-violet-50/30'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    {/* Drag Handle & List Info */}
                    <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                      <div
                        className="text-slate-400 hover:text-slate-700 cursor-grab active:cursor-grabbing p-1 rounded-md hover:bg-slate-100 flex-shrink-0"
                        title="ドラッグして並び替え"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>

                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0 shadow-2xs"
                        style={{
                          backgroundColor: `${customList.color}20`,
                          color: customList.color,
                        }}
                      >
                        {customList.icon || '⭐'}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
                          <span className="truncate">{customList.name}</span>
                          <span
                            className="text-[10px] px-1.5 py-0.2 rounded-full font-semibold flex-shrink-0"
                            style={{
                              backgroundColor: `${customList.color}18`,
                              color: customList.color,
                            }}
                          >
                            {count}件
                          </span>
                        </div>
                        {customList.description && (
                          <div className="text-[10px] text-slate-400 truncate">
                            {customList.description}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions: ▲▼ Reorder, ✏️ Edit, 🗑️ Delete */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* 上下移動ボタン */}
                      <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => onMoveCustomList(customList.id, 'up')}
                          className={`p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-white transition-colors ${
                            index === 0 ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                          title="上（前）へ移動"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === customLists.length - 1}
                          onClick={() => onMoveCustomList(customList.id, 'down')}
                          className={`p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-white transition-colors ${
                            index === customLists.length - 1
                              ? 'opacity-25 cursor-not-allowed'
                              : 'cursor-pointer'
                          }`}
                          title="下（次）へ移動"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* 編集ボタン */}
                      <button
                        type="button"
                        onClick={() => {
                          onEditCustomList(customList);
                        }}
                        className="p-1.5 text-slate-500 hover:text-violet-700 hover:bg-violet-50 rounded-lg transition-colors cursor-pointer"
                        title="リスト名やアイコン、カラーを編集"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* 削除ボタン（ゴミ箱） */}
                      <button
                        type="button"
                        onClick={() => setListToDelete(customList)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="このリストを削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 新規リスト作成ボタン */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenCreateList();
            }}
            className="w-full mt-3 p-2.5 rounded-xl border border-dashed border-violet-300 bg-violet-50/50 hover:bg-violet-100/70 text-violet-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>新しいリストを作成する</span>
          </button>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2">
          {onRestoreDefaultLists ? (
            <button
              type="button"
              onClick={onRestoreDefaultLists}
              className="text-[11px] text-slate-500 hover:text-violet-700 transition-colors font-semibold underline cursor-pointer"
            >
              初期リスト（行きたい場所・心リスト）を復元
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            完了
          </button>
        </div>
      </div>

      {/* リスト削除確認モーダル */}
      {listToDelete && (
        <ConfirmDeleteModal
          isOpen={!!listToDelete}
          title="リストの削除"
          itemName={listToDelete.name}
          description="※このリストに登録されていたスポット自体は削除されません。"
          confirmLabel="リストを削除"
          onConfirm={() => {
            onDeleteCustomList(listToDelete.id);
            setListToDelete(null);
          }}
          onCancel={() => setListToDelete(null)}
        />
      )}
    </div>
  );
};

