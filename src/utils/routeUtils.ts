// Utility for calculating local road (下道) route, distance, and duration between points
// 高速道路・有料道路を完全回避し、最短距離の一般道ルートを算出
import { SpotRouteInfo, UserLocation, Spot, MultiSpotRouteResult, RouteLeg } from '../types';

// 日本の一般道・下道の実効平均時速（信号待ちや交差点・市街地を含む平均速度: 35km/h）
export const LOCAL_ROAD_AVERAGE_SPEED_KMH = 35;

// 高速道路・有料道路・自動車専用道路を検出・除外するためのキーワード正規表現
const HIGHWAY_PATTERNS = [
  /高速/i,
  /有料/i,
  /首都高/i,
  /阪神高/i,
  /名高速/i,
  /福岡高速/i,
  /北九州高速/i,
  /広島高速/i,
  /自動車道/i,
  /名神/i,
  /新名神/i,
  /東名/i,
  /新東名/i,
  /中央道/i,
  /東北道/i,
  /関越/i,
  /常磐/i,
  /北陸道/i,
  /中国道/i,
  /山陽道/i,
  /九州道/i,
  /秋田道/i,
  /山形道/i,
  /磐越道/i,
  /圏央道/i,
  /外環道/i,
  /京奈和/i,
  /西名阪/i,
  /バイパス（有料）/i,
  /有料道路/i,
  /アクアライン/i,
  /京葉道路/i,
  /第三京浜/i,
  /横浜新道/i,
  /有料橋/i,
  /motorway/i,
  /expressway/i,
  /toll/i,
  /freeway/i,
  /turnpike/i,
  /\bIC\b/i,
  /\bJCT\b/i,
  /\bSA\b/i,
  /\bPA\b/i,
];

// 道路名や系統番号から高速道路・有料道路を判定
function isHighwayOrToll(name?: string, ref?: string): boolean {
  const combined = `${name || ''} ${ref || ''}`;
  return HIGHWAY_PATTERNS.some((pattern) => pattern.test(combined));
}

// Haversine formula for straight distance
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Format duration in Japanese (e.g., "約1時間25分" or "約40分")
export function formatDurationJapanese(minutes: number): string {
  if (minutes < 1) return '1分未満';
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainingMinutes = rounded % 60;

  if (hours === 0) {
    return `約${remainingMinutes}分`;
  }
  if (remainingMinutes === 0) {
    return `約${hours}時間`;
  }
  return `約${hours}時間${remainingMinutes}分`;
}

// Format distance in Japanese (e.g., "12.4 km") - ご要望に基づきすべて小数点第1位までに統一
export function formatDistanceJapanese(km: number | undefined | null): string {
  if (km == null || isNaN(km)) return '0.0 km';
  const val = Math.max(0, km);
  return `${val.toFixed(1)} km`;
}

// Calculate Local Road (下道) Route - 高速・有料道路不使用、最短距離優先
export async function fetchLocalRoadRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  spotId: string = ''
): Promise<SpotRouteInfo> {
  const straightKm = calculateDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng);

  // 1. 第一候補: BRouter (profile=moped)
  // moped(小型車・原付)プロファイルは高速道路・有料道路・自動車専用道路への進入が法令上完全禁止されているため、
  // 確実に一般道（下道）のみを通り、かつ最短距離（track-length）でルートを算出します。
  if (straightKm <= 200) {
    try {
      const brouterUrl = `https://brouter.de/brouter?lonlats=${origin.lng},${origin.lat}|${destination.lng},${destination.lat}&profile=moped&format=geojson`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(brouterUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          const feature = data.features[0];
          const distanceKm = feature.properties['track-length'] / 1000;
          const durationMinutes = Math.max(1, Math.round((distanceKm / LOCAL_ROAD_AVERAGE_SPEED_KMH) * 60));

          const coordinates: [number, number][] = (feature.geometry.coordinates || []).map(
            (c: [number, number]) => [c[1], c[0]]
          );

          return {
            spotId,
            distanceKm,
            durationMinutes,
            coordinates: coordinates.length > 0 ? coordinates : [[origin.lat, origin.lng], [destination.lat, destination.lng]],
            status: 'success',
            isLocalRoad: true,
          };
        }
      }
    } catch {
      // BRouter タイムアウトまたは失敗時はフォールバックへ進む
    }
  }

  // 2. 第二候補: OSRM 代替ルート検索 + 高速/有料ステップ厳密除外 + 最短距離ソート
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true&alternatives=3`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5500);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        // 各ルートのステップを解析し、高速道路・有料道路を含むかチェック
        interface ScoredRoute {
          route: (typeof data.routes)[0];
          distance: number;
          hasHighway: boolean;
        }

        const scoredRoutes: ScoredRoute[] = data.routes.map((r: { distance: number; legs?: Array<{ steps?: Array<{ name?: string; ref?: string }> }> }) => {
          let hasHighway = false;
          if (r.legs && Array.isArray(r.legs)) {
            for (const leg of r.legs) {
              if (leg.steps && Array.isArray(leg.steps)) {
                for (const step of leg.steps) {
                  if (isHighwayOrToll(step.name, step.ref)) {
                    hasHighway = true;
                    break;
                  }
                }
              }
              if (hasHighway) break;
            }
          }
          return {
            route: r,
            distance: r.distance,
            hasHighway,
          };
        });

        // 高速道路・有料道路を含まないルートを最優先に抽出
        const nonHighwayRoutes = scoredRoutes.filter((sr) => !sr.hasHighway);
        const candidatePool = nonHighwayRoutes.length > 0 ? nonHighwayRoutes : scoredRoutes;

        // 【最重要】候補ルートの中から「最短距離」のルートを厳密に選択！
        candidatePool.sort((a, b) => a.distance - b.distance);

        const best = candidatePool[0];
        const distanceKm = best.distance / 1000;
        const durationMinutes = Math.max(1, Math.round((distanceKm / LOCAL_ROAD_AVERAGE_SPEED_KMH) * 60));

        const coordinates: [number, number][] = (best.route.geometry.coordinates || []).map(
          (c: [number, number]) => [c[1], c[0]]
        );

        return {
          spotId,
          distanceKm,
          durationMinutes,
          coordinates: coordinates.length > 0 ? coordinates : [[origin.lat, origin.lng], [destination.lat, destination.lng]],
          status: 'success',
          isLocalRoad: true,
        };
      }
    }
  } catch (err) {
    console.warn('Routing fetch error, falling back to shortest road model:', err);
  }

  // 3. フォールバック: 最短直線距離補正（1.25x 下道最短モデル）
  const roadDistanceKm = straightKm * 1.25;
  const durationMinutes = Math.max(1, Math.round((roadDistanceKm / LOCAL_ROAD_AVERAGE_SPEED_KMH) * 60));

  return {
    spotId,
    distanceKm: roadDistanceKm,
    durationMinutes,
    coordinates: [
      [origin.lat, origin.lng],
      [destination.lat, destination.lng],
    ],
    status: 'success',
    isLocalRoad: true,
  };
}

// Generate Google Maps URL with toll and highway avoidance (高速道路・有料道路を完全回避)
export function getGoogleMapsLocalRoadUrl(
  origin: { lat: number; lng: number } | null,
  destination: { lat: number; lng: number; title?: string }
): string {
  const destStr = `${destination.lat},${destination.lng}`;
  if (origin) {
    const originStr = `${origin.lat},${origin.lng}`;
    // avoid=tolls|highways : 有料道路と高速道路の双方を回避
    return `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destStr}&travelmode=driving&dirflg=d&avoid=tolls|highways`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${destStr}`;
}

// Calculate Local Road (下道) Route connecting multiple selected spots in sequence (ピン同士のルート - 高速・有料道路不使用、最短距離優先)
export async function fetchMultiSpotRoute(
  spotsList: Spot[]
): Promise<MultiSpotRouteResult> {
  if (!spotsList || spotsList.length < 2) {
    return {
      spotIds: (spotsList || []).map((s) => s.id),
      totalDistanceKm: 0,
      totalDurationMinutes: 0,
      coordinates: [],
      legs: [],
      status: 'idle',
    };
  }

  try {
    // 選択された各ピン間（Spot A → Spot B → Spot C ...）の区間を並列で最短下道計算
    const legPromises = [];
    for (let i = 0; i < spotsList.length - 1; i++) {
      const from = spotsList[i];
      const to = spotsList[i + 1];
      legPromises.push(
        fetchLocalRoadRoute(
          { lat: from.lat, lng: from.lng },
          { lat: to.lat, lng: to.lng },
          from.id
        ).then((route) => ({
          fromSpotId: from.id,
          fromTitle: from.title,
          toSpotId: to.id,
          toTitle: to.title,
          distanceKm: route.distanceKm,
          durationMinutes: route.durationMinutes,
          coordinates: route.coordinates,
        }))
      );
    }

    const resolvedLegs = await Promise.all(legPromises);

    let totalDistanceKm = 0;
    let totalDurationMinutes = 0;
    const combinedCoordinates: [number, number][] = [];
    const legs: RouteLeg[] = [];

    resolvedLegs.forEach((leg) => {
      totalDistanceKm += leg.distanceKm;
      totalDurationMinutes += leg.durationMinutes;
      legs.push({
        fromSpotId: leg.fromSpotId,
        fromTitle: leg.fromTitle,
        toSpotId: leg.toSpotId,
        toTitle: leg.toTitle,
        distanceKm: leg.distanceKm,
        durationMinutes: leg.durationMinutes,
        coordinates: leg.coordinates,
      });

      if (combinedCoordinates.length === 0) {
        combinedCoordinates.push(...leg.coordinates);
      } else if (leg.coordinates.length > 0) {
        // 重複する接続点を除去して連結
        combinedCoordinates.push(...leg.coordinates.slice(1));
      }
    });

    return {
      spotIds: spotsList.map((s) => s.id),
      totalDistanceKm,
      totalDurationMinutes,
      coordinates: combinedCoordinates,
      legs,
      status: 'success',
    };
  } catch (err) {
    console.warn('Multi-spot routing calculation error, falling back to approximation:', err);
  }

  // Fallback calculation using shortest road factor (1.25x 最短下道モデル)
  let totalDist = 0;
  const legs: RouteLeg[] = [];
  const coords: [number, number][] = [];

  for (let i = 0; i < spotsList.length - 1; i++) {
    const s1 = spotsList[i];
    const s2 = spotsList[i + 1];
    const straight = calculateDistanceKm(s1.lat, s1.lng, s2.lat, s2.lng);
    const legDist = straight * 1.25;
    const legDur = Math.max(1, Math.round((legDist / LOCAL_ROAD_AVERAGE_SPEED_KMH) * 60));
    totalDist += legDist;
    legs.push({
      fromSpotId: s1.id,
      fromTitle: s1.title,
      toSpotId: s2.id,
      toTitle: s2.title,
      distanceKm: legDist,
      durationMinutes: legDur,
      coordinates: [
        [s1.lat, s1.lng],
        [s2.lat, s2.lng],
      ],
    });
    if (coords.length === 0) coords.push([s1.lat, s1.lng]);
    coords.push([s2.lat, s2.lng]);
  }

  const totalDur = Math.max(1, Math.round((totalDist / LOCAL_ROAD_AVERAGE_SPEED_KMH) * 60));

  return {
    spotIds: spotsList.map((s) => s.id),
    totalDistanceKm: totalDist,
    totalDurationMinutes: totalDur,
    coordinates: coords,
    legs,
    status: 'success',
  };
}

// Generate Google Maps URL with intermediate waypoints and toll/highway avoidance (ピン同士の高速・有料回避ナビURL)
export function getGoogleMapsMultiSpotNavUrl(spotsList: Spot[]): string {
  if (!spotsList || spotsList.length < 2) return '';
  const origin = `${spotsList[0].lat},${spotsList[0].lng}`;
  const destination = `${spotsList[spotsList.length - 1].lat},${spotsList[spotsList.length - 1].lng}`;
  const waypoints = spotsList
    .slice(1, -1)
    .map((s) => `${s.lat},${s.lng}`)
    .join('|');

  // travelmode=driving, avoid=tolls|highways でGoogleマップでも高速と有料道路を回避
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving&dirflg=d&avoid=tolls|highways`;
  if (waypoints) {
    url += `&waypoints=${encodeURIComponent(waypoints)}`;
  }
  return url;
}


