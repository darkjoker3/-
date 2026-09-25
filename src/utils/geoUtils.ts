// ============================================================================
// 地理・都道府県判定および集計ユーティリティ (Geo & Prefecture Utilities)
// ============================================================================

import { Spot } from '../types';
import { JAPAN_PREFECTURES, PREFECTURE_CENTERS } from '../data/sampleSpots';
import { CATEGORY_CONFIG, getSpotMainCategory } from '../data/categoryConfig';

/**
 * 簡易 Ray-casting アルゴリズムによるポリゴン内外判定 (Point in Polygon)
 */
export function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [lat, lng] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][1];
    const yi = polygon[i][0];
    const xj = polygon[j][1];
    const yj = polygon[j][0];

    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * GeoJSON Feature から座標が属する都道府県名を特定する
 */
export function findPrefectureFromGeoJson(
  lat: number,
  lng: number,
  geoJsonData: any
): string | null {
  if (!geoJsonData || !Array.isArray(geoJsonData.features)) {
    return findNearestPrefecture(lat, lng);
  }

  for (const feature of geoJsonData.features) {
    const prefName = feature.properties?.name;
    if (!prefName) continue;

    const geometry = feature.geometry;
    if (!geometry) continue;

    if (geometry.type === 'Polygon') {
      const ring = geometry.coordinates[0];
      if (Array.isArray(ring)) {
        // GeoJSON coordinates are [lng, lat]
        const polygon: [number, number][] = ring.map((coord: number[]) => [coord[1], coord[0]]);
        if (isPointInPolygon([lat, lng], polygon)) {
          return prefName;
        }
      }
    } else if (geometry.type === 'MultiPolygon') {
      for (const poly of geometry.coordinates) {
        const ring = poly[0];
        if (Array.isArray(ring)) {
          const polygon: [number, number][] = ring.map((coord: number[]) => [coord[1], coord[0]]);
          if (isPointInPolygon([lat, lng], polygon)) {
            return prefName;
          }
        }
      }
    }
  }

  // ポリゴン外（沿岸部など）の場合は最も近い県庁所在地をフォールバック
  return findNearestPrefecture(lat, lng);
}

/**
 * 距離計算（Haversine）で最も近い都道府県を特定（フォールバック用）
 */
export function findNearestPrefecture(lat: number, lng: number): string {
  let nearestPref = '東京都';
  let minDistance = Infinity;

  for (const [pref, center] of Object.entries(PREFECTURE_CENTERS)) {
    const dLat = (lat - center.lat) * (Math.PI / 180);
    const dLng = (lng - center.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat * (Math.PI / 180)) *
        Math.cos(center.lat * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = 6371 * c;

    if (dist < minDistance) {
      minDistance = dist;
      nearestPref = pref;
    }
  }

  return nearestPref;
}

/**
 * 都道府県ごとの登録件数・訪問件数・カテゴリ別内訳の高速集計（1万件対応）
 */
export interface PrefectureStats {
  total: number;
  visited: number;
  unvisited: number;
  categoryCounts: Record<string, number>;
}

export function computePrefectureStats(
  spots: Spot[],
  targetPrefecture?: string
): PrefectureStats {
  const filtered = targetPrefecture && targetPrefecture !== 'all'
    ? spots.filter((s) => s.prefecture === targetPrefecture)
    : spots;

  const total = filtered.length;
  let visited = 0;
  const categoryCounts: Record<string, number> = {};

  for (const cat of Object.keys(CATEGORY_CONFIG)) {
    categoryCounts[cat] = 0;
  }

  for (const s of filtered) {
    if (s.isVisited) {
      visited++;
    }
    const mainCat = getSpotMainCategory(s);
    categoryCounts[mainCat.id] = (categoryCounts[mainCat.id] || 0) + 1;
  }

  return {
    total,
    visited,
    unvisited: total - visited,
    categoryCounts,
  };
}

/**
 * 2地点間の概算距離（km）計算
 */
export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}
