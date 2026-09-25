import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Download,
  Share2,
  Copy,
  Check,
  X,
  Laptop,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Compass
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallPwaModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: BeforeInstallPromptEvent | null;
  onInstalled: () => void;
}

export const InstallPwaModal: React.FC<InstallPwaModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onInstalled,
}) => {
  const [copied, setCopied] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = window.navigator.userAgent.toLowerCase();
      const isIPhoneOrIPad = /iphone|ipad|ipod/.test(ua);
      const isAndroidDevice = /android/.test(ua);
      setIsIOS(isIPhoneOrIPad);
      setIsAndroid(isAndroidDevice);

      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalone(standalone);
    }
  }, []);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleCopyUrl = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(currentUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = currentUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: '日本地図ピン＆下道ナビマップ',
          text: '心霊スポットや全国の名所をピン留めして下道ルート・距離・所要時間を一括計算できる日本地図Webアプリ',
          url: currentUrl,
        });
      } catch (err) {
        console.log('Share canceled or failed', err);
      }
    } else {
      handleCopyUrl();
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          onInstalled();
          onClose();
        }
      } catch (err) {
        console.error('Install prompt error:', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-violet-700 via-indigo-600 to-violet-800 text-white flex items-center justify-between relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl shadow-inner border border-white/30">
              📱
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <span>Webアプリとして使う・追加する</span>
                <span className="text-[10px] font-semibold bg-white/25 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  PWA対応
                </span>
              </h2>
              <p className="text-xs text-violet-100 mt-0.5">
                スマートフォンやパソコンのホーム画面に追加して単体アプリとして起動できます
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-slate-700 text-xs sm:text-sm">
          {/* Status Banner */}
          {isStandalone ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-800 font-bold text-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>
                現在、ホーム画面に追加されたスタンドアローンWebアプリとして起動しています！
              </span>
            </div>
          ) : (
            <div className="p-3.5 bg-violet-50/80 border border-violet-200/80 rounded-xl">
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 leading-relaxed">
                  このアプリは<strong>PWA (Progressive Web App)</strong>
                  に対応しており、アプリストアを経由せずに<strong>直接ホーム画面に追加</strong>
                  してネイティブアプリと同じように全画面でご利用いただけます。
                </div>
              </div>
            </div>
          )}

          {/* Quick Install Action (Android / Chrome / Edge) */}
          {deferredPrompt && !isStandalone && (
            <div className="p-4 bg-gradient-to-br from-violet-600 to-indigo-700 rounded-xl text-white shadow-md space-y-2">
              <div className="font-bold text-sm flex items-center gap-2">
                <Download className="w-4 h-4 text-cyan-300" />
                <span>ワンタップでホーム画面・PCに追加</span>
              </div>
              <p className="text-xs text-violet-100">
                ブラウザのインストール機能を使って、今すぐ端末にアプリアイコンを作成できます。
              </p>
              <button
                id="pwa-install-trigger-btn"
                onClick={handleInstallClick}
                className="w-full py-2.5 bg-white hover:bg-violet-50 text-violet-800 font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <Smartphone className="w-4 h-4 text-violet-700" />
                <span>端末にインストール（ホーム画面に追加）</span>
              </button>
            </div>
          )}

          {/* Platform Specific Step-by-Step Instructions */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
              <span>端末別のホーム画面追加手順</span>
            </h3>

            {/* iOS Safari Guide */}
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                isIOS
                  ? 'bg-blue-50/60 border-blue-300 ring-2 ring-blue-500/20'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="font-bold text-xs text-slate-900 flex items-center gap-2 mb-2">
                <span className="text-base">🍎</span>
                <span>iPhone / iPad (Safari) の場合</span>
                {isIOS && (
                  <span className="text-[10px] bg-blue-600 text-white px-2 py-0.2 rounded-full font-bold">
                    お使いの端末
                  </span>
                )}
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-600 pl-1">
                <li>
                  SafariでこのWebページを開き、下部の<strong>「共有」ボタン</strong>
                  （四角から上矢印 <span className="inline-block px-1 bg-slate-200 rounded text-[11px]">⎋</span>）をタップします。
                </li>
                <li>
                  メニューを少しスクロールし、<strong>「ホーム画面に追加」</strong>
                  （<span className="inline-block px-1 bg-slate-200 rounded text-[11px]">⊞</span>）をタップします。
                </li>
                <li>
                  右上の<strong>「追加」</strong>をタップすると、ホーム画面に専用アイコンが配置され、次回から全画面で起動できます。
                </li>
              </ol>
            </div>

            {/* Android Chrome Guide */}
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                isAndroid
                  ? 'bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-500/20'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="font-bold text-xs text-slate-900 flex items-center gap-2 mb-2">
                <span className="text-base">🤖</span>
                <span>Android (Chrome) の場合</span>
                {isAndroid && (
                  <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.2 rounded-full font-bold">
                    お使いの端末
                  </span>
                )}
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-600 pl-1">
                <li>
                  Chrome右上のメニューボタン（<span className="font-bold">︙</span> 3点リーダー）をタップします。
                </li>
                <li>
                  <strong>「アプリをインストール」</strong>または<strong>「ホーム画面に追加」</strong>を選択します。
                </li>
                <li>
                  画面の指示に従ってインストールを完了すると、スマホのアプリ一覧・ホーム画面に登録されます。
                </li>
              </ol>
            </div>

            {/* PC Chrome / Edge / Mac Guide */}
            <div className="p-3.5 rounded-xl border bg-slate-50 border-slate-200">
              <div className="font-bold text-xs text-slate-900 flex items-center gap-2 mb-2">
                <Laptop className="w-4 h-4 text-slate-700" />
                <span>パソコン (Chrome / Edge / Mac) の場合</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                ブラウザのアドレスバー右端に表示される<strong>「インストール」アイコン</strong>
                （モニターと下矢印のマーク）をクリックするか、ブラウザメニューから「アプリをインストール」を選択すると、独立したウィンドウでPCアプリとして起動できます。
              </p>
            </div>
          </div>

          {/* Web App URL & Sharing Section */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="font-bold text-xs text-slate-900 flex items-center justify-between">
              <span>このWebアプリのURL</span>
              <span className="text-[11px] text-slate-500 font-normal">スマホ等へ送信</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={currentUrl}
                className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-700 select-all focus:outline-none"
              />
              <button
                onClick={handleCopyUrl}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-violet-600 hover:bg-violet-700 text-white'
                }`}
                title="URLをクリップボードにコピー"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'コピー済' : 'コピー'}</span>
              </button>
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  onClick={handleShare}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                  title="スマホで共有"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>共有</span>
                </button>
              )}
            </div>
          </div>

          {/* PWA Benefits Checklist */}
          <div className="p-3 rounded-xl bg-violet-50/50 border border-violet-100">
            <div className="text-[11px] font-bold text-violet-900 mb-1.5">
              ✨ Webアプリ（ホーム画面追加）のメリット:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="text-violet-600 font-bold">✓</span>
                <span>ブラウザ枠が消えて全画面の広い地図</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-violet-600 font-bold">✓</span>
                <span>ホーム画面から1タップで即時起動</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-violet-600 font-bold">✓</span>
                <span>端末のGPS現在地と完全連動</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-violet-600 font-bold">✓</span>
                <span>オフライン・高速キャッシュ動作</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
