import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  Cloud,
  CloudCheck,
  CloudUpload,
  CloudDownload,
  RefreshCw,
  LogOut,
  ShieldCheck,
  AlertTriangle,
  X,
  Smartphone,
  Laptop,
  Trash2,
  Layers,
  MapPin,
  ListOrdered,
  FileCheck2,
} from 'lucide-react';
import { Spot, CustomCategory, CustomList } from '../types';
import { CloudSyncData, DriveFileMeta } from '../services/googleDriveService';
import { formatSyncTimestamp, getDeviceId } from '../utils/cloudSyncManager';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  isSyncing: boolean;
  lastSyncTime: number | null;
  cloudMeta: DriveFileMeta | null;
  cloudData: CloudSyncData | null;
  spots: Spot[];
  categories: CustomCategory[];
  customLists: CustomList[];
  autoSyncEnabled: boolean;
  onToggleAutoSync: (enabled: boolean) => void;
  onManualSync: () => Promise<void>;
  onRestoreFromCloud: () => Promise<void>;
  onForceOverwriteCloud: () => Promise<void>;
  onDeleteCloudFile: () => Promise<void>;
  hasPendingChanges: boolean;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSignIn,
  onSignOut,
  isSyncing,
  lastSyncTime,
  cloudMeta,
  cloudData,
  spots,
  categories,
  customLists,
  autoSyncEnabled,
  onToggleAutoSync,
  onManualSync,
  onRestoreFromCloud,
  onForceOverwriteCloud,
  onDeleteCloudFile,
  hasPendingChanges,
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [confirmModalType, setConfirmModalType] = useState<
    'restore' | 'overwrite_cloud' | 'delete_cloud' | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentDeviceId = getDeviceId();

  const handleSignInClick = async () => {
    setActionError(null);
    setIsSigningIn(true);
    try {
      await onSignIn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Googleログインに失敗しました';
      setActionError(msg);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOutClick = async () => {
    setActionError(null);
    try {
      await onSignOut();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'ログアウトに失敗しました';
      setActionError(msg);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmModalType) return;
    setActionError(null);
    const action = confirmModalType;
    setConfirmModalType(null);

    try {
      if (action === 'restore') {
        await onRestoreFromCloud();
      } else if (action === 'overwrite_cloud') {
        await onForceOverwriteCloud();
      } else if (action === 'delete_cloud') {
        await onDeleteCloudFile();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '処理に失敗しました';
      setActionError(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cloud-sync-modal-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Cloud className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h2 id="cloud-sync-modal-title" className="text-sm font-bold flex items-center gap-2">
                Google Drive クラウド同期
                <span className="text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full">
                  複数端末対応
                </span>
              </h2>
              <p className="text-[11px] text-slate-300">
                スマートフォン・PC間でスポットやリストを自動同期
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
          {actionError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold">エラーが発生しました</p>
                <p className="text-[11px] mt-0.5">{actionError}</p>
              </div>
            </div>
          )}

          {/* 1. Account Section */}
          {!currentUser ? (
            <div className="p-4 bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-100 rounded-2xl flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-blue-200/60 flex items-center justify-center text-blue-600">
                <CloudUpload className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Google Driveと連携してデータを保存
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-sm leading-relaxed">
                  Googleアカウントでログインすると、登録したスポットや写真、カスタムカテゴリ、マイリストが自動でGoogle Driveにバックアップされ、スマホや他のPCからでも最新データを共有・閲覧できます。
                </p>
              </div>

              {/* Official Google Sign-In Button */}
              <button
                type="button"
                onClick={handleSignInClick}
                disabled={isSigningIn}
                className="mt-1 inline-flex items-center gap-3 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isSigningIn ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Google認証中...</span>
                  </>
                ) : (
                  <>
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      className="w-4 h-4"
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                      <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                    <span>Googleアカウントでログインして同期</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'Google User'}
                    className="w-10 h-10 rounded-full border border-slate-200 shadow-2xs"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-2xs">
                    {(currentUser.displayName || currentUser.email || 'G').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-900 text-xs">
                      {currentUser.displayName || 'Google ユーザー'}
                    </p>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded-full border border-emerald-200 font-semibold">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      接続中
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono">{currentUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOutClick}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-white text-slate-600 hover:text-red-600 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="ログアウト"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>ログアウト</span>
              </button>
            </div>
          )}

          {/* 2. Sync Status Card */}
          {currentUser && (
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-violet-600" />
                  同期ステータス
                </span>

                {isSyncing ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-bold text-[11px] animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                    同期中...
                  </span>
                ) : hasPendingChanges ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-bold text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    未同期の変更あり
                  </span>
                ) : lastSyncTime ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold text-[11px]">
                    <CloudCheck className="w-3.5 h-3.5 text-emerald-600" />
                    同期完了
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-full font-bold text-[11px]">
                    未同期
                  </span>
                )}
              </div>

              {/* Timestamp & Device */}
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px]">最終同期日時</span>
                  <span className="font-semibold text-slate-800">
                    {lastSyncTime ? formatSyncTimestamp(lastSyncTime) : '未実行'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">現在の端末ID</span>
                  <span className="font-mono text-slate-700 font-semibold truncate block">
                    {currentDeviceId}
                  </span>
                </div>
              </div>

              {/* Data Count Comparison Table */}
              <div className="border border-slate-100 rounded-xl overflow-hidden text-[11px]">
                <div className="grid grid-cols-3 bg-slate-100/80 px-3 py-1.5 font-bold text-slate-600 border-b border-slate-200 text-center">
                  <div className="text-left">データ項目</div>
                  <div>この端末</div>
                  <div>Google Drive</div>
                </div>
                <div className="grid grid-cols-3 px-3 py-2 border-b border-slate-100 text-center items-center">
                  <div className="text-left flex items-center gap-1.5 font-semibold text-slate-800">
                    <MapPin className="w-3.5 h-3.5 text-red-500" />
                    スポット件数
                  </div>
                  <div className="font-bold text-slate-900">{spots.length}件</div>
                  <div className="font-bold text-blue-700">
                    {cloudData ? `${cloudData.spots?.length ?? 0}件` : '-'}
                  </div>
                </div>
                <div className="grid grid-cols-3 px-3 py-2 border-b border-slate-100 text-center items-center">
                  <div className="text-left flex items-center gap-1.5 font-semibold text-slate-800">
                    <Layers className="w-3.5 h-3.5 text-amber-500" />
                    カテゴリ数
                  </div>
                  <div className="font-bold text-slate-900">{categories.length}個</div>
                  <div className="font-bold text-blue-700">
                    {cloudData ? `${cloudData.categories?.length ?? 0}個` : '-'}
                  </div>
                </div>
                <div className="grid grid-cols-3 px-3 py-2 text-center items-center">
                  <div className="text-left flex items-center gap-1.5 font-semibold text-slate-800">
                    <ListOrdered className="w-3.5 h-3.5 text-violet-500" />
                    マイリスト数
                  </div>
                  <div className="font-bold text-slate-900">{customLists.length}個</div>
                  <div className="font-bold text-blue-700">
                    {cloudData ? `${cloudData.customLists?.length ?? 0}個` : '-'}
                  </div>
                </div>
              </div>

              {/* Cloud File Info */}
              {cloudMeta && (
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <span>保存先ファイル: Google Drive / {cloudMeta.name}</span>
                  {cloudData?.updatedByDevice && (
                    <span className="text-slate-500">
                      (最終更新元: {cloudData.updatedByDevice})
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          {/* 3. Auto Sync Setting */}
          {currentUser && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 text-xs block">
                  バックグラウンド自動同期
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  スポットの追加や編集時にクラウドへ自動保存し、他端末の更新を反映
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-3 flex-shrink-0">
                <input
                  type="checkbox"
                  checked={autoSyncEnabled}
                  onChange={(e) => onToggleAutoSync(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          )}

          {/* 4. Action Buttons */}
          {currentUser && (
            <div className="space-y-2 pt-1">
              {/* Primary: Smart Merge Sync */}
              <button
                type="button"
                onClick={onManualSync}
                disabled={isSyncing}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>今すぐ同期（スマート統合）</span>
              </button>
              <p className="text-[10px] text-slate-400 text-center">
                ※端末とクラウドの変更を自動でマージし、互いのデータを統合します
              </p>

              {/* Secondary Actions Collapsible / Row */}
              <div className="pt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmModalType('restore')}
                  disabled={isSyncing || !cloudData}
                  className="py-2 px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-40"
                  title="クラウドのデータで現在の端末を上書き"
                >
                  <CloudDownload className="w-3.5 h-3.5 text-blue-600" />
                  <span>クラウドから復元</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmModalType('overwrite_cloud')}
                  disabled={isSyncing}
                  className="py-2 px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-40"
                  title="現在の端末データでクラウドを強制上書き"
                >
                  <CloudUpload className="w-3.5 h-3.5 text-indigo-600" />
                  <span>クラウドを上書き</span>
                </button>
              </div>

              {/* Delete Cloud Backup Button */}
              {cloudMeta && (
                <div className="pt-2 text-right">
                  <button
                    type="button"
                    onClick={() => setConfirmModalType('delete_cloud')}
                    disabled={isSyncing}
                    className="text-[10px] text-red-600 hover:text-red-700 hover:underline inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Google Drive上の同期データを削除</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Privacy Note */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2 text-[10px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              データは安全にお客様個人のGoogle Drive内（<code>japan_road_spots_sync.json</code>）に保存されます。このアプリのアクセス権限はアプリが作成したファイルのみに制限されており、他のファイルへのアクセスや第三者への公開は一切行われません。
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>

      {/* Confirmation Sub-Modal for Destructive / Mutating Actions */}
      {confirmModalType && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {confirmModalType === 'restore'
                    ? 'クラウドから端末を復元しますか？'
                    : confirmModalType === 'overwrite_cloud'
                    ? 'クラウドデータを上書きしますか？'
                    : 'クラウドデータを削除しますか？'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {confirmModalType === 'restore'
                    ? '現在の端末のデータがGoogle Drive上のデータで置き換えられます。'
                    : confirmModalType === 'overwrite_cloud'
                    ? 'Google Drive上の同期データが、現在の端末のデータで上書き保存されます。'
                    : 'Google Drive上の同期ファイル「japan_road_spots_sync.json」が削除されます。'}
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 leading-relaxed">
              {confirmModalType === 'restore' &&
                `クラウド上のデータ（スポット ${cloudData?.spots?.length ?? 0}件）で現在の端末（${spots.length}件）を上書きします。未保存の変更は失われる場合があります。`}
              {confirmModalType === 'overwrite_cloud' &&
                `現在の端末データ（スポット ${spots.length}件）をGoogle Driveへ書き込みます。他の端末のデータが古い場合は更新されます。`}
              {confirmModalType === 'delete_cloud' &&
                `クラウド上の同期ファイルのみが削除されます。現在の端末にあるデータ（${spots.length}件）はそのまま保持されます。`}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmModalType(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-500/20 cursor-pointer transition-all"
              >
                {confirmModalType === 'restore'
                  ? '復元を実行'
                  : confirmModalType === 'overwrite_cloud'
                  ? '上書き保存を実行'
                  : '削除を実行'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
