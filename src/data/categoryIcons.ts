// 心霊スポット・探索アプリ向けカテゴリ用アイコン定義

export interface IconCategoryGroup {
  id: string;
  name: string;
  badge: string;
  icons: {
    emoji: string;
    label: string;
  }[];
}

export const SPOOKY_ICON_GROUPS: IconCategoryGroup[] = [
  {
    id: 'spooky',
    name: '心霊・オカルト・怪異',
    badge: '👻',
    icons: [
      { emoji: '👻', label: '幽霊・お化け' },
      { emoji: '💀', label: '髑髏・ドクロ' },
      { emoji: '☠️', label: '危険なドクロ' },
      { emoji: '🪦', label: '墓石・墓地' },
      { emoji: '⚰️', label: '棺桶・納骨' },
      { emoji: '🕯️', label: '蝋燭・供養' },
      { emoji: '🔥', label: '人魂・怪火' },
      { emoji: '🏮', label: '赤提灯・提灯' },
      { emoji: '👁️', label: '不気味な視線' },
      { emoji: '🩸', label: '血痕・怪我' },
      { emoji: '📿', label: '数珠・お祓い' },
      { emoji: '📜', label: 'お札・呪符' },
      { emoji: '🦇', label: 'コウモリ' },
      { emoji: '🕷️', label: '蜘蛛' },
      { emoji: '🕸️', label: '蜘蛛の巣' },
      { emoji: '🐈‍⬛', label: '黒猫' },
      { emoji: '👤', label: '不審な人影' },
      { emoji: '👥', label: '複数の人影' },
      { emoji: '😱', label: '恐怖・絶叫' },
      { emoji: '🥶', label: '悪寒・冷気' },
      { emoji: '🤫', label: '静寂・口止め' },
      { emoji: '👹', label: '鬼・怨霊' },
      { emoji: '👺', label: '天狗・妖怪' },
      { emoji: '🧟', label: '死霊・ゾンビ' },
    ],
  },
  {
    id: 'location',
    name: '廃墟・スポット・現場',
    badge: '🏚️',
    icons: [
      { emoji: '🏚️', label: '廃屋・廃墟' },
      { emoji: '🚇', label: '旧隧道・廃トンネル' },
      { emoji: '🏥', label: '廃病院・診療所' },
      { emoji: '🏨', label: '廃ホテル・旅館' },
      { emoji: '🏫', label: '廃校・分校跡' },
      { emoji: '⛩️', label: '廃神社・鳥居' },
      { emoji: '🛕', label: '寺院・霊場' },
      { emoji: '🏰', label: '洋館・古城' },
      { emoji: '🌉', label: '旧橋・投身の橋' },
      { emoji: '🕳️', label: '古井戸・落とし穴' },
      { emoji: '🌲', label: '樹海・深林' },
      { emoji: '⛰️', label: '峠・忌み山' },
      { emoji: '🌊', label: '底なし沼・水難池' },
      { emoji: '🛣️', label: '旧道・廃道' },
      { emoji: '🏚', label: '遺構' },
      { emoji: '🧱', label: '崩れた壁' },
    ],
  },
  {
    id: 'danger',
    name: '警告・危険・立ち入り禁止',
    badge: '⚠️',
    icons: [
      { emoji: '⚠️', label: '注意・警告' },
      { emoji: '⛔', label: '進入禁止' },
      { emoji: '🚷', label: '立ち入り禁止' },
      { emoji: '🚧', label: '封鎖・バリケード' },
      { emoji: '🚨', label: 'パトランプ・警報' },
      { emoji: '☣️', label: 'バイオハザード' },
      { emoji: '☢️', label: '放射線・危険地帯' },
      { emoji: '👣', label: 'ついてくる足跡' },
      { emoji: '⚡', label: '落雷・怪奇現象' },
      { emoji: '🛑', label: '一時停止・警告' },
    ],
  },
  {
    id: 'item',
    name: '呪物・アイテム・現象',
    badge: '🔮',
    icons: [
      { emoji: '🔮', label: '水晶玉・霊視' },
      { emoji: '🪞', label: '姿見・呪いの鏡' },
      { emoji: '🚪', label: '開かずの扉' },
      { emoji: '🗝️', label: '古びた鍵' },
      { emoji: '⛓️', label: '鎖・拘束' },
      { emoji: '🪓', label: '斧・事件跡' },
      { emoji: '🗡️', label: '短剣・凶器' },
      { emoji: '📻', label: '怪電波・ラジオ' },
      { emoji: '📼', label: '呪いのビデオ' },
      { emoji: '☎️', label: '怪電話・公衆電話' },
      { emoji: '🕰️', label: '止まった古時計' },
      { emoji: '🧸', label: '残された人形' },
    ],
  },
  {
    id: 'night_explore',
    name: '闇夜・探索・記録',
    badge: '🔦',
    icons: [
      { emoji: '🔦', label: '懐中電灯・夜間探索' },
      { emoji: '📷', label: '現場写真・カメラ' },
      { emoji: '📹', label: '検証動画・心霊ロケ' },
      { emoji: '🌙', label: '三日月・闇夜' },
      { emoji: '🌕', label: '満月' },
      { emoji: '🌑', label: '新月・漆黒' },
      { emoji: '🌫️', label: '濃霧・もや' },
      { emoji: '🦉', label: '夜梟・フクロウ' },
      { emoji: '🐺', label: '遠吠え・野犬' },
      { emoji: '🚗', label: '探索車両・ドライブ' },
      { emoji: '📍', label: 'ピン・地点' },
      { emoji: '⭐', label: '特選・名所' },
      { emoji: '🖤', label: 'ブラックハート' },
    ],
  },
];

// よく使われる代表的な心霊スポットアイコンのクイックリスト
export const QUICK_SPOOKY_ICONS = [
  '👻', '💀', '🪦', '🏚️', '⛩️', '🚇', '🕯️', '⚰️',
  '🔥', '👁️', '🩸', '🏥', '🏫', '🏨', '🕳️', '🌲',
  '🌉', '🦇', '⚠️', '🚷', '🔮', '🔦', '📷', '📍',
];

// 全アイコンのフラットリスト
export const ALL_SPOOKY_ICONS = Array.from(
  new Set(SPOOKY_ICON_GROUPS.flatMap((group) => group.icons.map((i) => i.emoji)))
);

// 心霊スポット向けおすすめカテゴリのプリセット定義
export interface SpookyCategoryPreset {
  name: string;
  icon: string;
  color: string;
}

export const SPOOKY_CATEGORY_PRESETS: SpookyCategoryPreset[] = [
  { name: '怪奇現象・心霊現場', icon: '👻', color: '#8b5cf6' },
  { name: '旧隧道・廃トンネル', icon: '🚇', color: '#455A64' },
  { name: '廃病院・診療所跡', icon: '🏥', color: '#26A69A' },
  { name: '廃校・分校跡', icon: '🏫', color: '#42A5F5' },
  { name: '廃ホテル・廃旅館', icon: '🏨', color: '#EC407A' },
  { name: '墓地・慰霊碑・処刑場', icon: '🪦', color: '#78909C' },
  { name: '古井戸・忌み地', icon: '🕳️', color: '#64748b' },
  { name: '樹海・深林・忌み山', icon: '🌲', color: '#43A047' },
  { name: '人魂・怪火目撃地', icon: '🔥', color: '#ef4444' },
  { name: '立ち入り禁止・危険地帯', icon: '🚷', color: '#f97316' },
  { name: '洋館・廃屋', icon: '🏚️', color: '#7E57C2' },
  { name: '呪物・供養塔', icon: '🔮', color: '#1e293b' },
];
