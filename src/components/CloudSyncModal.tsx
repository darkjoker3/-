import React, { useState, useEffect } from 'react';
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
  ExternalLink,
  Users,
  Copy,
  Check,
  Share2,
  Link2,
  Key,
  Sparkles,
  ArrowRight,
  Radio,
} from 'lucide-react';
import { Spot, CustomCategory, CustomList } from '../types';
import { CloudSyncData, DriveFileMeta, SYNC_FILE_NAME } from '../services/googleDriveService';
import { formatSyncTimestamp, getDeviceId } from '../utils/cloudSyncManager';
import { PasscodeRoomInfo, generateFriendlyPasscode } from '../services/passcodeSyncService';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  hasToken?: boolean;
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
  // Passcode specific props
  activePasscode?: string | null;
  isPasscodeOwner?: boolean;
  passcodeRoomInfo?: PasscodeRoomInfo | null;
  onRegisterPasscode?: (code: string) => Promise<{ ok: boolean; error?: string }>;
  onJoinPasscode?: (code: string) => Promise<{ ok: boolean; error?: string }>;
  onLeavePasscode?: () => void;
  onRefreshPasscodeData?: () => Promise<void>;
  defaultModalTab?: 'drive' | 'passcode';
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  hasToken = true,
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
  activePasscode,
  isPasscodeOwner,
  passcodeRoomInfo,
  onRegisterPasscode,
  onJoinPasscode,
  onLeavePasscode,
  onRefreshPasscodeData,
  defaultModalTab = 'drive',
}) => {
  const [activeModalTab, setActiveModalTab] = useState<'drive' | 'passcode'>('drive');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [confirmModalType, setConfirmModalType] = useState<
    'restore' | 'overwrite_cloud' | 'delete_cloud' | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Passcode tab local states
  const [inputPasscode, setInputPasscode] = useState('');
  const [customPasscode, setCustomPasscode] = useState('');
  const [isPasscodeLoading, setIsPasscodeLoading] = useState(false);
  const [passcodeMessage, setPasscodeMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (defaultModalTab) {
        setActiveModalTab(defaultModalTab);
      } else if (activePasscode && !currentUser) {
        setActiveModalTab('passcode');
      }
    }
  }, [isOpen, defaultModalTab, activePasscode, currentUser]);

  if (!isOpen) return null;

  const currentDeviceId = getDeviceId();

  const handleSignInClick = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setActionError(null);
    setIsSigningIn(true);
    onSignIn()
      .catch((err: unknown) => {
        console.error('Sign in error:', err);
        const errCode = (err as any)?.code || '';
        const errMsg = String((err as any)?.message || '');
        if (errCode === 'auth/popup-blocked' || errMsg.includes('popup-blocked')) {
          setActionError('popup_blocked');
        } else {
          setActionError(err instanceof Error ? err.message : 'Googleログインに失敗しました');
        }
      })
      .finally(() => {
        setIsSigningIn(false);
      });
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

  // Copy shareable link for friend
  const handleCopyInviteLink = async (code: string) => {
    try {
      const baseUrl = window.location.origin + window.location.pathname;
      const shareUrl = `${baseUrl}?passcode=${encodeURIComponent(code)}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setPasscodeMessage({ text: '友達用の招待リンクをクリップボードにコピーしました！LINE等で送信できます', type: 'success' });
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      setPasscodeMessage({ text: 'リンクのコピーに失敗しました', type: 'error' });
    }
  };

  const handleCopyPasscodeOnly = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setPasscodeMessage({ text: `合言葉「${code}」をコピーしました`, type: 'success' });
      setTimeout(() => setCopiedCode(false), 3000);
    } catch {
      setPasscodeMessage({ text: '合言葉のコピーに失敗しました', type: 'error' });
    }
  };

  // Owner registers or updates passcode
  const handleOwnerEnablePasscode = async (codeToUse?: string) => {
    if (!onRegisterPasscode) return;
    setPasscodeMessage(null);
    setIsPasscodeLoading(true);
    const code = codeToUse || activePasscode || generateFriendlyPasscode();
    try {
      const res = await onRegisterPasscode(code);
      if (res.ok) {
        setPasscodeMessage({
          text: `合言葉「${code}」を発行しました！友達が入力するとあなたのGoogleドライブに自動保存されます`,
          type: 'success',
        });
      } else {
        setPasscodeMessage({ text: res.error || '合言葉の有効化に失敗しました', type: 'error' });
      }
    } finally {
      setIsPasscodeLoading(false);
    }
  };

  // Friend joins with passcode
  const handleFriendJoin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!onJoinPasscode) return;
    const clean = inputPasscode.trim().toUpperCase();
    if (!clean) {
      setPasscodeMessage({ text: '合言葉を入力してください', type: 'error' });
      return;
    }
    setPasscodeMessage(null);
    setIsPasscodeLoading(true);
    try {
      const res = await onJoinPasscode(clean);
      if (res.ok) {
        setInputPasscode('');
        setPasscodeMessage({
          text: `合言葉「${clean}」で接続しました！あなたの登録・編集は友達のGoogleドライブに自動保存されます`,
          type: 'success',
        });
      } else {
        setPasscodeMessage({ text: res.error || '接続に失敗しました。合言葉をご確認ください', type: 'error' });
      }
    } finally {
      setIsPasscodeLoading(false);
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
                Google Drive クラウド連携 & 自動保存
                <span className="text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full">
                  友達共有対応
                </span>
              </h2>
              <p className="text-[11px] text-slate-300">
                スマートフォン・PC間同期 & 友達との合言葉自動保存
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

        {/* Tab Switcher */}
        <div className="px-5 pt-3 border-b border-slate-200 bg-slate-50/80 flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveModalTab('drive')}
            className={`pb-2.5 px-3 font-bold text-xs border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeModalTab === 'drive'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Google Drive（個人同期）</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveModalTab('passcode')}
            className={`pb-2.5 px-3 font-bold text-xs border-b-2 flex items-center gap-1.5 transition-all cursor-pointer relative ${
              activeModalTab === 'passcode'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            <span>合言葉で友達と共有（自動保存）</span>
            {activePasscode ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" title="合言葉接続中"></span>
            ) : (
              <span className="text-[9px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.2 rounded-full ml-0.5">
                おすすめ
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
          {actionError === 'popup_blocked' ? (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-amber-800 text-xs sm:text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>ブラウザのポップアップがブロックされました</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Googleログイン認証画面を開くため、ブラウザのポップアップ許可が必要です。
              </p>
              <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200 text-[11px] text-slate-700 space-y-1">
                <div className="font-bold text-slate-800">【許可の手順】</div>
                <div>1. ブラウザのURL欄（アドレスバー右端）にある 🚫 アイコンをクリック</div>
                <div>2. 「このサイトのポップアップとリダイレクトを常に許可」を選択して「完了」を押す</div>
                <div>3. 下の「許可後に再試行」ボタンをクリックしてください</div>
              </div>
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <button
                  type="button"
                  onClick={handleSignInClick}
                  disabled={isSigningIn}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold rounded-lg transition-colors cursor-pointer text-xs flex items-center gap-1.5 shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSigningIn ? 'animate-spin' : ''}`} />
                  <span>許可後に再試行</span>
                </button>
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-300 transition-colors cursor-pointer text-xs flex items-center gap-1.5 shadow-2xs"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                  <span>別タブ（全画面）で開いてログイン</span>
                </a>
              </div>
            </div>
          ) : actionError ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold">エラーが発生しました</p>
                <p className="text-[11px] mt-0.5">{actionError}</p>
              </div>
            </div>
          ) : null}

          {/* ========================================================= */}
          {/* TAB 1: Google Drive 個人同期                              */}
          {/* ========================================================= */}
          {activeModalTab === 'drive' && (
            <div className="space-y-4 animate-in fade-in duration-150">
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
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                  <div className="flex items-center gap-3 min-w-0">
                    {currentUser.photoURL ? (
                      <img
                        src={currentUser.photoURL}
                        alt={currentUser.displayName || 'Google User'}
                        className="w-10 h-10 rounded-full border border-slate-200 shadow-2xs flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-2xs flex-shrink-0">
                        {(currentUser.displayName || currentUser.email || 'G').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-900 text-xs truncate">
                          {currentUser.displayName || 'Google ユーザー'}
                        </p>
                        {hasToken ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded-full border border-emerald-200 font-semibold">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            接続中
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-800 bg-amber-100 px-2 py-0.2 rounded-full border border-amber-300 font-bold">
                            要トークン再取得
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono truncate">{currentUser.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!hasToken && (
                      <button
                        type="button"
                        onClick={handleSignInClick}
                        disabled={isSigningIn}
                        className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        title="Google Driveアクセストークンを再取得して同期を再開"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSigningIn ? 'animate-spin' : ''}`} />
                        <span>同期を再開</span>
                      </button>
                    )}
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
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold text-[11px]">
                        <CloudCheck className="w-3.5 h-3.5 text-emerald-600" />
                        最新状態
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-100">
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-slate-400 block text-[10px]">現在の端末</span>
                      <span className="font-semibold text-slate-700 flex items-center gap-1 mt-0.5">
                        {currentDeviceId.startsWith('📱') ? (
                          <Smartphone className="w-3 h-3 text-slate-500" />
                        ) : (
                          <Laptop className="w-3 h-3 text-slate-500" />
                        )}
                        <span className="truncate">{currentDeviceId}</span>
                      </span>
                      <span className="text-slate-500 block text-[10px] mt-1">
                        スポット: <strong className="text-slate-800 font-mono">{spots.length}</strong> 件
                      </span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <span className="text-slate-400 block text-[10px]">最終同期日時</span>
                      <span className="font-semibold text-slate-700 block mt-0.5 truncate">
                        {lastSyncTime ? formatSyncTimestamp(lastSyncTime) : '未同期'}
                      </span>
                      {cloudData && (
                        <span className="text-slate-500 block text-[10px] mt-1 truncate">
                          クラウド側: <strong className="text-slate-800 font-mono">{cloudData.spotsCount}</strong> 件
                        </span>
                      )}
                    </div>
                  </div>

                  {cloudMeta?.webViewLink && (
                    <div className="pt-1 text-right">
                      <a
                        href={cloudMeta.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Google Driveでファイルを開く</span>
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Google Drive API Auto-Save Setting */}
              {currentUser && (
                <div className="p-3.5 bg-gradient-to-r from-blue-50/90 via-indigo-50/40 to-slate-50 border border-blue-200 rounded-2xl flex items-center justify-between shadow-2xs">
                  <div>
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5 flex-wrap">
                      <CloudCheck className="w-4 h-4 text-blue-600" />
                      <span>Google Drive API 自動保存</span>
                      <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.2 rounded-full border border-blue-200">
                        リアルタイム
                      </span>
                    </span>
                    <span className="text-[11px] text-slate-600 block mt-1 leading-relaxed">
                      スポットの追加・編集・削除時やマイリスト更新時に、Google Drive（<code>{SYNC_FILE_NAME}</code>）へ自動でリアルタイム上書き保存します
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-3 flex-shrink-0" title="Google Drive API自動保存のON/OFF">
                    <input
                      type="checkbox"
                      checked={autoSyncEnabled}
                      onChange={(e) => onToggleAutoSync(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
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
                  データは安全にお客様個人のGoogle Drive内（<code>{SYNC_FILE_NAME}</code>）に保存されます。
                </p>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: 合言葉で友達と共有・自動保存                      */}
          {/* ========================================================= */}
          {activeModalTab === 'passcode' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Feedback Alert */}
              {passcodeMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-start gap-2 border animate-in fade-in ${
                    passcodeMessage.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {passcodeMessage.type === 'success' ? (
                    <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  )}
                  <span className="leading-relaxed">{passcodeMessage.text}</span>
                </div>
              )}

              {/* Explainer Hero */}
              <div className="p-4 bg-gradient-to-br from-indigo-50/90 via-purple-50/40 to-slate-50 border border-indigo-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      合言葉（パスコード）自動保存
                    </h3>
                    <p className="text-[11px] text-indigo-700 font-semibold">
                      友達はGoogleログイン不要で、あなたのGoogleドライブに自動保存！
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed pt-1">
                  あなたが合言葉（または招待URL）を発行して友達に送るだけで、友達のスマホから追加・編集されたスポットも<strong>あなたのGoogleドライブにリアルタイム自動保存</strong>されます。ツーリングや旅行での共同記録に最適です。
                </p>
              </div>

              {/* CASE A: Owner is logged in with Google */}
              {currentUser ? (
                <div className="space-y-3">
                  {/* Current Active Passcode Card */}
                  <div className="p-4 bg-white border-2 border-indigo-100 rounded-2xl shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-indigo-600" />
                        発行中の合言葉
                      </span>
                      {activePasscode ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          自動保存受付中
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">未発行</span>
                      )}
                    </div>

                    {activePasscode ? (
                      <div>
                        <div className="flex items-center justify-between bg-slate-900 text-white p-3.5 rounded-xl font-mono text-xl sm:text-2xl font-black tracking-widest border border-slate-800 shadow-inner">
                          <span className="select-all text-indigo-300">{activePasscode}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyPasscodeOnly(activePasscode)}
                            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-sans font-bold flex items-center gap-1 transition-all cursor-pointer"
                            title="合言葉をコピー"
                          >
                            {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                            <span className="text-[11px]">{copiedCode ? 'コピー完了' : 'コピー'}</span>
                          </button>
                        </div>

                        {/* Quick Action Share Buttons */}
                        <div className="grid grid-cols-2 gap-2 pt-3">
                          <button
                            type="button"
                            onClick={() => handleCopyInviteLink(activePasscode)}
                            className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                          >
                            {copiedLink ? <Check className="w-4 h-4 text-emerald-300" /> : <Share2 className="w-4 h-4" />}
                            <span>{copiedLink ? 'リンクコピー完了' : '招待リンクをコピー'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const newCode = generateFriendlyPasscode();
                              handleOwnerEnablePasscode(newCode);
                            }}
                            disabled={isPasscodeLoading}
                            className="py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            <span>新しい合言葉を再発行</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-3 space-y-2">
                        <p className="text-xs text-slate-600">
                          合言葉を発行すると、友達がログイン不要であなたのGoogleドライブに保存できるようになります。
                        </p>
                        <button
                          type="button"
                          onClick={() => handleOwnerEnablePasscode()}
                          disabled={isPasscodeLoading}
                          className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 inline-flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>合言葉を発行して受付開始</span>
                        </button>
                      </div>
                    )}

                    {/* Room Info details */}
                    {activePasscode && (
                      <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                        <div className="flex justify-between items-center">
                          <span>保存先のGoogleドライブ:</span>
                          <span className="font-mono text-slate-700 font-semibold truncate max-w-[180px]">
                            {currentUser.email}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>現在の共有スポット数:</span>
                          <span className="font-mono text-slate-800 font-bold">{spots.length} 件</span>
                        </div>
                        {passcodeRoomInfo?.lastDriveSavedAt && (
                          <div className="flex justify-between items-center">
                            <span>Google Drive最終自動保存:</span>
                            <span className="text-slate-600">
                              {formatSyncTimestamp(passcodeRoomInfo.lastDriveSavedAt)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Custom Passcode Setting Input */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                      お好きな合言葉にカスタマイズ（英数字・ハイフン）
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={customPasscode}
                        onChange={(e) => setCustomPasscode(e.target.value.toUpperCase())}
                        placeholder="例: TOURING-2026"
                        className="flex-1 px-3 py-2 text-xs font-mono font-bold uppercase rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        maxLength={24}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const clean = customPasscode.trim().toUpperCase();
                          if (clean) {
                            handleOwnerEnablePasscode(clean);
                            setCustomPasscode('');
                          }
                        }}
                        disabled={!customPasscode.trim() || isPasscodeLoading}
                        className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs disabled:opacity-40 cursor-pointer transition-colors"
                      >
                        変更
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* CASE B: Friend view (Not logged in with Google, or joining friend's room) */
                <div className="space-y-3">
                  {activePasscode ? (
                    /* Friend is currently connected */
                    <div className="p-4 bg-white border-2 border-emerald-200 rounded-2xl shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                          <Check className="w-4 h-4 text-emerald-600" />
                          友達のGoogleドライブに接続中
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold font-mono">
                          {activePasscode}
                        </span>
                      </div>

                      <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-100 text-[11px] text-emerald-900 space-y-1">
                        <p className="font-bold">
                          🚗 あなたの操作は友達のGoogleドライブへ自動保存されます
                        </p>
                        <p className="text-emerald-700 leading-relaxed">
                          スポットの追加、訪問チェック、写真メモ、マイリストの変更を行うと、自動的に友達のドライブファイルへリアルタイム上書きされます。
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                        <div className="bg-slate-50 p-2.5 rounded-xl">
                          <span className="text-slate-400 block text-[10px]">現在のスポット数</span>
                          <span className="font-bold text-slate-800 font-mono text-sm">
                            {spots.length} 件
                          </span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl">
                          <span className="text-slate-400 block text-[10px]">最終同期</span>
                          <span className="font-semibold text-slate-700 block mt-0.5 truncate">
                            {lastSyncTime ? formatSyncTimestamp(lastSyncTime) : '同期完了'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        {onRefreshPasscodeData && (
                          <button
                            type="button"
                            onClick={onRefreshPasscodeData}
                            disabled={isSyncing}
                            className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
                            <span>最新データを再取得</span>
                          </button>
                        )}
                        {onLeavePasscode && (
                          <button
                            type="button"
                            onClick={onLeavePasscode}
                            className="py-2 px-3 rounded-xl border border-slate-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-slate-600 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          >
                            <span>接続解除</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Friend is NOT connected yet */
                    <form onSubmit={handleFriendJoin} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">
                          友達から教えてもらった合言葉を入力
                        </label>
                        <p className="text-[11px] text-slate-500 mb-2">
                          合言葉を入力すると、友達がGoogle Driveに保存しているスポットデータが読み込まれ、以後の編集も自動保存されます。
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={inputPasscode}
                            onChange={(e) => setInputPasscode(e.target.value.toUpperCase())}
                            placeholder="例: ROAD-8823"
                            className="flex-1 px-3.5 py-2.5 text-sm font-mono font-bold tracking-wider uppercase rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            maxLength={30}
                            autoFocus
                          />
                          <button
                            type="submit"
                            disabled={!inputPasscode.trim() || isPasscodeLoading}
                            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 disabled:opacity-40 cursor-pointer flex items-center gap-1.5 transition-all"
                          >
                            {isPasscodeLoading ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ArrowRight className="w-3.5 h-3.5" />
                            )}
                            <span>接続して開始</span>
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* How it works 4-step Guide */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <span className="font-bold text-slate-800 text-[11px] block">
                  💡 合言葉自動保存のしくみ
                </span>
                <ol className="text-[11px] text-slate-600 space-y-1.5 list-decimal pl-4 leading-relaxed">
                  <li>
                    <strong>オーナー（あなた）:</strong> Googleログイン後、合言葉を発行して「招待リンク」をLINE等で友達に送信します。
                  </li>
                  <li>
                    <strong>友達:</strong> 招待リンクを開くだけ（<strong>Googleログイン不要！</strong>）。
                  </li>
                  <li>
                    <strong>自動同期:</strong> 友達が追加・編集・削除したスポットは、サーバーを経由してリアルタイムにあなたのGoogleドライブへ上書き保存されます。
                  </li>
                  <li>
                    <strong>安心設計:</strong> あなたと友達の変更はタイムスタンプで自動統合（マージ）されるため、上書きによる消失を防ぎます。
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between flex-shrink-0">
          <div className="text-[10px] text-slate-400">
            {activePasscode ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                合言葉同期: {activePasscode}
              </span>
            ) : (
              <span>合言葉未接続</span>
            )}
          </div>
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
