export type SpotCategory = string;

export interface CustomCategory {
  id: string;
  name: string;
  color: string; // Hex color or Tailwind color
  icon: string; // Emoji
  isDefault?: boolean;
}

export interface CustomList {
  id: string;
  name: string;
  color: string; // Hex color
  icon: string; // Emoji
  description?: string;
  isSystem?: boolean; // Default built-in lists (want_to_go, haunted)
  createdAt: number;
}

export interface ReferenceUrl {
  id: string;
  title: string;
  url: string;
}

export interface SpotPhoto {
  id: string;
  url: string; // Base64 data URL or external URL
  caption?: string;
  isCover?: boolean;
}

export type SpotListTab = 'all' | 'want_to_go' | 'haunted' | 'prefecture' | string;

export interface Spot {
  id: string;
  title: string;
  yomigana?: string; // 読み仮名（ふりがな）
  lat: number;
  lng: number;
  address?: string;
  prefecture?: string;
  city?: string; // 市区町村
  category: string; // Primary Category ID (互換性用)
  categories?: string[]; // 複数選択されたカテゴリIDの配列
  mainCategory?: string; // メインカテゴリID (指定があればピン色等に優先利用)
  rating?: number; // 危険度 1 - 5 (または 0 - 5)
  dangerLevel?: number; // 危険度 (ratingと同義・エイリアス)
  description?: string; // スポット説明
  rumors?: string; // 噂されている現象
  notes: string; // メモ / 説明
  googleMapsUrl: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  youtubeUrl?: string;
  referenceUrls?: ReferenceUrl[]; // 最大5つ
  photos: SpotPhoto[];
  createdAt: number;
  updatedAt: number;
  isVisited?: boolean; // 訪問済みフラグ
  visitedDate?: string; // 訪問日 (YYYY-MM-DD)
  isWantToGo?: boolean; // 「行きたい場所」リストに登録
  isHaunted?: boolean;  // 「心霊スポット」リストに登録
  listIds?: string[];   // 所属するリストIDの配列 (CustomList の id)
}

export interface UserLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: number;
}

export interface SpotRouteInfo {
  spotId: string;
  distanceKm: number;
  durationMinutes: number;
  coordinates: [number, number][]; // [lat, lng] list for polyline
  status: 'loading' | 'success' | 'error';
  isLocalRoad: boolean; // 一般道（下道）
  errorMessage?: string;
  isApproximate?: boolean;
}

export interface RouteLeg {
  fromSpotId: string;
  fromTitle: string;
  toSpotId: string;
  toTitle: string;
  distanceKm: number;
  durationMinutes: number;
  coordinates?: [number, number][];
}

export interface MultiSpotRouteResult {
  spotIds: string[];
  totalDistanceKm: number;
  totalDurationMinutes: number;
  coordinates: [number, number][]; // [lat, lng] polyline coordinates
  legs: RouteLeg[];
  status: 'idle' | 'loading' | 'success' | 'error';
  errorMessage?: string;
}

export interface ExtractedMapData {
  title?: string;
  lat?: number;
  lng?: number;
  address?: string;
  prefecture?: string;
  originalUrl: string;
  resolvedUrl?: string;
  isFallbackCoordinate?: boolean;
}

export interface PrefectureOption {
  name: string;
  region: string;
  center: [number, number];
  zoom: number;
}
