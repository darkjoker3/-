// ============================================================================
// カテゴリ共通設定 (Category Configuration)
// PC・スマホ・地図・一覧・詳細・登録画面・凡例のすべてがこの共通設定を参照します
// ============================================================================

export interface CategoryItem {
  id: string;
  label: string;
  color: string;
  icon: string;
  description?: string;
}

export const CATEGORY_CONFIG: Record<string, CategoryItem> = {
  shrine: {
    id: 'shrine',
    label: '神社',
    color: '#E53935', // 赤
    icon: '⛩️',
    description: '神社・鳥居・神域',
  },
  temple: {
    id: 'temple',
    label: '寺',
    color: '#FF8F00', // 橙
    icon: '🛕',
    description: '寺院・仏閣・霊場',
  },
  ruin: {
    id: 'ruin',
    label: '廃墟',
    color: '#7E57C2', // 紫
    icon: '🏚️',
    description: '廃屋・廃ホテル・遺構',
  },
  tunnel: {
    id: 'tunnel',
    label: 'トンネル',
    color: '#455A64', // ブルーグレー
    icon: '🚇',
    description: '旧隧道・廃トンネル・峠',
  },
  hotel: {
    id: 'hotel',
    label: 'ホテル',
    color: '#EC407A', // ピンク
    icon: '🏨',
    description: 'ホテル・旅館・宿泊施設跡',
  },
  hospital: {
    id: 'hospital',
    label: '病院',
    color: '#26A69A', // 青緑
    icon: '🏥',
    description: '病院・診療所・療養所',
  },
  school: {
    id: 'school',
    label: '学校',
    color: '#42A5F5', // 青
    icon: '🏫',
    description: '学校・分校・廃校',
  },
  cemetery: {
    id: 'cemetery',
    label: '墓地',
    color: '#78909C', // グレー
    icon: '🪦',
    description: '墓地・慰霊碑・処刑場跡',
  },
  mountain: {
    id: 'mountain',
    label: '山',
    color: '#43A047', // 緑
    icon: '⛰️',
    description: '山岳・峠・樹海・山林',
  },
  lake: {
    id: 'lake',
    label: '湖',
    color: '#29B6F6', // 水色
    icon: '🌊',
    description: '湖・池・ダム・水辺',
  },
  bridge: {
    id: 'bridge',
    label: '橋',
    color: '#FDD835', // 黄
    icon: '🌉',
    description: '橋梁・吊り橋・跨線橋',
  },
  road: {
    id: 'road',
    label: '道路',
    color: '#8D6E63', // 茶
    icon: '🛣️',
    description: '峠道・旧道・林道・街道',
  },
  park: {
    id: 'park',
    label: '公園',
    color: '#7CB342', // 黄緑
    icon: '🌲',
    description: '公園・緑地・広場',
  },
  other: {
    id: 'other',
    label: 'その他',
    color: '#BDBDBD', // ライトグレー
    icon: '📍',
    description: 'その他の名所・スポット',
  },
};

// カテゴリ配列（UI表示用順序）
export const CATEGORY_LIST: CategoryItem[] = Object.values(CATEGORY_CONFIG);

// 互換性マッピング辞書（既存データや旧カテゴリIDを新カテゴリIDへ解決）
const LEGACY_ID_MAP: Record<string, string> = {
  haunted: 'ruin',
  '心霊スポット': 'ruin',
  '廃墟': 'ruin',
  '廃神社・寺': 'shrine',
  '神社': 'shrine',
  '寺': 'temple',
  'トンネル': 'tunnel',
  'ホテル': 'hotel',
  '病院': 'hospital',
  '学校': 'school',
  '墓地': 'cemetery',
  '山': 'mountain',
  '湖': 'lake',
  '橋': 'bridge',
  '道路': 'road',
  '公園': 'park',
  'その他': 'other',
  default: 'other',
};

/**
 * カテゴリIDまたは名称から共通設定のCategoryItemを取得する
 * ユーザーが編集したカスタムカテゴリ一覧（customCategories）を優先解決します
 */
export function getCategoryMeta(
  categoryIdOrName?: string | null,
  customCategories?: Array<{ id: string; name: string; color: string; icon: string }>
): CategoryItem {
  if (!categoryIdOrName) {
    return CATEGORY_CONFIG.other;
  }

  // 1. ユーザーカスタムカテゴリ設定を最優先で照合（ID一致、または名前一致）
  if (Array.isArray(customCategories) && customCategories.length > 0) {
    const foundById = customCategories.find((c) => c.id === categoryIdOrName);
    if (foundById) {
      return {
        id: foundById.id,
        label: foundById.name,
        color: foundById.color || '#8b5cf6',
        icon: foundById.icon || '👻',
      };
    }
    const foundByName = customCategories.find(
      (c) => c.name && c.name.toLowerCase() === categoryIdOrName.toLowerCase()
    );
    if (foundByName) {
      return {
        id: foundByName.id,
        label: foundByName.name,
        color: foundByName.color || '#8b5cf6',
        icon: foundByName.icon || '👻',
      };
    }
  }

  // 1-b. localStorageに保存されたカスタムカテゴリからも安全に照合（未伝播時の救済）
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('japan_map_custom_categories_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const match = parsed.find(
            (c: any) =>
              c.id === categoryIdOrName ||
              (c.name && c.name.toLowerCase() === categoryIdOrName.toLowerCase())
          );
          if (match) {
            return {
              id: match.id,
              label: match.name,
              color: match.color || '#8b5cf6',
              icon: match.icon || '👻',
            };
          }
        }
      }
    }
  } catch {
    // ignore
  }

  // 2. 直接ID一致
  if (CATEGORY_CONFIG[categoryIdOrName]) {
    return CATEGORY_CONFIG[categoryIdOrName];
  }

  // 3. 小文字での一致
  const lower = categoryIdOrName.toLowerCase().trim();
  if (CATEGORY_CONFIG[lower]) {
    return CATEGORY_CONFIG[lower];
  }

  // 4. レガシーマッピング
  const mapped = LEGACY_ID_MAP[categoryIdOrName] || LEGACY_ID_MAP[lower];
  if (mapped && CATEGORY_CONFIG[mapped]) {
    return CATEGORY_CONFIG[mapped];
  }

  // 5. ラベルでの一致検索
  const byLabel = CATEGORY_LIST.find((c) => c.label === categoryIdOrName);
  if (byLabel) {
    return byLabel;
  }

  // 6. 部分一致
  for (const item of CATEGORY_LIST) {
    if (categoryIdOrName.includes(item.label) || item.label.includes(categoryIdOrName)) {
      return item;
    }
  }

  // 7. カテゴリ名が「その他」で上書きされないよう、名称そのものを表示保持（'カスタム'は表示しない）
  const cleanLabel =
    categoryIdOrName.startsWith('custom_') || categoryIdOrName === 'custom'
      ? ''
      : categoryIdOrName;

  return {
    id: categoryIdOrName,
    label: cleanLabel,
    color: '#8b5cf6',
    icon: '👻',
    description: '登録カテゴリ',
  };
}

/**
 * スポットのプライマリ（メイン）カテゴリを安全に取得
 */
export function getSpotMainCategory(
  spot: {
    category?: string;
    categories?: string[];
    mainCategory?: string;
  },
  customCategories?: Array<{ id: string; name: string; color: string; icon: string }>
): CategoryItem {
  if (spot.mainCategory) {
    return getCategoryMeta(spot.mainCategory, customCategories);
  }
  if (Array.isArray(spot.categories) && spot.categories.length > 0) {
    return getCategoryMeta(spot.categories[0], customCategories);
  }
  if (spot.category) {
    return getCategoryMeta(spot.category, customCategories);
  }
  return CATEGORY_CONFIG.other;
}

/**
 * スポットに設定された全カテゴリを取得
 */
export function getSpotAllCategories(
  spot: {
    category?: string;
    categories?: string[];
    mainCategory?: string;
  },
  customCategories?: Array<{ id: string; name: string; color: string; icon: string }>
): CategoryItem[] {
  const result: CategoryItem[] = [];
  const seenIds = new Set<string>();

  const add = (idOrName?: string) => {
    if (!idOrName) return;
    const meta = getCategoryMeta(idOrName, customCategories);
    if (!meta || !meta.label || meta.label === 'カスタム' || meta.id === 'custom') return;
    if (!seenIds.has(meta.id)) {
      seenIds.add(meta.id);
      result.push(meta);
    }
  };

  if (spot.mainCategory) add(spot.mainCategory);
  if (Array.isArray(spot.categories)) {
    spot.categories.forEach(add);
  }
  if (spot.category) add(spot.category);

  if (result.length === 0) {
    result.push(CATEGORY_CONFIG.other);
  }

  return result;
}
