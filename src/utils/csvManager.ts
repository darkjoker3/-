import { Spot, CustomCategory, CustomList, ReferenceUrl } from '../types';
import { CATEGORY_LIST, getCategoryMeta } from '../data/categoryConfig';
import { parseGoogleMapsUrl, extractPrefectureFromAddress } from './mapParser';

/**
 * CSV カラム定義（Excelで開いた際に最も視覚的・直感的にわかりやすい日本語ヘッダー）
 */
export const CSV_COLUMNS = [
  { key: 'title', header: 'スポット名' },
  { key: 'yomigana', header: '読み仮名' },
  { key: 'prefecture', header: '都道府県' },
  { key: 'city', header: '市区町村' },
  { key: 'address', header: '住所' },
  { key: 'lat', header: '緯度' },
  { key: 'lng', header: '経度' },
  { key: 'category', header: 'メインカテゴリ' },
  { key: 'categories', header: '全カテゴリ' },
  { key: 'rating', header: '評価 (0:未評価〜5)' },
  { key: 'isVisited', header: '訪問状況 (訪問済み/未訪問)' },
  { key: 'visitedDate', header: '訪問日 (YYYY-MM-DD)' },
  { key: 'isWantToGo', header: '行きたい場所 (○/空欄)' },
  { key: 'isHaunted', header: '心霊スポット (○/空欄)' },
  { key: 'listNames', header: '所属マイリスト' },
  { key: 'notes', header: 'メモ・概要・噂' },
  { key: 'googleMapsUrl', header: 'GoogleマップURL' },
  { key: 'referenceUrls', header: '参考URL (改行またはカンマ区切り)' },
  { key: 'id', header: 'スポットID (編集時のみ)' },
] as const;

/**
 * CSV のセルを RFC 4180 に従って安全にエスケープ
 */
export function escapeCsvCell(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (
    str.includes('"') ||
    str.includes(',') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * スポット配列を Excel 互換 CSV（UTF-8 BOM付き）文字列に変換
 */
export function exportSpotsToCsvString(
  spots: Spot[],
  categories?: CustomCategory[],
  customLists?: CustomList[]
): string {
  // UTF-8 BOM（Excelで日本語の文字化けを完全防止）
  const BOM = '\uFEFF';

  // 1. ヘッダー行
  const headerRow = CSV_COLUMNS.map((col) => escapeCsvCell(col.header)).join(',');

  // 2. データ行
  const dataRows = spots.map((spot) => {
    // カテゴリ名解決
    const mainMeta = getCategoryMeta(spot.category, categories);
    const mainCatLabel = mainMeta.label || spot.category;

    const allCatsLabels = (spot.categories && spot.categories.length > 0
      ? spot.categories
      : [spot.category]
    )
      .map((cId) => getCategoryMeta(cId, categories).label || cId)
      .filter((l) => l && l !== 'カスタム');

    // マイリスト名解決
    const assignedLists = (customLists || []).filter((cl) =>
      spot.listIds?.includes(cl.id)
    );
    const listNames = assignedLists.map((l) => l.name).join('; ');

    // 評価
    let ratingStr = '未評価';
    if (
      spot.rating !== undefined &&
      spot.rating !== null &&
      Number(spot.rating) > 0
    ) {
      ratingStr = Number(spot.rating).toFixed(1);
    }

    // 参考URL
    const refsStr = (spot.referenceUrls || [])
      .map((r) => (r.title && r.title !== r.url ? `${r.title}: ${r.url}` : r.url))
      .join('\n');

    return [
      escapeCsvCell(spot.title),
      escapeCsvCell(spot.yomigana || ''),
      escapeCsvCell(spot.prefecture || ''),
      escapeCsvCell(spot.city || ''),
      escapeCsvCell(spot.address || ''),
      escapeCsvCell(spot.lat !== undefined ? spot.lat : ''),
      escapeCsvCell(spot.lng !== undefined ? spot.lng : ''),
      escapeCsvCell(mainCatLabel),
      escapeCsvCell(allCatsLabels.join(', ')),
      escapeCsvCell(ratingStr),
      escapeCsvCell(spot.isVisited ? '訪問済み' : '未訪問'),
      escapeCsvCell(spot.visitedDate || ''),
      escapeCsvCell(spot.isWantToGo ? '○' : ''),
      escapeCsvCell(spot.isHaunted ? '○' : ''),
      escapeCsvCell(listNames),
      escapeCsvCell(spot.notes || ''),
      escapeCsvCell(spot.googleMapsUrl || ''),
      escapeCsvCell(refsStr),
      escapeCsvCell(spot.id),
    ].join(',');
  });

  return BOM + [headerRow, ...dataRows].join('\r\n');
}

/**
 * ブラウザで CSV ファイルをダウンロード
 */
export function downloadCsvFile(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Excel編集用 ひな形テンプレートCSVの生成
 */
export function generateCsvTemplate(): string {
  const BOM = '\uFEFF';
  const headerRow = CSV_COLUMNS.map((col) => escapeCsvCell(col.header)).join(',');

  const sampleRows = [
    [
      '旧犬鳴トンネル',
      'きゅういぬなきとんねる',
      '福岡県',
      '宮若市',
      '福岡県宮若市犬鳴',
      '33.68962',
      '130.55198',
      'トンネル・隧道',
      'トンネル・隧道, 廃墟',
      '5.0',
      '未訪問',
      '',
      '○',
      '○',
      '最恐スポット',
      '日本三大心霊スポットとして知られる有名な旧隧道。現在は閉鎖されている。',
      'https://www.google.com/maps?q=33.68962,130.55198',
      'https://example.com/inunaki',
      '', // IDは空で新規追加
    ],
    [
      '八王子城跡',
      'はちおうじじょうあと',
      '東京都',
      '八王子市',
      '東京都八王子市元八王子町',
      '35.65340',
      '139.25580',
      '史跡・城跡・処刑場',
      '史跡・城跡・処刑場',
      '未評価',
      '訪問済み',
      '2024-05-10',
      '',
      '○',
      '',
      '戦国時代の落城悲話が残る御主殿の滝周辺で怪異の報告が多い。',
      'https://www.google.com/maps?q=35.65340,139.25580',
      '',
      '',
    ],
  ];

  const dataRows = sampleRows.map((row) => row.map(escapeCsvCell).join(','));
  return BOM + [headerRow, ...dataRows].join('\r\n');
}

/**
 * RFC 4180 準拠の CSV パーサー（改行を含むセルやクォートエスケープに対応）
 */
export function parseCsvRows(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, ''); // BOM 除去
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  let i = 0;

  while (i < clean.length) {
    const ch = clean[i];
    const nextCh = clean[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (nextCh === '"') {
          currentCell += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentCell += ch;
        i++;
        continue;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (ch === ',') {
        currentRow.push(currentCell);
        currentCell = '';
        i++;
        continue;
      } else if (ch === '\r') {
        if (nextCh === '\n') i++;
        currentRow.push(currentCell);
        currentCell = '';
        rows.push(currentRow);
        currentRow = [];
        i++;
        continue;
      } else if (ch === '\n') {
        currentRow.push(currentCell);
        currentCell = '';
        rows.push(currentRow);
        currentRow = [];
        i++;
        continue;
      } else {
        currentCell += ch;
        i++;
        continue;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

/**
 * CSV ヘッダーからカラムインデックスを柔軟にマッピング
 */
function createHeaderMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};

  const normalize = (h: string) =>
    h.toLowerCase().trim().replace(/[\s_()（）/]/g, '');

  const KEY_PATTERNS: Record<string, string[]> = {
    title: ['スポット名', '名前', '名称', 'タイトル', 'title', 'name', 'spotname'],
    yomigana: ['読み仮名', 'よみがな', 'ふりがな', 'yomigana', 'kana'],
    prefecture: ['都道府県', 'prefecture', 'pref', '県名'],
    city: ['市区町村', 'city', '市区', '町村', 'municipality'],
    address: ['住所', '所在地', 'address'],
    lat: ['緯度', 'lat', 'latitude', 'y'],
    lng: ['経度', 'lng', 'lon', 'longitude', 'x'],
    category: ['メインカテゴリ', 'カテゴリ', '種別', '分類', 'category', 'maincategory'],
    categories: ['全カテゴリ', 'サブカテゴリ', 'カテゴリ一覧', 'categories'],
    rating: ['評価', '危険度', '注目度', 'ランク', 'rating', 'dangerlevel', 'star', 'stars'],
    isVisited: ['訪問状況', '訪問済み', '訪問', '既訪', 'isvisited', 'visited'],
    visitedDate: ['訪問日', '訪問年月日', 'visiteddate', 'visitdate'],
    isWantToGo: ['行きたい場所', '行きたい', 'wanttogo', 'iswanttogo'],
    isHaunted: ['心霊スポット', '心霊', '心リスト', 'ishaunted', 'haunted'],
    listNames: ['所属マイリスト', 'マイリスト', 'リスト', 'タグ', 'listnames', 'lists', 'listids'],
    notes: ['メモ概要噂', 'メモ', '概要', '説明', '噂', 'notes', 'memo', 'description', 'rumors'],
    googleMapsUrl: ['googleマップurl', 'マップurl', '地図url', 'googlemapsurl', 'mapurl', 'url'],
    referenceUrls: ['参考url', '参考リンク', '関連リンク', 'referenceurls', 'refs', 'links'],
    id: ['スポットid', 'id', 'spotid'],
  };

  headers.forEach((rawHeader, idx) => {
    const norm = normalize(rawHeader);
    for (const [key, patterns] of Object.entries(KEY_PATTERNS)) {
      if (patterns.some((p) => norm.includes(p) || p.includes(norm))) {
        if (map[key] === undefined) {
          map[key] = idx;
        }
      }
    }
  });

  return map;
}

export interface CsvParseResult {
  spots: Spot[];
  totalRows: number;
  validRows: number;
  errors: string[];
  previewRows: Array<{
    title: string;
    prefecture?: string;
    lat?: number;
    lng?: number;
    rating?: number;
    category?: string;
    isExisting?: boolean;
  }>;
}

/**
 * CSV テキストから Spot オブジェクト群を生成・バリデーション
 */
export function parseCsvToSpots(
  csvText: string,
  categories: CustomCategory[] = [],
  customLists: CustomList[] = [],
  existingSpots: Spot[] = []
): CsvParseResult {
  const rawRows = parseCsvRows(csvText);
  if (rawRows.length < 2) {
    return {
      spots: [],
      totalRows: 0,
      validRows: 0,
      errors: ['CSVファイルにヘッダー行またはデータ行が見つかりません。'],
      previewRows: [],
    };
  }

  const headerRow = rawRows[0];
  const headerMap = createHeaderMap(headerRow);

  if (headerMap.title === undefined && headerMap.address === undefined) {
    return {
      spots: [],
      totalRows: rawRows.length - 1,
      validRows: 0,
      errors: [
        '「スポット名」または「住所」の列が検出できませんでした。ヘッダー名をご確認ください。',
      ],
      previewRows: [],
    };
  }

  const spots: Spot[] = [];
  const errors: string[] = [];
  const previewRows: CsvParseResult['previewRows'] = [];

  const getCell = (row: string[], key: string): string => {
    const idx = headerMap[key];
    if (idx === undefined || idx >= row.length) return '';
    return row[idx].trim();
  };

  const existingMapById = new Map<string, Spot>();
  const existingMapByTitle = new Map<string, Spot>();
  existingSpots.forEach((s) => {
    existingMapById.set(s.id, s);
    existingMapByTitle.set(s.title.toLowerCase().trim(), s);
  });

  for (let rIdx = 1; rIdx < rawRows.length; rIdx++) {
    const row = rawRows[rIdx];
    const rowNum = rIdx + 1;

    const rawTitle = getCell(row, 'title');
    const rawAddress = getCell(row, 'address');
    const rawMapUrl = getCell(row, 'googleMapsUrl');

    if (!rawTitle && !rawAddress && !rawMapUrl) {
      // 空白行はスキップ
      continue;
    }

    const title = rawTitle || rawAddress || '無名のスポット';

    // 緯度・経度の抽出
    let lat: number | undefined;
    let lng: number | undefined;
    const rawLat = getCell(row, 'lat');
    const rawLng = getCell(row, 'lng');

    if (rawLat && rawLng) {
      const parsedLat = parseFloat(rawLat);
      const parsedLng = parseFloat(rawLng);
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        lat = parsedLat;
        lng = parsedLng;
      }
    }

    // URL からの座標抽出フォールバック
    if ((lat === undefined || lng === undefined) && rawMapUrl) {
      const parsedFromUrl = parseGoogleMapsUrl(rawMapUrl);
      if (parsedFromUrl.lat !== undefined && parsedFromUrl.lng !== undefined) {
        lat = parsedFromUrl.lat;
        lng = parsedFromUrl.lng;
      }
    }

    // デフォルト座標（日本中心付近・後から地図で微調整可能）
    if (lat === undefined || lng === undefined) {
      lat = 35.6895;
      lng = 139.6917;
      errors.push(`${rowNum}行目: 「${title}」の緯度経度が未指定のため初期座標を設定しました`);
    }

    // 都道府県・住所の補完
    let address = rawAddress || undefined;
    let prefecture = getCell(row, 'prefecture') || undefined;
    const city = getCell(row, 'city') || undefined;

    if (!prefecture && address) {
      prefecture = extractPrefectureFromAddress(address);
    }

    // カテゴリ解決
    const rawCategory = getCell(row, 'category');
    let primaryCatId = 'haunted';

    if (rawCategory) {
      const matchedCat = categories.find(
        (c) =>
          c.name.toLowerCase() === rawCategory.toLowerCase() ||
          c.id.toLowerCase() === rawCategory.toLowerCase()
      );
      if (matchedCat) {
        primaryCatId = matchedCat.id;
      } else {
        const sysMatch = CATEGORY_LIST.find(
          (c) =>
            c.label.toLowerCase() === rawCategory.toLowerCase() ||
            c.id.toLowerCase() === rawCategory.toLowerCase()
        );
        if (sysMatch) {
          primaryCatId = sysMatch.id;
        } else {
          primaryCatId = rawCategory;
        }
      }
    }

    // 全カテゴリの配列
    const rawCategories = getCell(row, 'categories');
    let allCatIds: string[] = [primaryCatId];
    if (rawCategories) {
      const parts = rawCategories
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      parts.forEach((p) => {
        const matched = categories.find(
          (c) => c.name.toLowerCase() === p.toLowerCase() || c.id.toLowerCase() === p.toLowerCase()
        );
        const sys = CATEGORY_LIST.find(
          (c) => c.label.toLowerCase() === p.toLowerCase() || c.id.toLowerCase() === p.toLowerCase()
        );
        const resolvedId = matched?.id || sys?.id || p;
        if (!allCatIds.includes(resolvedId)) {
          allCatIds.push(resolvedId);
        }
      });
    }

    // 評価（初期設定: 0 未評価）
    const rawRating = getCell(row, 'rating');
    let rating = 0;
    if (
      rawRating &&
      rawRating !== '未評価' &&
      rawRating !== '未' &&
      rawRating !== '-' &&
      rawRating !== '0'
    ) {
      const cleaned = rawRating.replace(/[^0-9.]/g, '');
      const parsedR = parseFloat(cleaned);
      if (!isNaN(parsedR)) {
        rating = Math.max(0, Math.min(5, Math.round(parsedR * 10) / 10));
      }
    }

    // 訪問状況
    const rawVisited = getCell(row, 'isVisited');
    const isVisited =
      rawVisited === '訪問済み' ||
      rawVisited === '訪問' ||
      rawVisited === 'はい' ||
      rawVisited === '1' ||
      rawVisited.toLowerCase() === 'true';

    const visitedDate = getCell(row, 'visitedDate') || undefined;

    // 行きたい場所 / 心霊スポットフラグ
    const rawWant = getCell(row, 'isWantToGo');
    const isWantToGo =
      rawWant === '○' ||
      rawWant === '1' ||
      rawWant === 'はい' ||
      rawWant.toLowerCase() === 'true';

    const rawHaunted = getCell(row, 'isHaunted');
    const isHaunted =
      rawHaunted === '' && !rawWant
        ? true
        : rawHaunted === '○' ||
          rawHaunted === '1' ||
          rawHaunted === 'はい' ||
          rawHaunted.toLowerCase() === 'true';

    // 所属マイリスト解決
    const rawListNames = getCell(row, 'listNames');
    const listIds: string[] = [];
    if (isWantToGo) listIds.push('want_to_go');
    if (isHaunted) listIds.push('haunted');

    if (rawListNames) {
      const listParts = rawListNames
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      listParts.forEach((lp) => {
        const foundList = customLists.find(
          (cl) => cl.name.toLowerCase() === lp.toLowerCase() || cl.id.toLowerCase() === lp.toLowerCase()
        );
        if (foundList && !listIds.includes(foundList.id)) {
          listIds.push(foundList.id);
        }
      });
    }

    // 参考URL
    const rawRefs = getCell(row, 'referenceUrls');
    const referenceUrls: ReferenceUrl[] = [];
    if (rawRefs) {
      const lines = rawRefs.split(/[\n,]/).map((l) => l.trim()).filter(Boolean);
      lines.slice(0, 5).forEach((line, refIdx) => {
        let title = line;
        let url = line;
        if (line.includes(': http')) {
          const colonIdx = line.indexOf(': http');
          title = line.substring(0, colonIdx).trim();
          url = line.substring(colonIdx + 2).trim();
        }
        referenceUrls.push({
          id: `ref_${Date.now()}_${refIdx}`,
          title: title || url,
          url: url.startsWith('http') ? url : `https://${url}`,
        });
      });
    }

    // スポットID（既存のIDがあれば更新に活用）
    const rawId = getCell(row, 'id');
    const existingSpot =
      (rawId && existingMapById.get(rawId)) ||
      existingMapByTitle.get(title.toLowerCase().trim());

    const finalId = rawId || existingSpot?.id || `spot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const spotItem: Spot = {
      id: finalId,
      title,
      yomigana: getCell(row, 'yomigana') || existingSpot?.yomigana || undefined,
      prefecture,
      city,
      address,
      lat,
      lng,
      category: primaryCatId,
      categories: allCatIds,
      rating,
      isVisited,
      visitedDate,
      isWantToGo,
      isHaunted,
      listIds,
      notes: getCell(row, 'notes') || '',
      googleMapsUrl:
        rawMapUrl ||
        (existingSpot ? existingSpot.googleMapsUrl : `https://www.google.com/maps?q=${lat},${lng}`),
      referenceUrls: referenceUrls.length > 0 ? referenceUrls : (existingSpot?.referenceUrls || []),
      photos: existingSpot?.photos || [],
      createdAt: existingSpot?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    spots.push(spotItem);

    if (previewRows.length < 10) {
      previewRows.push({
        title,
        prefecture,
        lat,
        lng,
        rating,
        category: primaryCatId,
        isExisting: !!existingSpot,
      });
    }
  }

  return {
    spots,
    totalRows: spots.length,
    validRows: spots.length,
    errors,
    previewRows,
  };
}

/**
 * インポートされたスポットを既存データとマージ
 */
export function mergeImportedSpots(
  existingSpots: Spot[],
  importedSpots: Spot[],
  mode: 'merge' | 'append' | 'replace'
): {
  mergedSpots: Spot[];
  stats: { added: number; updated: number; total: number };
} {
  if (mode === 'replace') {
    return {
      mergedSpots: importedSpots,
      stats: {
        added: importedSpots.length,
        updated: 0,
        total: importedSpots.length,
      },
    };
  }

  if (mode === 'append') {
    // 完全にIDを重複させず全て追加
    const newItems = importedSpots.map((s) => ({
      ...s,
      id: `spot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
    return {
      mergedSpots: [...newItems, ...existingSpots],
      stats: {
        added: newItems.length,
        updated: 0,
        total: existingSpots.length + newItems.length,
      },
    };
  }

  // mode === 'merge' (ID一致またはタイトル一致で既存スポットを更新、なければ新規追加)
  const existingMap = new Map<string, Spot>();
  existingSpots.forEach((s) => existingMap.set(s.id, s));

  const titleMap = new Map<string, string>(); // title -> id
  existingSpots.forEach((s) => titleMap.set(s.title.toLowerCase().trim(), s.id));

  let added = 0;
  let updated = 0;

  const resultSpots = [...existingSpots];

  importedSpots.forEach((imported) => {
    let targetIndex = resultSpots.findIndex((s) => s.id === imported.id);

    if (targetIndex === -1 && imported.title) {
      const matchId = titleMap.get(imported.title.toLowerCase().trim());
      if (matchId) {
        targetIndex = resultSpots.findIndex((s) => s.id === matchId);
      }
    }

    if (targetIndex !== -1) {
      // 既存の写真を維持しつつ更新
      const old = resultSpots[targetIndex];
      resultSpots[targetIndex] = {
        ...old,
        ...imported,
        photos: imported.photos.length > 0 ? imported.photos : old.photos,
        createdAt: old.createdAt,
        updatedAt: Date.now(),
      };
      updated++;
    } else {
      resultSpots.unshift(imported);
      added++;
    }
  });

  return {
    mergedSpots: resultSpots,
    stats: {
      added,
      updated,
      total: resultSpots.length,
    },
  };
}
