import React, { useState, useEffect, useRef } from 'react';
import { Spot, SpotPhoto, CustomCategory, ReferenceUrl, CustomList, SpotListTab, UserLocation } from '../types';
import {
  parseAndResolveMapInput,
  parseGoogleMapsUrl,
  geocodeAddressOrPlace,
  reverseGeocode,
  isGoogleMapsShortLink,
  extractPrefectureFromAddress,
  isValidLatLng
} from '../utils/mapParser';
import { processImageFile, createPhotoObject } from '../utils/imageUtils';
import { JAPAN_PREFECTURES, INITIAL_CATEGORIES, PREFECTURE_CENTERS } from '../data/sampleSpots';
import { generateYomigana } from '../utils/yomiganaUtils';
import {
  X,
  Link,
  Search,
  MapPin,
  Upload,
  Plus,
  Trash2,
  Star,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  ExternalLink,
  Settings2,
  Check,
  Tag,
  Compass,
  Camera,
} from 'lucide-react';

interface SpotFormModalProps {
  isOpen: boolean;
  initialSpot?: Spot | null;
  initialLatLng?: { lat: number; lng: number } | null;
  categories: CustomCategory[];
  customLists?: CustomList[];
  activeTab?: SpotListTab;
  selectedPrefecture?: string;
  onOpenCategoryManager?: () => void;
  onClose: () => void;
  onSave: (spotData: Omit<Spot, 'id' | 'createdAt' | 'updatedAt'>, editId?: string) => void;
  onRequestPickOnMap?: () => void;
  userLocation?: UserLocation | null;
}

export const SpotFormModal: React.FC<SpotFormModalProps> = ({
  isOpen,
  initialSpot,
  initialLatLng,
  categories = INITIAL_CATEGORIES,
  customLists = [],
  activeTab,
  selectedPrefecture,
  onOpenCategoryManager,
  onClose,
  onSave,
  onRequestPickOnMap,
  userLocation,
}) => {
  // Form fields
  const [urlInput, setUrlInput] = useState('');
  const [title, setTitle] = useState('');
  const [yomigana, setYomigana] = useState('');
  const [isManualYomigana, setIsManualYomigana] = useState(false);
  const [isGeneratingReading, setIsGeneratingReading] = useState(false);
  const [readingBadge, setReadingBadge] = useState<string | null>(null);

  const isComposingRef = useRef(false);
  const compositionKanaBufferRef = useRef('');
  const autoReadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['haunted']);
  const [prefecture, setPrefecture] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [rating, setRating] = useState<number>(0); // 0〜5 (0.5きざみ, 0=未評価)
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<SpotPhoto[]>([]);
  const [referenceUrls, setReferenceUrls] = useState<ReferenceUrl[]>([]);
  const [isWantToGo, setIsWantToGo] = useState(false);
  const [isHaunted, setIsHaunted] = useState(true);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);

  // Image URL input helper
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isDragOverImages, setIsDragOverImages] = useState(false);

  // UI state
  const [isParsing, setIsParsing] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [parseMessage, setParseMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Initialize or reset form
  useEffect(() => {
    if (!isOpen) return;

    if (initialSpot) {
      setUrlInput(initialSpot.googleMapsUrl || '');
      setTitle(initialSpot.title || '');
      setYomigana(initialSpot.yomigana || '');
      setIsManualYomigana(!!initialSpot.yomigana);
      setReadingBadge(initialSpot.yomigana ? '保存済み' : null);
      const cats = initialSpot.categories && initialSpot.categories.length > 0
        ? initialSpot.categories
        : [initialSpot.category || 'haunted'];
      setSelectedCategories(cats);
      setPrefecture(initialSpot.prefecture || '');
      setAddress(initialSpot.address || '');
      setLat(initialSpot.lat);
      setLng(initialSpot.lng);
      setRating(
        initialSpot.rating !== undefined && initialSpot.rating !== null
          ? Number(initialSpot.rating)
          : 0
      );
      setNotes(initialSpot.notes || '');
      setPhotos(initialSpot.photos || []);
      setReferenceUrls(initialSpot.referenceUrls || []);
      setIsWantToGo(!!initialSpot.isWantToGo);
      setIsHaunted(initialSpot.isHaunted ?? (initialSpot.category === 'haunted'));
      setSelectedListIds(initialSpot.listIds || []);
      setParseMessage(null);
      setFormError(null);
    } else {
      // Determine default list membership based on active tab
      let defaultWantToGo = false;
      let defaultHaunted = true;
      let defaultListIds: string[] = [];

      if (activeTab === 'want_to_go') {
        defaultWantToGo = true;
      } else if (activeTab === 'haunted') {
        defaultHaunted = true;
      } else if (activeTab && activeTab !== 'all' && activeTab !== 'prefecture') {
        if (customLists.some((cl) => cl.id === activeTab)) {
          defaultListIds = [activeTab];
        }
      }

      const defaultPref =
        activeTab === 'prefecture' && selectedPrefecture && selectedPrefecture !== 'all'
          ? selectedPrefecture
          : '';

      setYomigana('');
      setIsManualYomigana(false);
      setReadingBadge(null);

      if (initialLatLng) {
        setUrlInput(`https://www.google.com/maps?q=${initialLatLng.lat.toFixed(5)},${initialLatLng.lng.toFixed(5)}`);
        setTitle('');
        setSelectedCategories([categories[0]?.id || 'haunted']);
        setPrefecture(defaultPref);
        setAddress('');
        setLat(initialLatLng.lat);
        setLng(initialLatLng.lng);
        setRating(0);
        setNotes('');
        setPhotos([]);
        setReferenceUrls([]);
        setIsWantToGo(defaultWantToGo);
        setIsHaunted(defaultHaunted);
        setSelectedListIds(defaultListIds);
        setParseMessage({
          type: 'info',
          text: '地図上でクリックした地点の座標を設定しました。スポット名を入力してください。',
        });
        // Auto-reverse geocode to get address & auto-extract prefecture
        reverseGeocode(initialLatLng.lat, initialLatLng.lng).then((res) => {
          if (res) {
            if (res.address) {
              setAddress(res.address);
              const extractedPref = extractPrefectureFromAddress(res.address);
              if (extractedPref) {
                setPrefecture(extractedPref);
              } else if (res.prefecture) {
                setPrefecture(res.prefecture);
              }
            } else if (res.prefecture) {
              setPrefecture(res.prefecture);
            }
          }
        });
      } else {
        // Clean reset for brand new spot (初期設定: 未評価)
        setUrlInput('');
        setTitle('');
        setSelectedCategories([categories[0]?.id || 'haunted']);
        setPrefecture(defaultPref);
        setAddress('');
        setLat(null);
        setLng(null);
        setRating(0);
        setNotes('');
        setPhotos([]);
        setReferenceUrls([]);
        setIsWantToGo(defaultWantToGo);
        setIsHaunted(defaultHaunted);
        setSelectedListIds(defaultListIds);
        setParseMessage(null);
        setFormError(null);
      }
    }
  }, [initialSpot, initialLatLng, isOpen, categories, activeTab, customLists, selectedPrefecture]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (autoReadingTimeoutRef.current) {
        clearTimeout(autoReadingTimeoutRef.current);
      }
    };
  }, []);

  // Gemini AI による読み仮名の自動生成・補完
  const handleFetchReading = async (targetTitle?: string, isAuto = false): Promise<string> => {
    const textToRead = (targetTitle !== undefined ? targetTitle : title).trim();
    if (!textToRead) {
      if (!isAuto) {
        setFormError('読み仮名を自動補完するにはスポット名を入力してください');
        setTimeout(() => setFormError(null), 3000);
      }
      return '';
    }

    setIsGeneratingReading(true);
    try {
      const res = await fetch('/api/generate-reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToRead, context: address }),
      });
      if (res.ok) {
        const data = await res.json();
        const reading = data.reading || data.yomigana;
        if (data.success && reading) {
          setYomigana(reading);
          setReadingBadge(data.source === 'gemini' ? '✨ Gemini AI補完' : '✨ 自動補完');
          if (!isAuto) {
            setIsManualYomigana(false);
          }
          return reading;
        }
      }
      // サーバーAPIが応答しない・エラーの場合はローカル辞書から即座にフォールバック
      const fallbackReading = await generateYomigana(textToRead, address);
      if (fallbackReading) {
        setYomigana(fallbackReading);
        setReadingBadge('✨ 自動補完');
        if (!isAuto) {
          setIsManualYomigana(false);
        }
        return fallbackReading;
      }
    } catch (err) {
      console.warn('Failed to fetch reading from Gemini API, using fallback:', err);
      const fallbackReading = await generateYomigana(textToRead, address);
      if (fallbackReading) {
        setYomigana(fallbackReading);
        setReadingBadge('✨ 自動補完');
        if (!isAuto) {
          setIsManualYomigana(false);
        }
        return fallbackReading;
      }
    } finally {
      setIsGeneratingReading(false);
    }
    return '';
  };

  // ブラウザ日本語IME入力情報の追跡・変換処理
  const handleCompositionStart = () => {
    isComposingRef.current = true;
    compositionKanaBufferRef.current = '';
  };

  const handleCompositionUpdate = (e: React.CompositionEvent<HTMLInputElement>) => {
    const data = e.data || '';
    // 日本語IME入力中：漢字変換前のひらがな・カタカナを追跡
    const hasKana = /[\u3040-\u30ff]/.test(data);
    const hasKanji = /[\u4e00-\u9faf]/.test(data);
    if (hasKana && !hasKanji) {
      // カタカナをひらがなに正規化してバッファへ蓄積
      const hira = data.replace(/[\u30a1-\u30f6]/g, (m) =>
        String.fromCharCode(m.charCodeAt(0) - 0x60)
      );
      compositionKanaBufferRef.current = hira;
    }
  };

  const handleCompositionEnd = () => {
    isComposingRef.current = false;
    const capturedKana = compositionKanaBufferRef.current;
    if (capturedKana && !isManualYomigana) {
      setYomigana((prev) => {
        const next = (prev ? prev + capturedKana : capturedKana).trim();
        return next;
      });
      setReadingBadge('⌨️ 入力変換補完');
    }
    compositionKanaBufferRef.current = '';

    // IME変換確定後、最新のスポット名に基づきAI自動補完をスケジュール（より高精度な完全な読み仮名で上書き）
    if (!isManualYomigana && title.trim().length >= 2) {
      if (autoReadingTimeoutRef.current) {
        clearTimeout(autoReadingTimeoutRef.current);
      }
      autoReadingTimeoutRef.current = setTimeout(() => {
        handleFetchReading(title, true);
      }, 700);
    }
  };

  // スポット名入力変更時のハンドラ（デバウンスでGemini自動補完も連動）
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (!newTitle.trim()) {
      if (!isManualYomigana) {
        setYomigana('');
        setReadingBadge(null);
      }
      return;
    }

    if (autoReadingTimeoutRef.current) {
      clearTimeout(autoReadingTimeoutRef.current);
    }

    // ユーザー自身が読み仮名欄を手動編集していない場合、入力停止後（700ms後）に自動補完
    if (!isManualYomigana && newTitle.trim().length >= 2) {
      autoReadingTimeoutRef.current = setTimeout(() => {
        if (!isComposingRef.current) {
          handleFetchReading(newTitle, true);
        }
      }, 700);
    }
  };

  const handleTitleBlur = () => {
    if (!isManualYomigana && title.trim().length >= 2) {
      handleFetchReading(title, true);
    }
  };

  if (!isOpen) return null;

  // Handle URL parsing with full fallback to address-based geocoding and auto-population
  const handleParseUrl = async () => {
    const rawInput = urlInput.trim();
    if (!rawInput) {
      setParseMessage({ type: 'error', text: 'Googleマップの共有リンクまたは住所を入力してください。' });
      return;
    }

    setIsParsing(true);
    setParseMessage(null);

    try {
      if (isGoogleMapsShortLink(rawInput)) {
        setParseMessage({
          type: 'info',
          text: 'Googleマップ短縮リンク（maps.app.goo.gl）を展開・解析しています...',
        });
      }

      // 統合解析関数（URL解析 ＞ サーバーURL解決 ＞ 住所直接ジオコーディング ＞ 逆ジオコーディング）
      const parsed = await parseAndResolveMapInput(rawInput);

      if (parsed.lat !== undefined && parsed.lng !== undefined && isValidLatLng(parsed.lat, parsed.lng)) {
        setLat(parsed.lat);
        setLng(parsed.lng);

        if (parsed.title && (!title || title.trim() === '')) {
          setTitle(parsed.title);
          if (!isManualYomigana && !yomigana.trim()) {
            handleFetchReading(parsed.title, true);
          }
        }

        // 自動的に住所を入力
        let currentAddress = address;
        if (parsed.address) {
          setAddress(parsed.address);
          currentAddress = parsed.address;
        }

        // 住所から自動的に都道府県を抽出して割り当て
        const extractedPref = parsed.prefecture || extractPrefectureFromAddress(currentAddress) || extractPrefectureFromAddress(rawInput);
        if (extractedPref) {
          setPrefecture(extractedPref);
        }

        if (parsed.isFallbackCoordinate) {
          setParseMessage({
            type: 'info',
            text: `共有リンクからスポット名${parsed.title ? `「${parsed.title}」` : ''}を取得しました！（※リンクに正確な座標が含まれていなかったため、地図中心に仮配置しました。地図クリックで位置を調整できます）`,
          });
        } else {
          setParseMessage({
            type: 'success',
            text: `位置情報を自動取得しました！ 緯度 ${parsed.lat.toFixed(4)}, 経度 ${parsed.lng.toFixed(4)}${
              parsed.address ? `\n住所: ${parsed.address}` : ''
            }${extractedPref ? ` [${extractedPref}に自動割当]` : ''}`,
          });
        }
      } else {
        // 座標が見つからない場合でも、デフォルト座標でピン設置を可能にする
        const defaultLat = 35.6895;
        const defaultLng = 139.6917;
        setLat(defaultLat);
        setLng(defaultLng);
        if (!title) setTitle(rawInput.startsWith('http') ? '共有リンクスポット' : rawInput);
        setParseMessage({
          type: 'info',
          text: '共有リンクを登録しました！（※座標は地図の中心に配置されました。地図上で位置をクリックして微調整できます）',
        });
      }
    } catch (err) {
      console.warn('Parsing error:', err);
      setParseMessage({
        type: 'error',
        text: '解析中にエラーが発生しました。住所またはスポット名で再試行するか、地図をクリックして指定してください。',
      });
    } finally {
      setIsParsing(false);
    }
  };

  // Image Upload Handlers (複数画像一括選択・ドラッグ＆ドロップ対応)
  const processAndAddFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    setIsProcessingImages(true);
    const newPhotos: SpotPhoto[] = [];

    try {
      for (const file of imageFiles) {
        const base64 = await processImageFile(file);
        newPhotos.push(createPhotoObject(base64, file.name.replace(/\.[^/.]+$/, '')));
      }

      setPhotos((prev) => {
        const combined = [...prev, ...newPhotos];
        if (combined.length > 0 && !combined.some((p) => p.isCover)) {
          combined[0].isCover = true;
        }
        return combined;
      });
    } catch {
      setFormError('画像の処理に失敗しました。対応している画像ファイル形式（JPEG, PNG, WebP等）をご確認ください。');
    } finally {
      setIsProcessingImages(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processAndAddFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDropImages = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragOverImages(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleAddImageUrl = () => {
    const url = imageUrlInput.trim();
    if (!url) return;

    const newPhoto = createPhotoObject(url, 'Web写真');
    setPhotos((prev) => {
      const combined = [...prev, newPhoto];
      if (combined.length === 1) {
        combined[0].isCover = true;
      }
      return combined;
    });
    setImageUrlInput('');
  };

  const handleUseCurrentLocation = async () => {
    if (userLocation) {
      setLat(userLocation.lat);
      setLng(userLocation.lng);
      try {
        const res = await reverseGeocode(userLocation.lat, userLocation.lng);
        if (res?.address) {
          setAddress(res.address);
          const pref = extractPrefectureFromAddress(res.address) || res.prefecture;
          if (pref) setPrefecture(pref);
        }
      } catch {
        // ignore
      }
      return;
    }

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const cLat = pos.coords.latitude;
          const cLng = pos.coords.longitude;
          setLat(cLat);
          setLng(cLng);
          try {
            const res = await reverseGeocode(cLat, cLng);
            if (res?.address) {
              setAddress(res.address);
              const pref = extractPrefectureFromAddress(res.address) || res.prefecture;
              if (pref) setPrefecture(pref);
            }
          } catch {
            // ignore
          }
        },
        () => {
          setFormError('現在地を取得できませんでした。位置情報の許可をご確認ください。');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  const handleDeletePhoto = (photoId: string) => {
    setPhotos((prev) => {
      const filtered = prev.filter((p) => p.id !== photoId);
      if (filtered.length > 0 && !filtered.some((p) => p.isCover)) {
        filtered[0].isCover = true;
      }
      return filtered;
    });
  };

  const handleSetCoverPhoto = (photoId: string) => {
    setPhotos((prev) =>
      prev.map((p) => ({
        ...p,
        isCover: p.id === photoId,
      }))
    );
  };

  const handleUpdateCaption = (photoId: string, caption: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, caption } : p))
    );
  };

  // Reference URLs (Up to 5)
  const handleAddReferenceUrl = () => {
    if (referenceUrls.length >= 5) {
      setFormError('参考URLは最大5件まで登録できます。');
      return;
    }
    setFormError(null);
    const newRef: ReferenceUrl = {
      id: `ref-${Date.now()}`,
      title: '',
      url: '',
    };
    setReferenceUrls([...referenceUrls, newRef]);
  };

  const handleUpdateReferenceUrl = (id: string, field: 'title' | 'url', value: string) => {
    setReferenceUrls(
      referenceUrls.map((ref) => (ref.id === id ? { ...ref, [field]: value } : ref))
    );
  };

  const handleDeleteReferenceUrl = (id: string) => {
    setReferenceUrls(referenceUrls.filter((ref) => ref.id !== id));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setFormError('スポット名を入力してください。');
      return;
    }
    setFormError(null);

    // 読み仮名が空の場合、自動生成して確実に保管（自動保管の保証）
    let finalYomigana = yomigana.trim();
    if (!finalYomigana) {
      try {
        finalYomigana = await generateYomigana(title.trim(), address);
      } catch {
        // ignore
      }
    }

    // 座標が未設定の場合でも、都道府県または日本の中心座標でピン位置を自動補完
    let finalLat = lat;
    let finalLng = lng;

    if (finalLat === null || finalLng === null || !isValidLatLng(finalLat, finalLng)) {
      const candidatePref = prefecture || extractPrefectureFromAddress(address);
      if (candidatePref && PREFECTURE_CENTERS[candidatePref]) {
        finalLat = PREFECTURE_CENTERS[candidatePref].lat;
        finalLng = PREFECTURE_CENTERS[candidatePref].lng;
        if (!prefecture) setPrefecture(candidatePref);
      } else {
        finalLat = 35.6895;
        finalLng = 139.6917;
        if (!prefecture) setPrefecture('東京都');
      }
    }

    // Filter valid reference URLs
    const validRefs = referenceUrls
      .filter((r) => r.url.trim() !== '')
      .map((r) => ({
        id: r.id,
        title: r.title.trim() || r.url.trim(),
        url: r.url.trim().startsWith('http') ? r.url.trim() : `https://${r.url.trim()}`,
      }));

    onSave(
      {
        title: title.trim(),
        yomigana: finalYomigana || undefined,
        lat: finalLat,
        lng: finalLng,
        address: address.trim() || undefined,
        prefecture: prefecture.trim() || extractPrefectureFromAddress(address) || undefined,
        category: selectedCategories[0] || 'haunted',
        categories: selectedCategories.length > 0 ? selectedCategories : ['haunted'],
        rating,
        notes: notes.trim(),
        googleMapsUrl: urlInput.trim() || `https://www.google.com/maps?q=${finalLat},${finalLng}`,
        referenceUrls: validRefs,
        photos,
        isWantToGo,
        isHaunted,
        listIds: selectedListIds,
      },
      initialSpot?.id
    );

    onClose();
  };

  return (
    <>
      {/* Mobile Screen 7: 新規スポット登録 */}
      <div className="sm:hidden fixed inset-0 z-[1200] bg-slate-950 text-white flex flex-col overflow-hidden animate-in fade-in">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
          >
            キャンセル
          </button>
          <h2 className="text-base font-bold text-white tracking-wide">
            {initialSpot ? 'スポット情報の編集' : '新規スポット登録'}
          </h2>
          <button
            type="button"
            onClick={(e) => handleSubmit(e as any)}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-full text-xs font-bold transition-all shadow-md shadow-red-900/40 cursor-pointer"
          >
            登録
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {formError && (
            <div className="p-3 bg-red-950/80 border border-red-700 rounded-xl text-red-200 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* 1. スポット名 ★ */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-200">
              スポット名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              onCompositionStart={handleCompositionStart}
              onCompositionUpdate={handleCompositionUpdate}
              onCompositionEnd={handleCompositionEnd}
              onBlur={handleTitleBlur}
              placeholder="例）○○トンネル"
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500 font-bold"
            />
          </div>

          {/* 1.5 読み仮名（ふりがな） ★ */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <span>読み仮名（ふりがな）</span>
                {readingBadge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-900/60 text-violet-300 border border-violet-700/60 font-medium">
                    {readingBadge}
                  </span>
                )}
              </label>
              <button
                type="button"
                onClick={() => handleFetchReading(title, false)}
                disabled={isGeneratingReading || !title.trim()}
                className="px-2.5 py-1 bg-violet-600/30 hover:bg-violet-600/50 active:bg-violet-600/60 border border-violet-500/40 rounded-lg text-[11px] font-bold text-violet-200 flex items-center gap-1 cursor-pointer disabled:opacity-40 transition-colors"
                title="Gemini AIで読み仮名を自動補完"
              >
                {isGeneratingReading ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-violet-300" />
                    <span>解析中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-violet-300" />
                    <span>AI自動補完</span>
                  </>
                )}
              </button>
            </div>
            <input
              type="text"
              value={yomigana}
              onChange={(e) => {
                setYomigana(e.target.value);
                setIsManualYomigana(true);
                setReadingBadge(e.target.value ? '手動編集' : null);
              }}
              placeholder="例）まるまるとんねる（自動補完または手動編集）"
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500 font-medium"
            />
          </div>

          {/* 2. 📍 現在地から取得 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1">
                <span>📍</span>
                <span>現在地</span>
              </label>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Compass className="w-3.5 h-3.5 text-blue-400" />
                <span>現在地から取得</span>
              </button>
            </div>
            {lat !== null && lng !== null && (
              <div className="text-[11px] text-slate-400 font-medium pl-1">
                緯度: {lat.toFixed(4)}, 経度: {lng.toFixed(4)}
              </div>
            )}
          </div>

          {/* 3. 住所 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-200">
              住所
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="自動で取得されます"
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500"
            />
          </div>

          {/* 4. カテゴリ ★ */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-200">
              カテゴリ <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {categories.map((cat) => {
                const isSelected = selectedCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategories((prev) =>
                        prev.includes(cat.id)
                          ? prev.length > 1
                            ? prev.filter((id) => id !== cat.id)
                            : prev
                          : [...prev, cat.id]
                      );
                    }}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-red-600 border-red-600 text-white shadow-xs'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span>{cat.icon || '🏷️'}</span>
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. 危険度 ★★★★☆ */}
          {/* 5. 危険度・評価 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-200">
                危険度・評価
              </label>
              <div className="flex items-center gap-1.5">
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                  rating === 0
                    ? 'text-slate-400 bg-slate-800'
                    : 'text-amber-400 bg-amber-950/60 border border-amber-800/40'
                }`}>
                  {rating === 0 ? '未評価' : `★${rating.toFixed(1)}`}
                </span>
                <button
                  type="button"
                  onClick={() => setRating(0)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                    rating === 0
                      ? 'bg-slate-700 text-white border-slate-600'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  未評価にする
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1.5 py-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 text-slate-600 hover:text-amber-400 transition-colors cursor-pointer"
                >
                  <Star
                    className={`w-6 h-6 ${
                      rating > 0 && star <= Math.round(rating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-700'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* 6. 写真 */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-200">
              写真
            </label>
            <label className="w-full py-2.5 bg-slate-900 hover:bg-slate-850 active:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-bold text-slate-200 flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs">
              <Camera className="w-4 h-4 text-slate-400" />
              <span>写真を追加</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            {photos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                {photos.map((p) => (
                  <div key={p.id} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-700 flex-shrink-0">
                    <img src={p.url} alt={p.caption || ''} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleDeletePhoto(p.id)}
                      className="absolute top-1 right-1 p-0.5 bg-black/70 rounded-full text-white cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 7. メモ */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-200">
              メモ
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="簡単なメモを入力..."
              rows={3}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500"
            />
          </div>
        </div>
      </div>

      {/* Desktop Dialog View (PC表示) */}
      <div className="hidden sm:flex fixed inset-0 z-[550] items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center font-bold text-base shadow-2xs">
              👻
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-800">
                {initialSpot ? 'スポット情報の編集' : '新しいスポットを登録'}
              </h2>
              <p className="text-[11px] text-slate-500">
                GoogleマップのURLや地名からピンを設置し、詳細や参考URLを記録します
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Form Error Banner */}
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-bold flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* 1. Google Maps URL or Location Input */}
          <div className="bg-violet-50/40 rounded-xl p-3.5 border border-violet-100 space-y-2.5">
            <label htmlFor="google-maps-url-input" className="block font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5 text-violet-600" />
              <span>Googleマップの共有リンク または 地名・スポット名</span>
            </label>
            <div className="flex gap-2">
              <input
                id="google-maps-url-input"
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="例: https://maps.app.goo.gl/... または 東京都八王子市上川町"
                className="flex-1 text-xs px-3 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 shadow-2xs"
              />
              <button
                type="button"
                id="parse-maps-url-btn"
                onClick={handleParseUrl}
                disabled={isParsing || !urlInput.trim()}
                className="px-3.5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs whitespace-nowrap"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>解析中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>解析して抽出</span>
                  </>
                )}
              </button>
            </div>

            {/* Parse result notification */}
            {parseMessage && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-start gap-2 ${
                  parseMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : parseMessage.type === 'error'
                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                    : 'bg-blue-50 text-blue-800 border border-blue-200'
                }`}
              >
                {parseMessage.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                )}
                <span>{parseMessage.text}</span>
              </div>
            )}

            {/* Location & Map Pick */}
            <div className="flex flex-wrap items-center justify-between pt-1">
              <div className="text-slate-600">
                ピン位置:{' '}
                {lat !== null && lng !== null ? (
                  <span className="font-semibold text-slate-800">
                    緯度 {lat.toFixed(4)}, 経度 {lng.toFixed(4)}
                  </span>
                ) : (
                  <span className="text-rose-500 font-medium">未指定</span>
                )}
              </div>
              {onRequestPickOnMap && (
                <button
                  type="button"
                  onClick={onRequestPickOnMap}
                  className="text-violet-700 hover:text-violet-900 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  地図をクリックして位置を微調整
                </button>
              )}
            </div>
          </div>

          {/* 2. Basic Information Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              基本情報
            </h3>

            {/* Spot Title */}
            <div>
              <label htmlFor="spot-title-input" className="block text-xs font-semibold text-slate-700 mb-1">
                スポット名 <span className="text-rose-500">*</span>
              </label>
              <input
                id="spot-title-input"
                type="text"
                required
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onCompositionStart={handleCompositionStart}
                onCompositionUpdate={handleCompositionUpdate}
                onCompositionEnd={handleCompositionEnd}
                onBlur={handleTitleBlur}
                placeholder="例: 旧犬鳴トンネル、八木山橋など"
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 font-bold"
              />
            </div>

            {/* Yomigana / Furigana */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="spot-yomigana-input" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <span>読み仮名（ふりがな）</span>
                  {readingBadge && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200 font-medium">
                      {readingBadge}
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={() => handleFetchReading(title, false)}
                  disabled={isGeneratingReading || !title.trim()}
                  className="text-xs text-violet-700 hover:text-violet-900 disabled:opacity-40 font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 hover:bg-violet-100 border border-violet-200 transition-colors cursor-pointer"
                  title="Gemini AIでスポット名から読み仮名を自動補完"
                >
                  {isGeneratingReading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-600" />
                      <span>Gemini AI解析中...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                      <span>AIで読み仮名を自動補完</span>
                    </>
                  )}
                </button>
              </div>
              <input
                id="spot-yomigana-input"
                type="text"
                value={yomigana}
                onChange={(e) => {
                  setYomigana(e.target.value);
                  setIsManualYomigana(true);
                  setReadingBadge(e.target.value ? '手動編集' : null);
                }}
                placeholder="例: きゅういぬなきとんねる（日本語変換またはAIで自動入力・手動修正可）"
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-800 font-medium"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                ※ 日本語入力時の変換情報から自動取得されるほか、Gemini AIで高精度に読み仮名を自動補完できます。手動で自由に変更・修正できます。
              </p>
            </div>

            {/* Category & Prefecture */}
            <div className="space-y-3">
              {/* Category Multi-select */}
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-violet-600" />
                    <span>基本情報カテゴリ（複数選択可）</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-bold">
                      {selectedCategories.length}個選択中
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCategories(categories.map((c) => c.id))}
                      className="text-[11px] text-slate-500 hover:text-violet-700 font-medium cursor-pointer"
                      title="すべてのカテゴリを選択"
                    >
                      すべて選択
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedCategories([categories[0]?.id || 'haunted'])}
                      className="text-[11px] text-slate-500 hover:text-violet-700 font-medium cursor-pointer"
                      title="最初のカテゴリのみ選択"
                    >
                      リセット
                    </button>
                    {onOpenCategoryManager && (
                      <>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={onOpenCategoryManager}
                          className="text-[11px] text-violet-600 hover:text-violet-800 font-semibold flex items-center gap-1 cursor-pointer hover:underline"
                        >
                          <Settings2 className="w-3 h-3" />
                          <span>カテゴリ名管理</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* 選択中のカテゴリプレビュータグ */}
                <div className="flex flex-wrap gap-1.5 py-1">
                  {selectedCategories.map((catId, cIdx) => {
                    const found = categories.find((c) => c.id === catId);
                    if (!found) return null;
                    return (
                      <span
                        key={`${catId}_${cIdx}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold shadow-xs text-white"
                        style={{ backgroundColor: found.color }}
                      >
                        <span>{found.icon}</span>
                        <span>{found.name}</span>
                        {selectedCategories.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCategories((prev) => prev.filter((id) => id !== catId));
                            }}
                            className="hover:bg-black/20 rounded p-0.5 text-white/90 hover:text-white cursor-pointer ml-0.5"
                            title={`「${found.name}」を解除`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>

                {/* カテゴリ ドロップダウンリスト選択 */}
                <div className="mb-2">
                  <select
                    id="spot-category-dropdown-select"
                    value={selectedCategories[0] || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      if (!selectedCategories.includes(val)) {
                        setSelectedCategories((prev) => [...prev, val]);
                      }
                    }}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 cursor-pointer bg-white font-semibold text-slate-700 shadow-2xs"
                    title="カテゴリをドロップダウンリストから選択"
                  >
                    <option value="">▼ カテゴリをドロップダウンから選択・追加</option>
                    {categories.map((c) => {
                      const isSelected = selectedCategories.includes(c.id);
                      return (
                        <option key={c.id} value={c.id}>
                          {c.icon} {c.name} {isSelected ? '✓ (選択中)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {categories.map((cat, catIdx) => {
                    const isSelected = selectedCategories.includes(cat.id);
                    return (
                      <button
                        key={`${cat.id}_${catIdx}`}
                        type="button"
                        id={`category-btn-${cat.id}`}
                        onClick={() => {
                          setSelectedCategories((prev) => {
                            if (prev.includes(cat.id)) {
                              // 最低1つは残す
                              if (prev.length === 1) return prev;
                              return prev.filter((id) => id !== cat.id);
                            } else {
                              return [...prev, cat.id];
                            }
                          });
                        }}
                        className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer text-left select-none ${
                          isSelected
                            ? 'bg-violet-600 text-white border-violet-600 shadow-xs ring-2 ring-violet-200'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100/80'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm flex-shrink-0">{cat.icon}</span>
                          <span className="truncate">{cat.name}</span>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ml-1 ${
                            isSelected ? 'bg-white text-violet-700' : 'border border-slate-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Prefecture Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="spot-prefecture-select" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <span>🗾 都道府県</span>
                    {prefecture && (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-bold">
                        {prefecture}に割り当て済み
                      </span>
                    )}
                  </label>
                  <span className="text-[11px] text-slate-400">住所から自動抽出・手動変更可</span>
                </div>
                <select
                  id="spot-prefecture-select"
                  value={prefecture}
                  onChange={(e) => setPrefecture(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 cursor-pointer bg-white font-medium"
                >
                  <option value="">都道府県を選択 (任意)</option>
                  {JAPAN_PREFECTURES.map((pref) => (
                    <option key={pref} value={pref}>
                      {pref}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* List Membership Toggles: 行きたい場所、心リスト、および各カスタムリスト */}
            <div className="bg-slate-50/90 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <span>📋</span>
                  <span>追加するリスト（複数選択可）:</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  {isWantToGo || isHaunted || selectedListIds.length > 0
                    ? `${(isWantToGo ? 1 : 0) + (isHaunted ? 1 : 0) + selectedListIds.length}件のリストに登録`
                    : 'リスト未指定'}
                </span>
              </div>

              {/* 現在選択中のタブに応じたアシストメッセージ */}
              {!initialSpot && activeTab && activeTab !== 'all' && (
                <div className="px-2.5 py-1.5 rounded-lg bg-violet-50 border border-violet-100 flex items-center gap-1.5 text-[11px] text-violet-700">
                  <Sparkles className="w-3.5 h-3.5 flex-shrink-0 text-violet-600" />
                  <span>
                    {activeTab === 'want_to_go' && '現在「📌 行きたい場所」タブを選択中のため、初期チェックされています'}
                    {activeTab === 'haunted' && '現在「👻 心リスト」タブを選択中のため、初期チェックされています'}
                    {(() => {
                      const activeCl = customLists.find((cl) => cl.id === activeTab);
                      if (activeCl) {
                        return `現在「${activeCl.icon || '⭐'} ${activeCl.name}」タブを選択中のため、このリストに自動追加されます`;
                      }
                      return null;
                    })()}
                    {activeTab === 'prefecture' && selectedPrefecture && selectedPrefecture !== 'all' && (
                      `現在「県別 (${selectedPrefecture})」タブを選択中のため、都道府県がセットされています`
                    )}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {/* 📌 行きたい場所 */}
                <button
                  type="button"
                  onClick={() => setIsWantToGo(!isWantToGo)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border font-bold flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                    isWantToGo
                      ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] ${
                    isWantToGo ? 'bg-amber-500 text-white' : 'border border-slate-300'
                  }`}>
                    {isWantToGo && <Check className="w-3 h-3" />}
                  </span>
                  <span>📌 行きたい場所</span>
                </button>

                {/* 👻 心リスト */}
                <button
                  type="button"
                  onClick={() => setIsHaunted(!isHaunted)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border font-bold flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                    isHaunted
                      ? 'bg-violet-100 text-violet-900 border-violet-300 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] ${
                    isHaunted ? 'bg-violet-600 text-white' : 'border border-slate-300'
                  }`}>
                    {isHaunted && <Check className="w-3 h-3" />}
                  </span>
                  <span>👻 心リスト</span>
                </button>

                {/* カスタムリスト一覧 */}
                {customLists
                  .filter((cl) => cl.id !== 'want_to_go' && cl.id !== 'haunted')
                  .map((cl, clIdx) => {
                    const isSelected = selectedListIds.includes(cl.id);
                    const isCurrentTab = activeTab === cl.id;

                  return (
                    <button
                      key={`${cl.id}_${clIdx}`}
                      type="button"
                      onClick={() => {
                        setSelectedListIds((prev) =>
                          prev.includes(cl.id) ? prev.filter((id) => id !== cl.id) : [...prev, cl.id]
                        );
                      }}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border font-bold flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                        isSelected
                          ? 'shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                      style={
                        isSelected
                          ? {
                              backgroundColor: `${cl.color}18`,
                              borderColor: `${cl.color}60`,
                              color: '#0f172a',
                            }
                          : undefined
                      }
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] ${
                          isSelected ? 'text-white' : 'border border-slate-300'
                        }`}
                        style={isSelected ? { backgroundColor: cl.color } : undefined}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </span>
                      <span>{cl.icon || '⭐'}</span>
                      <span>{cl.name}</span>
                      {isCurrentTab && (
                        <span
                          className="text-[9px] px-1 rounded-sm font-semibold ml-0.5"
                          style={{
                            backgroundColor: `${cl.color}25`,
                            color: cl.color,
                          }}
                        >
                          選択中
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Address */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="spot-address-input" className="block text-xs font-semibold text-slate-700">
                  住所 / エリア
                </label>
                <span className="text-[11px] text-slate-400">入力すると都道府県が自動割り当てされます</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="spot-address-input"
                  type="text"
                  value={address}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAddress(val);
                    const extracted = extractPrefectureFromAddress(val);
                    if (extracted) {
                      setPrefecture(extracted);
                    }
                  }}
                  placeholder="例: 福岡県宮若市犬鳴、東京都港区芝公園4丁目2-8"
                  className="flex-1 text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 font-medium"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!address.trim()) return;
                    setIsParsing(true);
                    try {
                      const geo = await geocodeAddressOrPlace(address.trim());
                      if (geo && isValidLatLng(geo.lat, geo.lng)) {
                        setLat(geo.lat);
                        setLng(geo.lng);
                        if (geo.address) setAddress(geo.address);
                        const pref = geo.prefecture || extractPrefectureFromAddress(geo.address) || extractPrefectureFromAddress(address);
                        if (pref) setPrefecture(pref);
                        setParseMessage({
                          type: 'success',
                          text: `住所から座標を取得しました: 緯度 ${geo.lat.toFixed(4)}, 経度 ${geo.lng.toFixed(4)}${pref ? ` (${pref})` : ''}`,
                        });
                      } else {
                        setParseMessage({
                          type: 'error',
                          text: '指定された住所から位置を特定できませんでした。',
                        });
                      }
                    } catch {
                      setParseMessage({
                        type: 'error',
                        text: '住所のジオコーディング中にエラーが発生しました。',
                      });
                    } finally {
                      setIsParsing(false);
                    }
                  }}
                  disabled={isParsing || !address.trim()}
                  className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  title="入力した住所から緯度経度を自動取得してピンをセット"
                >
                  <MapPin className="w-3.5 h-3.5 text-violet-600" />
                  <span>住所からピン検索</span>
                </button>
              </div>
            </div>

            {/* Rating (0〜5まで0.5きざみ) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="rating-range-slider" className="text-xs font-semibold text-slate-700">
                  危険度・注目度評価 (★ 0.0〜5.0 / 0.5刻み)
                </label>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border shadow-2xs ${
                    rating === 0
                      ? 'text-slate-500 bg-slate-100 border-slate-200'
                      : 'text-amber-600 bg-amber-50 border-amber-200'
                  }`}>
                    {rating === 0 ? '未評価' : `★ ${rating.toFixed(1)} / 5.0`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRating(0)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                      rating === 0
                        ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    }`}
                    title="評価を未評価 (0) に設定"
                  >
                    未評価
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* 5 Stars with Half-Star Click Targets */}
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <div key={star} className="relative w-7 h-7 flex items-center justify-center">
                      {/* Left Half Click Target (0.5刻み) */}
                      <button
                        type="button"
                        onClick={() => setRating(star - 0.5)}
                        className="absolute left-0 top-0 w-1/2 h-full z-10 cursor-pointer"
                        title={`${star - 0.5}`}
                        aria-label={`評価 ${star - 0.5}`}
                      />
                      {/* Right Half Click Target (1.0刻み) */}
                      <button
                        type="button"
                        onClick={() => setRating(star)}
                        className="absolute right-0 top-0 w-1/2 h-full z-10 cursor-pointer"
                        title={`${star}.0`}
                        aria-label={`評価 ${star}.0`}
                      />

                      {/* Star visual with half fill */}
                      <div className="relative w-6 h-6 pointer-events-none">
                        <Star className="w-6 h-6 text-slate-200 fill-slate-100" />
                        {rating >= star ? (
                          <div className="absolute inset-0 overflow-hidden">
                            <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
                          </div>
                        ) : rating >= star - 0.5 ? (
                          <div className="absolute inset-0 w-1/2 overflow-hidden">
                            <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Slider & Stepper Controls */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    disabled={rating <= 0}
                    onClick={() => setRating((prev) => Math.max(0, Math.round((prev - 0.5) * 10) / 10))}
                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-xs flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                    title="-0.5 減らす"
                  >
                    -0.5
                  </button>

                  <input
                    id="rating-range-slider"
                    type="range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={rating}
                    onChange={(e) => setRating(parseFloat(e.target.value))}
                    className="w-28 sm:w-32 h-2 bg-slate-200 rounded-lg accent-amber-500 cursor-pointer"
                    aria-label="評価スライダー"
                  />

                  <button
                    type="button"
                    disabled={rating >= 5}
                    onClick={() => setRating((prev) => Math.min(5, Math.round((prev + 0.5) * 10) / 10))}
                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-xs flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                    title="+0.5 増やす"
                  >
                    +0.5
                  </button>
                </div>
              </div>
            </div>

            {/* Notes / Memo */}
            <div>
              <label htmlFor="spot-notes-input" className="block text-xs font-semibold text-slate-700 mb-1">
                概要・逸話・目撃情報・メモ
              </label>
              <textarea
                id="spot-notes-input"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="心霊現象の噂、歴史的背景、現地の状況、立ち入り注意点など自由に記録できます"
                className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 resize-y"
              />
            </div>
          </div>

          {/* 3. Reference URLs Section (Up to 5) */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-violet-600" />
                  <span>参考URL ({referenceUrls.length} / 5件)</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Wikipediaや体験談まとめサイト、検証ブログなどのURLを最大5件まで登録できます
                </p>
              </div>
              {referenceUrls.length < 5 && (
                <button
                  type="button"
                  onClick={handleAddReferenceUrl}
                  className="px-2.5 py-1 text-xs bg-violet-50 hover:bg-violet-100 text-violet-700 font-bold rounded-lg border border-violet-200 cursor-pointer flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>URLを追加</span>
                </button>
              )}
            </div>

            {referenceUrls.length === 0 ? (
              <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
                参考URLはまだ登録されていません。「URLを追加」から関連サイトを登録できます。
              </div>
            ) : (
              <div className="space-y-2">
                {referenceUrls.map((ref, idx) => (
                  <div
                    key={ref.id ? `${ref.id}_${idx}` : `ref_${idx}`}
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                  >
                    <span className="text-[11px] font-bold text-slate-400 px-1">
                      #{idx + 1}
                    </span>
                    <input
                      type="text"
                      value={ref.title}
                      onChange={(e) => handleUpdateReferenceUrl(ref.id, 'title', e.target.value)}
                      placeholder="サイト名・タイトル (例: Wikipedia, 心霊マップ)"
                      className="w-full sm:w-44 text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-violet-500 font-medium"
                    />
                    <input
                      type="url"
                      value={ref.url}
                      onChange={(e) => handleUpdateReferenceUrl(ref.id, 'url', e.target.value)}
                      placeholder="https://..."
                      className="flex-1 text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-violet-500"
                    />
                    <div className="flex items-center gap-1 justify-end">
                      {ref.url && (
                        <a
                          href={ref.url.startsWith('http') ? ref.url : `https://${ref.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="リンクを開く"
                          className="p-1.5 text-violet-600 hover:text-violet-800 hover:bg-violet-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteReferenceUrl(ref.id)}
                        title="削除"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. Multi-Image Attachments Section */}
          <div className="space-y-4 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  写真の添付 ({photos.length}枚)
                </h3>
                <p className="text-[11px] text-slate-500">
                  何枚でも写真を添付してアルバムのように見返すことができます
                </p>
              </div>
            </div>

            {/* Upload Box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* File upload drag & drop (複数画像一括選択・ドラッグ対応) */}
              <label
                htmlFor="multi-photo-file-upload"
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOverImages(true);
                }}
                onDragLeave={() => setIsDragOverImages(false)}
                onDrop={handleDropImages}
                className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all text-center ${
                  isDragOverImages
                    ? 'border-violet-600 bg-violet-100/70 scale-[1.01]'
                    : 'border-slate-200 hover:border-violet-400 hover:bg-violet-50/40 bg-white'
                }`}
              >
                {isProcessingImages ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-bold text-violet-700">複数画像を圧縮・追加中...</span>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center">
                      <Upload className="w-5 h-5 text-violet-600" />
                    </div>
                    <span className="text-xs font-bold text-slate-800">
                      写真ファイルを複数選択 / ドロップ
                    </span>
                    <span className="text-[11px] text-violet-700 font-bold bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
                      複数枚を一括で選択・追加可能
                    </span>
                    <span className="text-[10px] text-slate-400">JPG, PNG, WebP対応 (一括選択可)</span>
                  </>
                )}
                <input
                  id="multi-photo-file-upload"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isProcessingImages}
                />
              </label>

              {/* URL input */}
              <div className="border border-slate-200 rounded-xl p-3 flex flex-col justify-between bg-slate-50/50">
                <span className="text-xs font-semibold text-slate-700 mb-1">
                  画像URLを直接入力
                </span>
                <div className="flex gap-1.5">
                  <input
                    type="url"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    className="flex-1 text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-violet-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddImageUrl}
                    disabled={!imageUrlInput.trim()}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    追加
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 mt-1">
                  Unsplash等の画像リンクもそのまま使用可能です
                </span>
              </div>
            </div>

            {/* Photo List Preview */}
            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                {photos.map((photo, pIdx) => (
                  <div
                    key={photo.id ? `${photo.id}_${pIdx}` : `photo_${pIdx}`}
                    className={`relative rounded-xl border overflow-hidden group bg-slate-100 ${
                      photo.isCover ? 'ring-2 ring-violet-500 border-violet-500' : 'border-slate-200'
                    }`}
                  >
                    <div className="aspect-video relative overflow-hidden">
                      <img
                        src={photo.url}
                        alt={photo.caption || 'Spot photo'}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      {photo.isCover ? (
                        <span className="absolute top-1.5 left-1.5 bg-violet-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
                          カバー写真
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetCoverPhoto(photo.id)}
                          className="absolute top-1.5 left-1.5 bg-black/60 hover:bg-black/80 text-white text-[10px] font-medium px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          カバーにする
                        </button>
                      )}

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(photo.id)}
                        className="absolute top-1.5 right-1.5 bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow"
                        title="写真を削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Caption Input */}
                    <div className="p-1.5">
                      <input
                        type="text"
                        value={photo.caption || ''}
                        onChange={(e) => handleUpdateCaption(photo.id, e.target.value)}
                        placeholder="キャプション (任意)"
                        className="w-full text-[11px] px-2 py-0.5 bg-white border border-slate-200 rounded focus:outline-none focus:border-violet-400"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 sticky bottom-0 bg-white py-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="submit"
              id="save-spot-submit-btn"
              className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{initialSpot ? '変更を保存する' : 'スポットを登録する'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
};
