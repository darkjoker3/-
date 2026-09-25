import React, { useState } from 'react';
import { Spot, CustomList } from '../types';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { X, Plus, Check, Trash2, Edit3, ChevronUp, ChevronDown, GripVertical, Search } from 'lucide-react';

interface SpotListManagerModalProps {
  isOpen: boolean;
  spot: Spot | null;
  customLists: CustomList[];
  onClose: () => void;
  onToggleWantToGo: (spotId: string) => void;
  onToggleHaunted: (spotId: string) => void;
  onToggleCustomList: (spotId: string, listId: string) => void;
  onOpenCreateList: () => void;
  onEditCustomList?: (customList: CustomList) => void;
  onMoveCustomList?: (listId: string, direction: 'up' | 'down') => void;
  onReorderCustomLists?: (newLists: CustomList[]) => void;
  onDeleteCustomList?: (listId: string) => void;
}

export const SpotListManagerModal: React.FC<SpotListManagerModalProps> = ({
  isOpen,
  spot,
  customLists,
  onClose,
  onToggleWantToGo,
  onToggleHaunted,
  onToggleCustomList,
  onOpenCreateList,
  onEditCustomList,
  onMoveCustomList,
  onReorderCustomLists,
  onDeleteCustomList,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [listToDelete, setListToDelete] = useState<CustomList | null>(null);

  if (!isOpen || !spot) return null;

  const assignedListIds = spot.listIds || [];

  const isListAssigned = (customList: CustomList) => {
    if (customList.id === 'want_to_go') {
      return Boolean(spot.isWantToGo || assignedListIds.includes('want_to_go'));
    }
    if (customList.id === 'haunted') {
      return Boolean(spot.isHaunted ?? (spot.category === 'haunted' || assignedListIds.includes('haunted')));
    }
    return assignedListIds.includes(customList.id);
  };

  const assignedCount = customLists.filter(isListAssigned).length;
  const unassignedCount = customLists.length - assignedCount;

  const filteredLists = customLists.filter((cl) => {
    const assigned = isListAssigned(cl);
    if (filterTab === 'assigned' && !assigned) return false;
    if (filterTab === 'unassigned' && assigned) return false;
    if (searchQuery.trim() && !cl.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    const updated = [...customLists];
    const [moved] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, moved);

    if (onReorderCustomLists) {
      onReorderCustomLists(updated);
    } else if (onMoveCustomList) {
      const direction = targetIndex > draggedIndex ? 'down' : 'up';
      onMoveCustomList(moved.id, direction);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleToggleItem = (listId: string) => {
    if (listId === 'want_to_go') {
      onToggleWantToGo(spot.id);
      onToggleCustomList(spot.id, 'want_to_go');
    } else if (listId === 'haunted') {
      onToggleHaunted(spot.id);
      onToggleCustomList(spot.id, 'haunted');
    } else {
      onToggleCustomList(spot.id, listId);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <span>📋 リスト登録・管理</span>
            </h3>
            <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5" title={spot.title}>
              対象: <span className="font-semibold text-slate-700">{spot.title}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Tabs for quick selection */}
        <div className="px-4 pt-3 pb-2 border-b border-slate-100 bg-slate-50/40 flex flex-col gap-2">
          <div className="flex bg-slate-200/80 p-1 rounded-xl gap-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition-all text-center cursor-pointer ${
                filterTab === 'all'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              すべて ({customLists.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('assigned')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition-all text-center cursor-pointer ${
                filterTab === 'assigned'
                  ? 'bg-white text-violet-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              登録中 ({assignedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('unassigned')}
              className={`flex-1 py-1.5 px-2 rounded-lg transition-all text-center cursor-pointer ${
                filterTab === 'unassigned'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              未登録 ({unassignedCount})
            </button>
          </div>

          {customLists.length >= 4 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="リスト名を検索..."
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
          )}
        </div>

        {/* List of available lists */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          <div className="text-[11px] font-bold text-slate-400 mb-1 px-1 flex items-center justify-between">
            <span>クリックで登録/解除</span>
            {filterTab === 'all' && <span>ドラッグで並び替え</span>}
          </div>

          {filteredLists.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs">
              {searchQuery ? '検索条件に一致するリストがありません' : '該当するリストがありません'}
            </div>
          ) : (
            filteredLists.map((customList, index) => {
              const isAssigned = isListAssigned(customList);
              const originalIndex = customLists.findIndex((cl) => cl.id === customList.id);

              const isDragging = draggedIndex === originalIndex;
              const isDragOver = dragOverIndex === originalIndex;

              return (
                <div
                  key={`${customList.id}_${index}`}
                  draggable={filterTab === 'all'}
                  onDragStart={(e) => filterTab === 'all' && handleDragStart(e, originalIndex)}
                  onDragOver={(e) => filterTab === 'all' && handleDragOver(e, originalIndex)}
                  onDragLeave={() => {
                    if (dragOverIndex === originalIndex) setDragOverIndex(null);
                  }}
                  onDragEnd={() => {
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDrop={(e) => filterTab === 'all' && handleDrop(e, originalIndex)}
                  onClick={() => handleToggleItem(customList.id)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all group select-none ${
                    isDragging
                      ? 'opacity-30 border-dashed border-violet-400 scale-[0.98]'
                      : isDragOver
                      ? 'border-violet-500 ring-2 ring-violet-300 bg-violet-50/40'
                      : isAssigned
                      ? 'border-violet-300 ring-1 ring-violet-200'
                      : 'bg-white hover:bg-slate-50 border-slate-200'
                  }`}
                  style={{
                    backgroundColor: isAssigned ? `${customList.color}15` : undefined,
                    borderColor: isAssigned ? customList.color : undefined,
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                    {filterTab === 'all' && (
                      <div
                        className="cursor-grab active:cursor-grabbing p-0.5 text-slate-400 hover:text-slate-700 flex-shrink-0"
                        title="ドラッグして並び替え"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>
                    )}

                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                      style={{ backgroundColor: `${customList.color}25` }}
                    >
                      {customList.icon || '⭐'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 truncate flex items-center gap-1">
                        <span>{customList.name}</span>
                      </div>
                      {customList.description && (
                        <div className="text-[10px] text-slate-400 truncate">
                          {customList.description}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 操作アクション: 並び替え ▲▼, 編集 ✏️, 削除 🗑️, チェックボックス */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* 並び替え ▲▼ (すべてタブのときのみ) */}
                    {filterTab === 'all' && onMoveCustomList && (
                      <div className="flex items-center bg-slate-100 rounded-md p-0.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={originalIndex === 0}
                          onClick={() => onMoveCustomList(customList.id, 'up')}
                          className={`p-0.5 rounded text-slate-500 hover:text-slate-900 hover:bg-white transition-colors ${
                            originalIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                          title="上へ移動"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={originalIndex === customLists.length - 1}
                          onClick={() => onMoveCustomList(customList.id, 'down')}
                          className={`p-0.5 rounded text-slate-500 hover:text-slate-900 hover:bg-white transition-colors ${
                            originalIndex === customLists.length - 1 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                          title="下へ移動"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* 編集ボタン */}
                    {onEditCustomList && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditCustomList(customList);
                        }}
                        className="p-1 text-slate-400 hover:text-violet-700 hover:bg-violet-50 rounded transition-colors cursor-pointer"
                        title="リスト名を編集"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* 削除ボタン */}
                    {onDeleteCustomList && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setListToDelete(customList);
                        }}
                        className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer"
                        title="このリストを削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* チェックボックス */}
                    <div
                      className={`w-5 h-5 ml-1 rounded-md flex items-center justify-center border transition-colors ${
                        isAssigned ? 'text-white' : 'border-slate-300 bg-white'
                      }`}
                      style={{
                        backgroundColor: isAssigned ? customList.color : undefined,
                        borderColor: isAssigned ? customList.color : undefined,
                      }}
                    >
                      {isAssigned && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* 新規リスト作成ボタン */}
          <button
            type="button"
            onClick={onOpenCreateList}
            className="w-full mt-2 p-2.5 rounded-xl border border-dashed border-violet-300 bg-violet-50/50 hover:bg-violet-100/70 text-violet-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>新しいリストを作成する</span>
          </button>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
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
            if (onDeleteCustomList) {
              onDeleteCustomList(listToDelete.id);
            }
            setListToDelete(null);
          }}
          onCancel={() => setListToDelete(null)}
        />
      )}
    </div>
  );
};

