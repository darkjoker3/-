import React, { useState, useRef, useEffect } from 'react';
import { Spot, CustomCategory, CustomList } from '../types';
import {
  exportSpotsToCsvString,
  downloadCsvFile,
  generateCsvTemplate,
  parseCsvToSpots,
  mergeImportedSpots,
  CsvParseResult,
  CSV_COLUMNS,
} from '../utils/csvManager';
import {
  X,
  FileSpreadsheet,
  Download,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Info,
  RefreshCw,
  PlusCircle,
  Database,
  ArrowRight,
  Eye,
  Cloud,
  CloudUpload,
  CloudDownload,
  ExternalLink,
  Copy,
  Check,
  Share2,
  HardDrive,
  Clock,
  FolderOpen,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  DriveFileMeta,
  SYNC_FILE_NAME,
  CSV_SYNC_FILE_NAME,
  uploadCsvToDrive,
  uploadSyncData,
  searchDriveFiles,
  downloadFileContent,
  downloadSyncData,
  searchSyncFile,
} from '../services/googleDriveService';
import { getAccessToken, googleSignIn } from '../services/firebaseAuth';
import { formatSyncTimestamp, createSyncPayload } from '../utils/cloudSyncManager';

interface DataExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  spots: Spot[];
  filteredSpots?: Spot[];
  categories: CustomCategory[];
  customLists: CustomList[];
  onSaveSpots: (newSpots: Spot[]) => void;
  onRestoreFullData?: (data: { spots: Spot[]; categories?: CustomCategory[]; customLists?: CustomList[] }) => void;
  onExportJson: () => void;
  onImportJson: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void;
  currentUser?: User | null;
  hasToken?: boolean;
  syncFileId?: string | null;
  cloudMeta?: DriveFileMeta | null;
  lastSyncTime?: number | null;
  isSyncing?: boolean;
  onSaveToGoogleDrive?: () => Promise<void>;
  onRestoreFromGoogleDrive?: () => Promise<void>;
  onSignInGoogle?: () => Promise<void>;
  onOpenCloudSync?: () => void;
}

export const DataExportImportModal: React.FC<DataExportImportModalProps> = ({
  isOpen,
  onClose,
  spots,
  filteredSpots = [],
  categories,
  customLists,
  onSaveSpots,
  onRestoreFullData,
  onExportJson,
  onImportJson,
  showToast,
  currentUser,
  hasToken = true,
  syncFileId,
  cloudMeta,
  lastSyncTime,
  isSyncing = false,
  onSaveToGoogleDrive,
  onRestoreFromGoogleDrive,
  onSignInGoogle,
  onOpenCloudSync,
}) => {
  const [activeTab, setActiveTab] = useState<'csv_export' | 'csv_import' | 'json_backup'>('csv_export');

  // CSV Export settings
  const [exportScope, setExportScope] = useState<'all' | 'filtered' | 'want_to_go' | 'haunted' | string>('all');
  const [csvFileNameType, setCsvFileNameType] = useState<'standard' | 'timestamped'>('standard');
  const [isSavingCsvToDrive, setIsSavingCsvToDrive] = useState(false);
  const [driveCsvResult, setDriveCsvResult] = useState<{
    fileId: string;
    fileName: string;
    modifiedTime: string;
    webViewLink?: string;
    size?: string;
  } | null>(null);

  // CSV Import state
  const [csvImportSource, setCsvImportSource] = useState<'local' | 'drive'>('local');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'append' | 'replace'>('merge');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drive CSV File List state
  const [driveCsvFiles, setDriveCsvFiles] = useState<DriveFileMeta[]>([]);
  const [isLoadingDriveCsvList, setIsLoadingDriveCsvList] = useState(false);
  const [loadingDriveCsvId, setLoadingDriveCsvId] = useState<string | null>(null);

  // JSON Google Drive state
  const [jsonSaveType, setJsonSaveType] = useState<'standard' | 'timestamped'>('standard');
  const [isSavingJsonToDrive, setIsSavingJsonToDrive] = useState(false);
  const [driveJsonResult, setDriveJsonResult] = useState<{
    fileId: string;
    fileName: string;
    modifiedTime: string;
    webViewLink?: string;
  } | null>(null);

  // Drive JSON File List for Restore
  const [driveJsonFiles, setDriveJsonFiles] = useState<DriveFileMeta[]>([]);
  const [isLoadingDriveJsonList, setIsLoadingDriveJsonList] = useState(false);
  const [confirmRestoreFile, setConfirmRestoreFile] = useState<DriveFileMeta | 'standard_sync' | null>(null);
  const [isRestoringJson, setIsRestoringJson] = useState(false);

  // Link copy feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Automatically fetch Drive files when switching to Drive sources if user is logged in
  useEffect(() => {
    if (isOpen && currentUser && hasToken) {
      if (activeTab === 'csv_import' && csvImportSource === 'drive') {
        fetchDriveCsvFiles();
      }
    }
  }, [isOpen, activeTab, csvImportSource, currentUser, hasToken]);

  if (!isOpen) return null;

  // Determine export target spots
  const getExportSpots = (): Spot[] => {
    if (exportScope === 'filtered') {
      return filteredSpots.length > 0 ? filteredSpots : spots;
    }
    if (exportScope === 'want_to_go') {
      return spots.filter((s) => s.isWantToGo || s.listIds?.includes('want_to_go'));
    }
    if (exportScope === 'haunted') {
      return spots.filter((s) => s.isHaunted || s.category === 'haunted' || s.listIds?.includes('haunted'));
    }
    if (exportScope !== 'all') {
      return spots.filter((s) => s.listIds?.includes(exportScope));
    }
    return spots;
  };

  const targetSpots = getExportSpots();

  // Helper: Copy share link to clipboard
  const handleCopyShareLink = async (url: string, key: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      showToast('Googleドライブの共有リンクをコピーしました', 'success');
      setTimeout(() => {
        setCopiedKey(null);
      }, 3000);
    } catch {
      showToast('リンクのコピーに失敗しました', 'error');
    }
  };

  // Helper: Authenticate Google if needed
  const ensureGoogleToken = async (): Promise<string> => {
    let token = getAccessToken();
    if (!token) {
      if (onSignInGoogle) {
        await onSignInGoogle();
        token = getAccessToken();
      } else {
        const res = await googleSignIn();
        token = res.accessToken;
      }
    }
    if (!token) {
      throw new Error('Googleアカウントへの接続（アクセストークン）が必要です');
    }
    return token;
  };

  // ==========================================
  // 1. CSV EXPORT HANDLERS
  // ==========================================

  // Local Download
  const handleExecuteExportCsv = () => {
    if (targetSpots.length === 0) {
      showToast('エクスポート対象のスポットがありません。', 'error');
      return;
    }

    try {
      const csvStr = exportSpotsToCsvString(targetSpots, categories, customLists);
      const todayStr = new Date().toISOString().split('T')[0];
      let scopeSuffix = '';
      if (exportScope === 'want_to_go') scopeSuffix = '_行きたい場所';
      else if (exportScope === 'haunted') scopeSuffix = '_心リスト';
      else if (exportScope === 'filtered') scopeSuffix = '_絞り込み';

      const filename = `spots_export_${todayStr}${scopeSuffix}.csv`;
      downloadCsvFile(csvStr, filename);
      showToast(`「${filename}」(${targetSpots.length}件) をダウンロードしました`, 'success');
    } catch (e) {
      console.error(e);
      showToast('CSVのエクスポートに失敗しました。', 'error');
    }
  };

  // Download template
  const handleDownloadTemplate = () => {
    try {
      const templateStr = generateCsvTemplate();
      downloadCsvFile(templateStr, 'haunted_spots_template.csv');
      showToast('Excel編集用ひな形CSVをダウンロードしました', 'success');
    } catch (e) {
      console.error(e);
      showToast('テンプレートのダウンロードに失敗しました。', 'error');
    }
  };

  // Save CSV to Google Drive
  const handleSaveCsvToGoogleDrive = async () => {
    if (targetSpots.length === 0) {
      showToast('エクスポート対象のスポットがありません。', 'error');
      return;
    }

    setIsSavingCsvToDrive(true);
    try {
      const token = await ensureGoogleToken();
      const csvStr = exportSpotsToCsvString(targetSpots, categories, customLists);

      const todayStr = new Date().toISOString().split('T')[0];
      let fileName = CSV_SYNC_FILE_NAME;
      let existingFileId: string | undefined = undefined;

      if (csvFileNameType === 'timestamped') {
        let scopeSuffix = '';
        if (exportScope === 'want_to_go') scopeSuffix = '_行きたい場所';
        else if (exportScope === 'haunted') scopeSuffix = '_心リスト';
        else if (exportScope === 'filtered') scopeSuffix = '_絞り込み';
        fileName = `japan_road_spots_${todayStr}${scopeSuffix}.csv`;
      } else {
        // Standard file: search if already exists to overwrite
        const existing = await searchSyncFile(token, CSV_SYNC_FILE_NAME);
        if (existing) {
          existingFileId = existing.id;
        }
      }

      const res = await uploadCsvToDrive(token, csvStr, fileName, existingFileId);
      setDriveCsvResult({
        fileId: res.fileId,
        fileName,
        modifiedTime: res.modifiedTime,
        webViewLink: res.webViewLink,
      });

      showToast(`Googleドライブに「${fileName}」(${targetSpots.length}件) を保存しました`, 'success');
    } catch (err: unknown) {
      console.error('Save CSV to drive error:', err);
      const msg = err instanceof Error ? err.message : 'GoogleドライブへのCSV保存に失敗しました';
      showToast(msg, 'error');
    } finally {
      setIsSavingCsvToDrive(false);
    }
  };

  // ==========================================
  // 2. CSV IMPORT HANDLERS
  // ==========================================

  // Load from local file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadLocalCsvFile(file);
  };

  const loadLocalCsvFile = (file: File) => {
    setImportFile(file);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        processCsvText(text, file.name);
      } catch (err) {
        console.error(err);
        showToast('CSVの解析中にエラーが発生しました。', 'error');
        setParseResult(null);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.onerror = () => {
      showToast('ファイルの読み込みに失敗しました。', 'error');
      setIsProcessing(false);
    };
    reader.readAsText(file, 'utf-8');
  };

  const processCsvText = (text: string, sourceName: string) => {
    const result = parseCsvToSpots(text, categories, customLists, spots);
    setParseResult(result);
    if (result.spots.length === 0 && result.errors.length > 0) {
      showToast(result.errors[0], 'error');
    } else {
      showToast(`「${sourceName}」から${result.spots.length}件のスポットを検出しました`, 'info');
    }
  };

  // Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.csv') || file.type.includes('csv') || file.type.includes('text'))) {
      loadLocalCsvFile(file);
    } else {
      showToast('CSVファイル (.csv) を選択してください。', 'error');
    }
  };

  // Fetch CSV list from Google Drive
  const fetchDriveCsvFiles = async () => {
    setIsLoadingDriveCsvList(true);
    try {
      const token = await ensureGoogleToken();
      const files = await searchDriveFiles(token, 'csv');
      setDriveCsvFiles(files);
    } catch (err: unknown) {
      console.error('Fetch Drive CSV files error:', err);
      const msg = err instanceof Error ? err.message : 'Googleドライブのファイル取得に失敗しました';
      showToast(msg, 'error');
    } finally {
      setIsLoadingDriveCsvList(false);
    }
  };

  // Load CSV content from a Drive file
  const handleLoadCsvFromDrive = async (file: DriveFileMeta) => {
    setLoadingDriveCsvId(file.id);
    try {
      const token = await ensureGoogleToken();
      const text = await downloadFileContent(token, file.id);
      processCsvText(text, file.name);
    } catch (err: unknown) {
      console.error('Load CSV from drive error:', err);
      const msg = err instanceof Error ? err.message : 'GoogleドライブからのCSV読み込みに失敗しました';
      showToast(msg, 'error');
    } finally {
      setLoadingDriveCsvId(null);
    }
  };

  // Apply parsed CSV to application state
  const handleExecuteImportCsv = () => {
    if (!parseResult || parseResult.spots.length === 0) {
      showToast('取り込むスポットデータがありません。', 'error');
      return;
    }

    try {
      const { mergedSpots, stats } = mergeImportedSpots(spots, parseResult.spots, importMode);
      onSaveSpots(mergedSpots);

      let msg = '';
      if (importMode === 'replace') {
        msg = `全${stats.total}件のスポットデータに置き換えました`;
      } else {
        msg = `${stats.added}件を新規追加、${stats.updated}件を更新しました（合計: ${stats.total}件）`;
      }

      showToast(msg, 'success');
      onClose();
    } catch (e) {
      console.error(e);
      showToast('インポートの適用中にエラーが発生しました。', 'error');
    }
  };

  // ==========================================
  // 3. JSON BACKUP & RESTORE HANDLERS
  // ==========================================

  // Save JSON to Google Drive
  const handleSaveJsonToGoogleDrive = async () => {
    setIsSavingJsonToDrive(true);
    try {
      const token = await ensureGoogleToken();
      const payload = createSyncPayload(spots, categories, customLists);

      const todayStr = new Date().toISOString().split('T')[0];
      let fileName = SYNC_FILE_NAME;
      let existingFileId: string | undefined = undefined;

      if (jsonSaveType === 'timestamped') {
        fileName = `japan_road_spots_backup_${todayStr}.json`;
      } else {
        existingFileId = syncFileId || undefined;
      }

      const res = await uploadSyncData(token, payload, existingFileId, fileName);
      setDriveJsonResult({
        fileId: res.fileId,
        fileName,
        modifiedTime: res.modifiedTime,
        webViewLink: res.webViewLink,
      });

      showToast(`Googleドライブに「${fileName}」(${spots.length}件) を保存しました`, 'success');
    } catch (err: unknown) {
      console.error('Save JSON to drive error:', err);
      const msg = err instanceof Error ? err.message : 'GoogleドライブへのJSON保存に失敗しました';
      showToast(msg, 'error');
    } finally {
      setIsSavingJsonToDrive(false);
    }
  };

  // Fetch JSON files list from Google Drive
  const fetchDriveJsonFiles = async () => {
    setIsLoadingDriveJsonList(true);
    try {
      const token = await ensureGoogleToken();
      const files = await searchDriveFiles(token, 'json');
      setDriveJsonFiles(files);
    } catch (err: unknown) {
      console.error('Fetch Drive JSON files error:', err);
      const msg = err instanceof Error ? err.message : 'Googleドライブのバックアップ取得に失敗しました';
      showToast(msg, 'error');
    } finally {
      setIsLoadingDriveJsonList(false);
    }
  };

  // Execute JSON Restore after user confirmation
  const handleExecuteRestoreJson = async () => {
    if (!confirmRestoreFile) return;
    const target = confirmRestoreFile;
    setConfirmRestoreFile(null);
    setIsRestoringJson(true);

    try {
      const token = await ensureGoogleToken();

      if (target === 'standard_sync') {
        if (onRestoreFromGoogleDrive) {
          await onRestoreFromGoogleDrive();
        } else {
          const fileMeta = cloudMeta || (await searchSyncFile(token));
          if (!fileMeta) throw new Error('同期ファイルが見つかりません');
          const remoteData = await downloadSyncData(token, fileMeta.id);
          if (onRestoreFullData) {
            onRestoreFullData({
              spots: remoteData.spots || [],
              categories: remoteData.categories,
              customLists: remoteData.customLists,
            });
          } else {
            onSaveSpots(remoteData.spots || []);
          }
          showToast(`「${fileMeta.name}」から復元しました（${remoteData.spots?.length ?? 0}件）`, 'success');
        }
      } else {
        const remoteData = await downloadSyncData(token, target.id);
        if (onRestoreFullData) {
          onRestoreFullData({
            spots: remoteData.spots || [],
            categories: remoteData.categories,
            customLists: remoteData.customLists,
          });
        } else {
          onSaveSpots(remoteData.spots || []);
        }
        showToast(`「${target.name}」からスポット${remoteData.spots?.length ?? 0}件を復元しました`, 'success');
      }
      onClose();
    } catch (err: unknown) {
      console.error('Restore error:', err);
      const msg = err instanceof Error ? err.message : '復元に失敗しました';
      showToast(msg, 'error');
    } finally {
      setIsRestoringJson(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1300] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-md shadow-violet-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight flex items-center gap-2">
                データ入出力・Googleドライブ共有
                <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                  Drive連携対応
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                CSV/JSONのPC入出力およびGoogleドライブでの直接保存・復元・共有
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-2.5 border-b border-slate-200 flex gap-1.5 sm:gap-2 bg-slate-50/40 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('csv_export')}
            className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'csv_export'
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>CSVエクスポート</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('csv_import')}
            className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'csv_import'
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>CSVインポート</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('json_backup')}
            className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'json_backup'
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>JSON完全バックアップ</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ========================================================= */}
          {/* TAB 1: CSV EXPORT */}
          {/* ========================================================= */}
          {activeTab === 'csv_export' && (
            <div className="space-y-4">
              <div className="bg-violet-50/70 border border-violet-100 rounded-xl p-3.5 flex items-start gap-3">
                <Info className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-violet-950 space-y-1 leading-relaxed">
                  <p className="font-bold">Excel &amp; Googleスプレッドシート両対応（UTF-8 BOM付き）</p>
                  <p className="text-violet-800">
                    Microsoft Excel、Googleスプレッドシート、Numbers等で文字化けせずに直接開いて編集・一覧管理できます。
                  </p>
                </div>
              </div>

              {/* Scope Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  エクスポートする対象範囲
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      exportScope === 'all'
                        ? 'border-violet-500 bg-violet-50/50 shadow-xs ring-1 ring-violet-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="exportScope"
                        checked={exportScope === 'all'}
                        onChange={() => setExportScope('all')}
                        className="text-violet-600 focus:ring-violet-500"
                      />
                      <span className="font-bold text-slate-800">すべての登録スポット</span>
                    </div>
                    <span className="font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {spots.length}件
                    </span>
                  </label>

                  {filteredSpots.length > 0 && filteredSpots.length !== spots.length && (
                    <label
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        exportScope === 'filtered'
                          ? 'border-violet-500 bg-violet-50/50 shadow-xs ring-1 ring-violet-500/20'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="exportScope"
                          checked={exportScope === 'filtered'}
                          onChange={() => setExportScope('filtered')}
                          className="text-violet-600 focus:ring-violet-500"
                        />
                        <span className="font-bold text-slate-800">現在の絞り込み結果</span>
                      </div>
                      <span className="font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {filteredSpots.length}件
                      </span>
                    </label>
                  )}

                  <label
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      exportScope === 'want_to_go'
                        ? 'border-violet-500 bg-violet-50/50 shadow-xs ring-1 ring-violet-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="exportScope"
                        checked={exportScope === 'want_to_go'}
                        onChange={() => setExportScope('want_to_go')}
                        className="text-violet-600 focus:ring-violet-500"
                      />
                      <span className="font-bold text-slate-800">📌 行きたい場所のみ</span>
                    </div>
                    <span className="font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {spots.filter((s) => s.isWantToGo || s.listIds?.includes('want_to_go')).length}件
                    </span>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      exportScope === 'haunted'
                        ? 'border-violet-500 bg-violet-50/50 shadow-xs ring-1 ring-violet-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="exportScope"
                        checked={exportScope === 'haunted'}
                        onChange={() => setExportScope('haunted')}
                        className="text-violet-600 focus:ring-violet-500"
                      />
                      <span className="font-bold text-slate-800">👻 心リストのみ</span>
                    </div>
                    <span className="font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {spots.filter((s) => s.isHaunted || s.category === 'haunted' || s.listIds?.includes('haunted')).length}件
                    </span>
                  </label>
                </div>
              </div>

              {/* Columns Included */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 block">出力される項目一覧</span>
                <div className="flex flex-wrap gap-1">
                  {CSV_COLUMNS.map((col) => (
                    <span
                      key={col.key}
                      className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-medium border border-slate-200/80"
                    >
                      {col.header}
                    </span>
                  ))}
                </div>
              </div>

              {/* GOOGLE DRIVE CSV EXPORT CARD */}
              <div className="bg-gradient-to-br from-blue-50/90 via-indigo-50/40 to-slate-50 border border-blue-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs flex-shrink-0">
                      <CloudUpload className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <span>GoogleドライブへCSV保存 &amp; 共有</span>
                        <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-semibold border border-blue-200">
                          共有可能
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        ご自身のGoogleドライブ内に保存し、Googleスプレッドシートや共有リンクで閲覧・共有できます。
                      </p>
                    </div>
                  </div>
                </div>

                {currentUser ? (
                  <div className="space-y-3 pt-1">
                    {/* Filename Option */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-slate-600 font-medium">ファイル名設定:</span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="csvFileMode"
                          checked={csvFileNameType === 'standard'}
                          onChange={() => setCsvFileNameType('standard')}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-mono text-slate-800 font-semibold">{CSV_SYNC_FILE_NAME} (上書き更新)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer ml-2">
                        <input
                          type="radio"
                          name="csvFileMode"
                          checked={csvFileNameType === 'timestamped'}
                          onChange={() => setCsvFileNameType('timestamped')}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-mono text-slate-800 font-semibold">日時付き新規作成</span>
                      </label>
                    </div>

                    {/* Upload to Drive Button */}
                    <button
                      type="button"
                      disabled={isSavingCsvToDrive || targetSpots.length === 0}
                      onClick={handleSaveCsvToGoogleDrive}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSavingCsvToDrive ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                          <span>GoogleドライブへCSV保存中...</span>
                        </>
                      ) : (
                        <>
                          <CloudUpload className="w-4 h-4 text-white" />
                          <span>GoogleドライブにCSV保存 ({targetSpots.length}件)</span>
                        </>
                      )}
                    </button>

                    {/* Saved Result Card */}
                    {driveCsvResult && (
                      <div className="bg-white p-3 rounded-xl border border-blue-200 text-xs space-y-2 animate-in fade-in">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Googleドライブへ正常に保存されました</span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {formatSyncTimestamp(new Date(driveCsvResult.modifiedTime).getTime())}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 font-mono bg-slate-50 p-2 rounded border border-slate-100 flex items-center justify-between">
                          <span className="truncate">{driveCsvResult.fileName}</span>
                          <span className="text-[10px] text-slate-400 ml-2">ID: {driveCsvResult.fileId.substring(0, 10)}...</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap pt-0.5">
                          {driveCsvResult.webViewLink && (
                            <>
                              <a
                                href={driveCsvResult.webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg border border-blue-200 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                                <span>Googleドライブで開く</span>
                              </a>
                              <button
                                type="button"
                                onClick={() => handleCopyShareLink(driveCsvResult.webViewLink!, 'csv_export_link')}
                                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-lg border border-slate-200 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                {copiedKey === 'csv_export_link' ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="text-emerald-700">リンクをコピーしました</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                                    <span>共有リンクをコピー</span>
                                  </>
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Googleアカウントでログインすると、ご自身のGoogleドライブ内にCSVファイルが保存され、他の端末と共有したりスプレッドシートで共同閲覧・編集できます。
                    </p>
                    <button
                      type="button"
                      onClick={onSignInGoogle}
                      className="w-full py-2.5 px-4 bg-white hover:bg-blue-50 text-slate-700 font-bold rounded-xl border border-slate-300 shadow-xs text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer"
                    >
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                      </svg>
                      <span>GoogleアカウントでログインしてGoogleドライブ保存を開始</span>
                    </button>
                  </div>
                )}
              </div>

              {/* LOCAL PC CSV DOWNLOAD */}
              <div className="pt-1">
                <span className="text-xs font-bold text-slate-700 block mb-2">端末ローカルへ保存（PC・オフライン用）</span>
                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleExecuteExportCsv}
                    disabled={targetSpots.length === 0}
                    className="w-full sm:flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>CSVファイルをダウンロード ({targetSpots.length}件)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="w-full sm:w-auto py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    title="Excelでの新規登録に便利なひな形CSVをダウンロード"
                  >
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span>ひな形CSVをDL</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: CSV IMPORT */}
          {/* ========================================================= */}
          {activeTab === 'csv_import' && (
            <div className="space-y-4">
              {/* Import Source Switcher */}
              <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-700">
                <button
                  type="button"
                  onClick={() => setCsvImportSource('local')}
                  className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    csvImportSource === 'local'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <HardDrive className="w-4 h-4 text-slate-600" />
                  <span>パソコン上のファイルから</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCsvImportSource('drive')}
                  className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    csvImportSource === 'drive'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-blue-700'
                  }`}
                >
                  <Cloud className="w-4 h-4 text-blue-600" />
                  <span>Googleドライブから選択</span>
                </button>
              </div>

              {/* SOURCE 1: Local File Drag & Drop */}
              {csvImportSource === 'local' && (
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                    importFile
                      ? 'border-violet-400 bg-violet-50/40'
                      : 'border-slate-300 hover:border-violet-400 bg-slate-50/50 hover:bg-violet-50/20'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-200 text-violet-600 flex items-center justify-center mx-auto mb-2">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>

                  {importFile ? (
                    <div>
                      <p className="text-xs font-bold text-violet-950">{importFile.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {(importFile.size / 1024).toFixed(1)} KB • クリックして別のファイルを選択
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        CSVファイルをここにドラッグ＆ドロップ
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        またはクリックしてパソコン上のファイル (.csv) を選択
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* SOURCE 2: Google Drive File Explorer */}
              {csvImportSource === 'drive' && (
                <div className="space-y-3">
                  {!currentUser ? (
                    <div className="p-5 border border-slate-200 rounded-2xl bg-slate-50 text-center space-y-3">
                      <Cloud className="w-8 h-8 text-blue-600 mx-auto" />
                      <p className="text-xs font-bold text-slate-800">
                        GoogleドライブのCSVファイルを読み込むにはログインが必要です
                      </p>
                      <button
                        type="button"
                        onClick={onSignInGoogle}
                        className="py-2.5 px-4 bg-white hover:bg-blue-50 text-slate-700 font-bold rounded-xl border border-slate-300 shadow-xs text-xs inline-flex items-center gap-2 cursor-pointer"
                      >
                        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                        </svg>
                        <span>Googleアカウントでログイン</span>
                      </button>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                      <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 font-bold text-slate-800">
                          <FolderOpen className="w-4 h-4 text-blue-600" />
                          <span>Googleドライブ内のCSVファイル</span>
                        </div>
                        <button
                          type="button"
                          onClick={fetchDriveCsvFiles}
                          disabled={isLoadingDriveCsvList}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-200 flex items-center gap-1 transition-colors cursor-pointer text-[11px]"
                        >
                          <RefreshCw className={`w-3 h-3 ${isLoadingDriveCsvList ? 'animate-spin' : ''}`} />
                          <span>更新</span>
                        </button>
                      </div>

                      {isLoadingDriveCsvList ? (
                        <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-600" />
                          <p>Googleドライブのファイルを検索中...</p>
                        </div>
                      ) : driveCsvFiles.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-500 space-y-1">
                          <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                          <p className="font-bold text-slate-700">Googleドライブ内にCSVファイルが見つかりません</p>
                          <p className="text-[11px] text-slate-400">
                            「CSVエクスポート」タブからGoogleドライブへ保存すると、ここに一覧表示されます。
                          </p>
                        </div>
                      ) : (
                        <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
                          {driveCsvFiles.map((file) => (
                            <div
                              key={file.id}
                              className="p-3 flex items-center justify-between hover:bg-slate-50 gap-2 transition-colors"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                  <span className="font-bold text-slate-800 truncate">{file.name}</span>
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                                  <span>{formatSyncTimestamp(new Date(file.modifiedTime).getTime())}</span>
                                  {file.size && <span>• {(Number(file.size) / 1024).toFixed(1)} KB</span>}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {file.webViewLink && (
                                  <a
                                    href={file.webViewLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                                    title="Googleドライブで開く"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <button
                                  type="button"
                                  disabled={loadingDriveCsvId === file.id}
                                  onClick={() => handleLoadCsvFromDrive(file)}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                                >
                                  {loadingDriveCsvId === file.id ? (
                                    <>
                                      <RefreshCw className="w-3 h-3 animate-spin text-white" />
                                      <span>読込中...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-3 h-3" />
                                      <span>このCSVを読込</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Template Download Prompt */}
              <div className="flex items-center justify-between bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-600 font-medium">
                  フォーマットや入力例を確認したい場合：
                </span>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="text-violet-600 hover:text-violet-700 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ひな形CSVをダウンロード</span>
                </button>
              </div>

              {/* Parsed Preview Section */}
              {parseResult && (
                <div className="space-y-3 pt-2 border-t border-slate-100 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>検出されたスポット: {parseResult.spots.length}件</span>
                      </span>
                    </div>

                    {parseResult.errors.length > 0 && (
                      <span className="text-[11px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        {parseResult.errors.length}件の警告
                      </span>
                    )}
                  </div>

                  {/* Preview Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
                      {parseResult.previewRows.map((row, idx) => (
                        <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-slate-50 gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800 truncate">{row.title}</span>
                              {row.isExisting && (
                                <span className="text-[9px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded">
                                  既存更新
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate mt-0.5">
                              {row.prefecture || '都道府県未設定'} • 緯度:{row.lat?.toFixed(4) ?? '-'}, 経度:{row.lng?.toFixed(4) ?? '-'}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {row.rating !== undefined && row.rating > 0 ? (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                ★{row.rating.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                未評価
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Import Mode Options */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-bold text-slate-700 block">取り込み方式の選択</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setImportMode('merge')}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                          importMode === 'merge'
                            ? 'border-violet-600 bg-violet-50 text-violet-950 font-bold shadow-2xs'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-1 font-bold">
                          <RefreshCw className="w-3.5 h-3.5 text-violet-600" />
                          <span>マージ追加・更新</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 font-normal">
                          同名・同IDは更新し、新スポットは追加（推奨）
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setImportMode('append')}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                          importMode === 'append'
                            ? 'border-violet-600 bg-violet-50 text-violet-950 font-bold shadow-2xs'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-1 font-bold">
                          <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
                          <span>すべて新規追加</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 font-normal">
                          既存は一切触れず、すべて新ピンとして登録
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setImportMode('replace')}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                          importMode === 'replace'
                            ? 'border-red-500 bg-red-50 text-red-950 font-bold shadow-2xs'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-1 font-bold text-red-700">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                          <span>全入れ替え</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 font-normal">
                          現在の全スポットを消去し、CSV内容に置き換え
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Execute Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleExecuteImportCsv}
                      className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{parseResult.spots.length}件のスポットを取り込む</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: JSON FULL BACKUP & RESTORE */}
          {/* ========================================================= */}
          {activeTab === 'json_backup' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start gap-3">
                <Database className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 space-y-1">
                  <p className="font-bold text-slate-900">完全復元用 JSON バックアップ &amp; Googleドライブ共有</p>
                  <p className="text-slate-500 leading-relaxed">
                    写真（画像データ）、登録したカスタムカテゴリ、作成したマイリスト、訪問記録など、アプリ内の全内部データをそのまま完全保存・復元・共有できます。
                  </p>
                </div>
              </div>

              {/* 1. Google Drive Save Section */}
              <div className="bg-gradient-to-br from-blue-50/90 via-indigo-50/40 to-slate-50 border border-blue-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs flex-shrink-0">
                      <Cloud className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                        <span>GoogleドライブへJSON保存</span>
                        <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold border border-blue-200">
                          クラウド同期
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        ご自身のGoogleドライブ内にJSON保存し、他端末での同期やバックアップとして安全に保管・共有できます。
                      </p>
                    </div>
                  </div>
                </div>

                {currentUser ? (
                  <div className="space-y-3 pt-1">
                    <div className="bg-white p-3 rounded-xl border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800">
                            接続中: {currentUser.displayName || currentUser.email}
                          </span>
                          {hasToken ? (
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded-full border border-emerald-200 font-bold inline-flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              認証済み
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-0.2 rounded-full border border-amber-300 font-bold">
                              要再接続
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 space-y-0.5">
                          <div>
                            最終保存日時: {lastSyncTime ? formatSyncTimestamp(lastSyncTime) : '未実行'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
                        {cloudMeta && (
                          <a
                            href={`https://drive.google.com/file/d/${cloudMeta.id}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-blue-700 font-bold rounded-lg border border-blue-200 shadow-2xs text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                            title="Googleドライブで直接ファイルを開く"
                          >
                            <ExternalLink className="w-3 h-3 text-blue-600" />
                            <span>Googleドライブで開く</span>
                          </a>
                        )}
                        {onOpenCloudSync && (
                          <button
                            type="button"
                            onClick={onOpenCloudSync}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-[11px] transition-colors cursor-pointer"
                          >
                            自動同期設定
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Filename Option for JSON */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-slate-600 font-medium">保存方式:</span>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="jsonSaveType"
                          checked={jsonSaveType === 'standard'}
                          onChange={() => setJsonSaveType('standard')}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-mono text-slate-800 font-semibold">{SYNC_FILE_NAME} (常時同期)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer ml-2">
                        <input
                          type="radio"
                          name="jsonSaveType"
                          checked={jsonSaveType === 'timestamped'}
                          onChange={() => setJsonSaveType('timestamped')}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-mono text-slate-800 font-semibold">日時付きバックアップ</span>
                      </label>
                    </div>

                    <button
                      type="button"
                      disabled={isSavingJsonToDrive || isSyncing}
                      onClick={handleSaveJsonToGoogleDrive}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSavingJsonToDrive || isSyncing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                          <span>GoogleドライブへJSON保存中...</span>
                        </>
                      ) : (
                        <>
                          <CloudUpload className="w-4 h-4 text-white" />
                          <span>GoogleドライブへJSON保存（全{spots.length}件）</span>
                        </>
                      )}
                    </button>

                    {/* Saved Result Card */}
                    {driveJsonResult && (
                      <div className="bg-white p-3 rounded-xl border border-blue-200 text-xs space-y-2 animate-in fade-in">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>JSONバックアップがGoogleドライブに保存されました</span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {formatSyncTimestamp(new Date(driveJsonResult.modifiedTime).getTime())}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 font-mono bg-slate-50 p-2 rounded border border-slate-100 flex items-center justify-between">
                          <span className="truncate">{driveJsonResult.fileName}</span>
                          <span className="text-[10px] text-slate-400 ml-2">ID: {driveJsonResult.fileId.substring(0, 10)}...</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap pt-0.5">
                          {driveJsonResult.webViewLink && (
                            <>
                              <a
                                href={driveJsonResult.webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg border border-blue-200 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                                <span>Googleドライブで開く</span>
                              </a>
                              <button
                                type="button"
                                onClick={() => handleCopyShareLink(driveJsonResult.webViewLink!, 'json_export_link')}
                                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-lg border border-slate-200 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                {copiedKey === 'json_export_link' ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="text-emerald-700">リンクをコピーしました</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                                    <span>共有リンクをコピー</span>
                                  </>
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Googleアカウントにログインすると、ご自身のGoogleドライブ上にバックアップファイルが保存され、他端末との自動同期や安全な保管が可能になります。
                    </p>
                    <button
                      type="button"
                      onClick={onSignInGoogle}
                      className="w-full py-2.5 px-4 bg-white hover:bg-blue-50 text-slate-700 font-bold rounded-xl border border-slate-300 shadow-xs text-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer"
                    >
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                      </svg>
                      <span>GoogleアカウントでログインしてGoogleドライブ保存を開始</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 2. Google Drive Restore Section */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-white space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CloudDownload className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-bold text-slate-900">
                      Googleドライブ内のJSONバックアップから復元
                    </h3>
                  </div>
                  {currentUser && (
                    <button
                      type="button"
                      onClick={fetchDriveJsonFiles}
                      disabled={isLoadingDriveJsonList}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingDriveJsonList ? 'animate-spin' : ''}`} />
                      <span>一覧を更新</span>
                    </button>
                  )}
                </div>

                {currentUser ? (
                  <div className="space-y-2.5">
                    {/* Primary Fast Restore Button: Standard Sync File */}
                    <button
                      type="button"
                      disabled={isRestoringJson || isSyncing}
                      onClick={() => setConfirmRestoreFile('standard_sync')}
                      className="w-full py-2 px-3 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100/70 text-blue-900 font-bold text-xs flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <CloudDownload className="w-4 h-4 text-blue-600" />
                        <span>標準同期データ（{SYNC_FILE_NAME}）から復元</span>
                      </span>
                      <span className="text-[10px] text-blue-600 font-normal">
                        最新同期状態を反映
                      </span>
                    </button>

                    {/* Drive JSON Files List */}
                    {isLoadingDriveJsonList ? (
                      <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                        <RefreshCw className="w-4 h-4 animate-spin mx-auto text-blue-600" />
                        <p>Googleドライブ内のバックアップを検索中...</p>
                      </div>
                    ) : driveJsonFiles.length > 0 ? (
                      <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                        {driveJsonFiles.map((file) => (
                          <div
                            key={file.id}
                            className="p-2.5 flex items-center justify-between hover:bg-slate-50 gap-2 transition-colors text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-slate-800 truncate block">{file.name}</span>
                              <span className="text-[10px] text-slate-400 mt-0.5 block">
                                {formatSyncTimestamp(new Date(file.modifiedTime).getTime())}
                                {file.size && ` • ${(Number(file.size) / 1024).toFixed(1)} KB`}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {file.webViewLink && (
                                <a
                                  href={file.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 text-slate-400 hover:text-blue-600"
                                  title="Googleドライブで開く"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => setConfirmRestoreFile(file)}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <span>このデータで復元</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-3 text-xs text-slate-400">
                        上の「一覧を更新」を押すと、Googleドライブ内の他のバックアップJSONが表示されます。
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Googleドライブからの復元を行うには、上のGoogleログインボタンから接続してください。
                  </p>
                )}
              </div>

              {/* 3. Local JSON Files (Offline) */}
              <div className="text-xs font-bold text-slate-700 pt-1">
                端末ローカルファイル（オフラインバックアップ用）
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Export JSON */}
                <div className="border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-3 bg-white hover:border-slate-300 transition-colors shadow-2xs">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Download className="w-4 h-4 text-violet-600" />
                      <span>JSONファイルを保存</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">
                      全{spots.length}件のスポット、写真、カテゴリ、マイリストを含むバックアップファイルをダウンロードします。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onExportJson}
                    className="w-full py-2.5 px-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>JSONバックアップを保存</span>
                  </button>
                </div>

                {/* Import JSON */}
                <div className="border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-3 bg-white hover:border-slate-300 transition-colors shadow-2xs">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-blue-600" />
                      <span>JSONファイルから復元</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">
                      以前保存したバックアップJSONファイルを選択して、スポットや設定を復元します。
                    </p>
                  </div>
                  <label className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
                    <Upload className="w-4 h-4 text-slate-600" />
                    <span>JSONファイルを選択して復元</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={onImportJson}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <span>スポット総登録数: <strong className="text-slate-800">{spots.length}件</strong></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 font-bold text-slate-700 transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>

      {/* MANDATORY USER CONFIRMATION MODAL FOR RESTORE (Destructive / Overwrite Action) */}
      {confirmRestoreFile && (
        <div className="fixed inset-0 z-[1400] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 text-slate-800">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Googleドライブから復元しますか？</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  現在の端末データが上書きされます
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
              <p>
                対象ファイル:{' '}
                <strong className="text-slate-800 font-mono">
                  {confirmRestoreFile === 'standard_sync'
                    ? SYNC_FILE_NAME
                    : confirmRestoreFile.name}
                </strong>
              </p>
              <p className="text-[11px] text-amber-800">
                ※この復元を実行すると、現在の端末にあるスポットリスト、カテゴリ、マイリストがバックアップの内容で置き換わります。この操作は取り消せません。
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmRestoreFile(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs cursor-pointer transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={isRestoringJson}
                onClick={handleExecuteRestoreJson}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-red-500/20 cursor-pointer transition-all disabled:opacity-50"
              >
                {isRestoringJson ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>復元中...</span>
                  </>
                ) : (
                  <>
                    <CloudDownload className="w-3.5 h-3.5 text-white" />
                    <span>復元を実行する</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
