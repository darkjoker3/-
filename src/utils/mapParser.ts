import { ExtractedMapData } from '../types';
import { JAPAN_PREFECTURES, PREFECTURE_CENTERS } from '../data/sampleSpots';

/**
 * 住所文字列から日本の47都道府県を自動抽出する
 * 例:
 * "東京都港区芝公園4丁目2-8" -> "東京都"
 * "福岡県宮若市犬鳴" -> "福岡県"
 * "北海道札幌市..." -> "北海道"
 * "京都府京都市..." -> "京都府"
 * "大阪府大阪市..." -> "大阪府"
 */
export function extractPrefectureFromAddress(address?: string): string | undefined {
  if (!address) return undefined;
  const trimmed = address.trim();
  if (!trimmed) return undefined;

  // 1. 完全名称マッチ（"東京都", "北海道", "京都府", "大阪府", "青森県", etc.）
  for (const pref of JAPAN_PREFECTURES) {
    if (trimmed.includes(pref)) {
      return pref;
    }
  }

  // 2. 「都・道・府・県」抜きの先頭・部分マッチ
  for (const pref of JAPAN_PREFECTURES) {
    const baseName = pref.replace(/[都道府県]$/, '');
    // 2文字以上のベース名（例: "東京", "京都", "大阪", "福岡", "神奈川" など）
    if (baseName.length >= 2) {
      if (trimmed.startsWith(baseName)) {
        return pref;
      }
    }
  }

  return undefined;
}

/**
 * Google Maps URLのパターンから座標・タイトル等をクライアントサイドで解析
 */
export function parseGoogleMapsUrl(input: string): ExtractedMapData {
  const trimmed = input.trim();
  const result: ExtractedMapData = {
    originalUrl: trimmed,
  };

  // Case 1: プレーンな座標入力 (例: "35.6585805, 139.7454329" または "35.6585805 139.7454329")
  const plainCoordMatch = trimmed.match(/^([+-]?\d+(?:\.\d+)?)[,\s]+([+-]?\d+(?:\.\d+)?)$/);
  if (plainCoordMatch) {
    const lat = parseFloat(plainCoordMatch[1]);
    const lng = parseFloat(plainCoordMatch[2]);
    if (isValidLatLng(lat, lng)) {
      result.lat = lat;
      result.lng = lng;
      result.title = `地点 (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      return result;
    }
  }

  try {
    // 1. Coordinates after @: /@35.6585805,139.7454329
    const atCoordMatch = trimmed.match(/@([+-]?\d+(?:\.\d+)?),([+-]?\d+(?:\.\d+)?)/);
    if (atCoordMatch) {
      const lat = parseFloat(atCoordMatch[1]);
      const lng = parseFloat(atCoordMatch[2]);
      if (isValidLatLng(lat, lng)) {
        result.lat = lat;
        result.lng = lng;
      }
    }

    // 2. Coordinates in data parameters: !3d35.6585805!4d139.7454329
    const dataCoordMatch = trimmed.match(/!3d([+-]?\d+(?:\.\d+)?)[^!]*!4d([+-]?\d+(?:\.\d+)?)/);
    if (!result.lat && dataCoordMatch) {
      const lat = parseFloat(dataCoordMatch[1]);
      const lng = parseFloat(dataCoordMatch[2]);
      if (isValidLatLng(lat, lng)) {
        result.lat = lat;
        result.lng = lng;
      }
    }

    // 3. Coordinates in query parameters: ?q=35.65858,139.74543 or ?ll=... or ?query=...
    const queryCoordMatch = trimmed.match(/[?&](?:q|ll|query|loc:|center)=([+-]?\d+(?:\.\d+)?),([+-]?\d+(?:\.\d+)?)/i);
    if (!result.lat && queryCoordMatch) {
      const lat = parseFloat(queryCoordMatch[1]);
      const lng = parseFloat(queryCoordMatch[2]);
      if (isValidLatLng(lat, lng)) {
        result.lat = lat;
        result.lng = lng;
      }
    }

    // 4. Place name in path: /maps/place/Tokyo+Tower or /maps/search/Tokyo+Tower
    const placePathMatch = trimmed.match(/\/maps\/(?:place|search)\/([^/@?]+)/i);
    if (placePathMatch && placePathMatch[1]) {
      try {
        const decoded = decodeURIComponent(placePathMatch[1].replace(/\+/g, ' '));
        // Avoid coordinates string as title if it was /place/35.65,139.74
        if (!decoded.match(/^[+-]?\d+(?:\.\d+)?[,\s]+[+-]?\d+(?:\.\d+)?$/)) {
          result.title = decoded;
          // If the decoded place name looks like an address, store as address too
          const pref = extractPrefectureFromAddress(decoded);
          if (pref) {
            result.prefecture = pref;
            result.address = decoded;
          }
        }
      } catch {
        result.title = placePathMatch[1].replace(/\+/g, ' ');
      }
    }

    // 5. Place name in query parameter if no title yet: ?q=Place+Name or ?query=...
    if (!result.title) {
      const queryNameMatch = trimmed.match(/[?&](?:q|query)=([^&]+)/i);
      if (queryNameMatch && queryNameMatch[1]) {
        try {
          const decoded = decodeURIComponent(queryNameMatch[1].replace(/\+/g, ' '));
          if (!decoded.match(/^[+-]?\d+(?:\.\d+)?[,\s]+[+-]?\d+(?:\.\d+)?$/)) {
            result.title = decoded;
            const pref = extractPrefectureFromAddress(decoded);
            if (pref) {
              result.prefecture = pref;
              result.address = decoded;
            }
          }
        } catch {
          // ignore
        }
      }
    }
  } catch (e) {
    console.error('Error parsing Google Maps URL:', e);
  }

  return result;
}

export function isGoogleMapsShortLink(url: string): boolean {
  return /maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url);
}

export function isGoogleMapsUrl(input: string): boolean {
  return /google\.[a-z.]+\/maps|maps\.google\.|goo\.gl\/maps|maps\.app\.goo\.gl/i.test(input);
}

export function isValidLatLng(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function isWithinJapan(lat: number, lng: number): boolean {
  return lat >= 20.0 && lat <= 46.0 && lng >= 122.0 && lng <= 154.0;
}

/**
 * サーバーの /api/resolve-maps-url を使って短縮URLやGoogleマップリンクを展開・解析
 */
export async function resolveGoogleMapsUrlViaServer(url: string): Promise<ExtractedMapData | null> {
  try {
    const res = await fetch(`/api/resolve-maps-url?url=${encodeURIComponent(url.trim())}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.success) {
      const extracted: ExtractedMapData = {
        originalUrl: url.trim(),
        resolvedUrl: data.finalUrl,
        title: data.title,
        lat: data.lat,
        lng: data.lng,
        address: data.address,
        prefecture: data.prefecture,
        isFallbackCoordinate: !!data.isFallbackCoordinate,
      };

      if (data.address && !extracted.prefecture) {
        const pref = extractPrefectureFromAddress(data.address);
        if (pref) extracted.prefecture = pref;
      }

      return extracted;
    }
    return null;
  } catch (err) {
    console.warn('Server resolve-maps-url error, falling back:', err);
    return null;
  }
}

/**
 * 住所・地名から高精度に緯度経度を取得 (サーバーAPI ＞ 国土地理院 ＞ Nominatim)
 */
export async function geocodeAddressOrPlace(query: string): Promise<{
  lat: number;
  lng: number;
  address: string;
  title: string;
  prefecture?: string;
} | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  // 1. サーバーAPI (/api/geocode)
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && isValidLatLng(data.lat, data.lng)) {
        const addr = data.address || data.displayName || trimmed;
        const pref = extractPrefectureFromAddress(addr) || extractPrefectureFromAddress(trimmed);
        return {
          lat: data.lat,
          lng: data.lng,
          address: addr,
          title: data.displayName || trimmed,
          prefecture: pref,
        };
      }
    }
  } catch (e) {
    console.warn('Server geocode API failed, trying direct GSI:', e);
  }

  // 2. 国土地理院 住所検索API（ブラウザ直接アクセス）
  try {
    const gsiRes = await fetch(`https://msearch.gsi.go.jp/address-search/queryString?q=${encodeURIComponent(trimmed)}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (gsiRes.ok) {
      const gsiData = await gsiRes.json();
      if (Array.isArray(gsiData) && gsiData.length > 0 && gsiData[0].geometry?.coordinates) {
        const [lon, lat] = gsiData[0].geometry.coordinates;
        if (isValidLatLng(lat, lon)) {
          const title = gsiData[0].properties?.title || trimmed;
          const pref = extractPrefectureFromAddress(title) || extractPrefectureFromAddress(trimmed);
          return {
            lat,
            lng: lon,
            address: title,
            title,
            prefecture: pref,
          };
        }
      }
    }
  } catch (e) {
    console.warn('Direct GSI geocode failed:', e);
  }

  // 3. Nominatim API フォールバック
  try {
    const encoded = encodeURIComponent(trimmed);
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&countrycodes=jp&limit=1&accept-language=ja`,
      {
        headers: { 'Accept': 'application/json' },
      }
    );
    if (nomRes.ok) {
      const nomData = await nomRes.json();
      if (Array.isArray(nomData) && nomData.length > 0) {
        const lat = parseFloat(nomData[0].lat);
        const lng = parseFloat(nomData[0].lon);
        if (isValidLatLng(lat, lng)) {
          const addr = nomData[0].display_name;
          const pref = extractPrefectureFromAddress(addr) || extractPrefectureFromAddress(trimmed);
          return {
            lat,
            lng,
            address: addr,
            title: trimmed,
            prefecture: pref,
          };
        }
      }
    }
  } catch (e) {
    console.warn('Nominatim geocode failed:', e);
  }

  return null;
}

/**
 * 逆ジオコーディング (座標から住所・都道府県を取得)
 */
export async function reverseGeocode(lat: number, lng: number): Promise<{ address: string; prefecture?: string } | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ja`, {
      headers: {
        'Accept': 'application/json',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.address) {
      const addr = data.address;
      let prefecture = addr.province || addr.state || addr.region;

      const parts = [
        prefecture,
        addr.city || addr.ward || addr.town || addr.village,
        addr.suburb || addr.neighbourhood,
        addr.road,
      ].filter(Boolean);

      const fullAddress = parts.join('') || data.display_name;

      // 住所文字列からも都道府県を抽出して補完
      if (!prefecture || !JAPAN_PREFECTURES.includes(prefecture)) {
        prefecture = extractPrefectureFromAddress(fullAddress) || prefecture;
      }

      return {
        address: fullAddress,
        prefecture,
      };
    }
    return null;
  } catch (err) {
    console.warn('Reverse geocode error:', err);
    return null;
  }
}

/**
 * 【統合解析関数】
 * Googleマップの共有リンクまたは住所・地名から、座標・スポット名・住所・都道府県を一括解析・自動取得する。
 * 1. Googleマップの共有リンク（短縮リンク maps.app.goo.gl を含む）を優先解析
 * 2. 共有リンクから直接座標が取れなかった場合は、URLに含まれる地名・住所から直接ジオコーディング
 * 3. URLではない場合（「東京都八王子市上川町」などの住所・地名）は、住所から直接ピン位置を取得
 * 4. 取得した住所から自動的に47都道府県を抽出して割り当てる
 */
export async function parseAndResolveMapInput(input: string): Promise<ExtractedMapData> {
  const trimmed = input.trim();
  const result: ExtractedMapData = {
    originalUrl: trimmed,
  };

  if (!trimmed) return result;

  const isUrl = /^https?:\/\//i.test(trimmed) || isGoogleMapsUrl(trimmed);

  // 1. GoogleマップURLの場合
  if (isUrl) {
    // 1-1. まずサーバーサイドでURL解決を試みる（短縮リンク maps.app.goo.gl も完全展開）
    const serverResult = await resolveGoogleMapsUrlViaServer(trimmed);
    if (serverResult) {
      result.resolvedUrl = serverResult.resolvedUrl;
      result.title = serverResult.title;
      result.address = serverResult.address;
      result.prefecture = serverResult.prefecture;
      if (serverResult.lat !== undefined && serverResult.lng !== undefined) {
        result.lat = serverResult.lat;
        result.lng = serverResult.lng;
      }
    }

    // 1-2. クライアントサイド正規表現でも補完（サーバー未取得時または追加情報）
    const clientResult = parseGoogleMapsUrl(result.resolvedUrl || trimmed);
    if (!result.lat && clientResult.lat !== undefined && clientResult.lng !== undefined) {
      result.lat = clientResult.lat;
      result.lng = clientResult.lng;
    }
    if (!result.title && clientResult.title) {
      result.title = clientResult.title;
    }
    if (!result.address && clientResult.address) {
      result.address = clientResult.address;
    }
    if (!result.prefecture && clientResult.prefecture) {
      result.prefecture = clientResult.prefecture;
    }

    // 1-3. 座標が取れた場合、住所がなければ逆ジオコーディングで住所＆都道府県を自動取得
    if (result.lat !== undefined && result.lng !== undefined && isValidLatLng(result.lat, result.lng)) {
      if (!result.address || !result.prefecture) {
        const rev = await reverseGeocode(result.lat, result.lng);
        if (rev) {
          if (!result.address && rev.address) result.address = rev.address;
          if (!result.prefecture && rev.prefecture) result.prefecture = rev.prefecture;
        }
      }
      // 住所から都道府県を再チェック
      if (result.address && !result.prefecture) {
        result.prefecture = extractPrefectureFromAddress(result.address);
      }
      return result;
    }

    // 1-4. 座標が取れなかった場合: タイトルやURL内の地名・住所から直接ジオコーディング！
    const queryToGeocode = result.title || result.address;
    if (queryToGeocode && queryToGeocode !== 'Google マップ' && queryToGeocode !== 'Google Maps') {
      const geo = await geocodeAddressOrPlace(queryToGeocode);
      if (geo) {
        result.lat = geo.lat;
        result.lng = geo.lng;
        if (!result.address) result.address = geo.address;
        if (!result.prefecture) result.prefecture = geo.prefecture || extractPrefectureFromAddress(geo.address);
        return result;
      }
    }
  }

  // 2. URLではない、またはURLから座標が解析できなかった場合：住所・地名から直接ピンを立てる
  const geo = await geocodeAddressOrPlace(trimmed);
  if (geo) {
    result.lat = geo.lat;
    result.lng = geo.lng;
    result.title = result.title || geo.title || trimmed;
    result.address = geo.address;
    result.prefecture = geo.prefecture || extractPrefectureFromAddress(geo.address) || extractPrefectureFromAddress(trimmed);
    return result;
  }

  // 3. 【座標が取れなかった場合の確実なピン設置保証】
  // URLやタイトルに都道府県名が含まれているか判定
  if (result.lat === undefined || result.lng === undefined || !isValidLatLng(result.lat, result.lng)) {
    const candidatePref =
      result.prefecture ||
      extractPrefectureFromAddress(result.address) ||
      extractPrefectureFromAddress(result.title) ||
      extractPrefectureFromAddress(trimmed);

    if (candidatePref && PREFECTURE_CENTERS[candidatePref]) {
      result.lat = PREFECTURE_CENTERS[candidatePref].lat;
      result.lng = PREFECTURE_CENTERS[candidatePref].lng;
      result.prefecture = candidatePref;
      result.isFallbackCoordinate = true;
    } else {
      // 日本の中心（東京）をデフォルト座標としてピン設置を保証
      result.lat = 35.6895;
      result.lng = 139.6917;
      result.prefecture = '東京都';
      result.isFallbackCoordinate = true;
    }

    if (!result.title) {
      result.title = isUrl ? '共有リンクスポット' : trimmed;
    }
  }

  // 4. 住所・都道府県の最終補完
  if (result.lat !== undefined && result.lng !== undefined && (!result.address || !result.prefecture)) {
    const rev = await reverseGeocode(result.lat, result.lng);
    if (rev) {
      if (!result.address) result.address = rev.address;
      if (!result.prefecture) result.prefecture = rev.prefecture || extractPrefectureFromAddress(rev.address);
    }
  }

  return result;
}

// 互換性エクスポート
export const geocodePlaceName = async (placeName: string) => {
  const res = await geocodeAddressOrPlace(placeName);
  if (!res) return null;
  return {
    lat: res.lat,
    lng: res.lng,
    displayName: res.address,
  };
};
