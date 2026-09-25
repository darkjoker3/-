import React, { useState, useRef } from 'react';
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
} from 'lucide-react';

interface DataExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  spots: Spot[];
  filteredSpots?: Spot[];
  categories: CustomCategory[];
  customLists: CustomList[];
  onSaveSpots: (newSpots: Spot[]) => void;
  onExportJson: () => void;
  onImportJson: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

export const DataExportImportModal: React.FC<DataExportImportModalProps> = ({
  isOpen,
  onClose,
  spots,
  filteredSpots = [],
  categories,
  customLists,
  onSaveSpots,
  onExportJson,
  onImportJson,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'csv_export' | 'csv_import' | 'json_backup'>('csv_export');

  // CSV Export settings
  const [exportScope, setExportScope] = useState<'all' | 'filtered' | 'want_to_go' | 'haunted' | string>('all');

  // CSV Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'append' | 'replace'>('merge');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Handle CSV Export
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

  // Handle Download Template
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

  // Handle CSV File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadCsvFile(file);
  };

  const loadCsvFile = (file: File) => {
    setImportFile(file);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const result = parseCsvToSpots(text, categories, customLists, spots);
        setParseResult(result);
        if (result.spots.length === 0 && result.errors.length > 0) {
          showToast(result.errors[0], 'error');
        } else {
          showToast(`CSVを解析しました: ${result.spots.length}件のスポットを検出`, 'info');
        }
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
      loadCsvFile(file);
    } else {
      showToast('CSVファイル (.csv) を選択してください。', 'error');
    }
  };

  // Execute CSV Import
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

  return (
    <div className="fixed inset-0 z-[1300] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-md shadow-violet-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                データ入出力 (CSV / JSONバックアップ)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Excelで直接編集可能なCSVと、完全バックアップJSONに対応
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
        <div className="px-5 pt-3 border-b border-slate-200 flex gap-2 bg-slate-50/40">
          <button
            type="button"
            onClick={() => setActiveTab('csv_export')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'csv_export'
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>CSVエクスポート (Excel用)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('csv_import')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'csv_import'
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>CSVインポート (一括登録)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('json_backup')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
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
          {/* TAB 1: CSV Export */}
          {activeTab === 'csv_export' && (
            <div className="space-y-4">
              <div className="bg-violet-50/70 border border-violet-100 rounded-xl p-3.5 flex items-start gap-3">
                <Info className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-violet-950 space-y-1 leading-relaxed">
                  <p className="font-bold">Excelでの日本語文字化け防止に対応（UTF-8 BOM付き）</p>
                  <p className="text-violet-800">
                    Microsoft Excel（Windows / Mac）、Googleスプレッドシート、Numbers、メモ帳などでダブルクリックするだけでそのまま開いて閲覧・編集できます。
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

              {/* Actions */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleExecuteExportCsv}
                  disabled={targetSpots.length === 0}
                  className="w-full sm:flex-1 py-3 px-4 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-violet-500/20 transition-all cursor-pointer"
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
          )}

          {/* TAB 2: CSV Import */}
          {activeTab === 'csv_import' && (
            <div className="space-y-4">
              {/* File Upload Area */}
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
                <div className="space-y-3 pt-2 border-t border-slate-100">
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

          {/* TAB 3: JSON Full Backup */}
          {activeTab === 'json_backup' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start gap-3">
                <Database className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 space-y-1">
                  <p className="font-bold text-slate-900">完全復元用 JSON バックアップ</p>
                  <p className="text-slate-500 leading-relaxed">
                    写真（Base64画像）、登録したカスタムカテゴリ、作成したマイリスト、訪問記録など、アプリ内の全内部データをそのまま完全保存・復元できます。
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
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
    </div>
  );
};
