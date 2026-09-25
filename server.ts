import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // 都道府県の県庁所在地・代表座標テーブル
  const PREFECTURE_CENTERS_SERVER: Record<string, { lat: number; lng: number }> = {
    北海道: { lat: 43.0642, lng: 141.3469 },
    青森県: { lat: 40.8244, lng: 140.7400 },
    岩手県: { lat: 39.7036, lng: 141.1527 },
    宮城県: { lat: 38.2688, lng: 140.8721 },
    秋田県: { lat: 39.7186, lng: 140.1024 },
    山形県: { lat: 38.2404, lng: 140.3636 },
    福島県: { lat: 37.7503, lng: 140.4676 },
    茨城県: { lat: 36.3418, lng: 140.4468 },
    栃木県: { lat: 36.5658, lng: 139.8836 },
    群馬県: { lat: 36.3912, lng: 139.0608 },
    埼玉県: { lat: 35.8574, lng: 139.6489 },
    千葉県: { lat: 35.6051, lng: 140.1233 },
    東京都: { lat: 35.6895, lng: 139.6917 },
    神奈川県: { lat: 35.4478, lng: 139.6425 },
    新潟県: { lat: 37.9026, lng: 139.0232 },
    富山県: { lat: 36.6953, lng: 137.2113 },
    石川県: { lat: 36.5947, lng: 136.6256 },
    福井県: { lat: 36.0652, lng: 136.2216 },
    山梨県: { lat: 35.6639, lng: 138.5684 },
    長野県: { lat: 36.6513, lng: 138.1810 },
    岐阜県: { lat: 35.3912, lng: 136.7223 },
    静岡県: { lat: 34.9770, lng: 138.3831 },
    愛知県: { lat: 35.1802, lng: 136.9066 },
    三重県: { lat: 34.7303, lng: 136.5086 },
    滋賀県: { lat: 35.0045, lng: 135.8686 },
    京都府: { lat: 35.0210, lng: 135.7556 },
    大阪府: { lat: 34.6863, lng: 135.5200 },
    兵庫県: { lat: 34.6913, lng: 135.1830 },
    奈良県: { lat: 34.6853, lng: 135.8328 },
    和歌山県: { lat: 34.2260, lng: 135.1675 },
    鳥取県: { lat: 35.5039, lng: 134.2377 },
    島根県: { lat: 35.4723, lng: 133.0505 },
    岡山県: { lat: 34.6618, lng: 133.9344 },
    広島県: { lat: 34.3966, lng: 132.4596 },
    山口県: { lat: 34.1859, lng: 131.4705 },
    徳島県: { lat: 34.0658, lng: 134.5594 },
    香川県: { lat: 34.3401, lng: 134.0434 },
    愛媛県: { lat: 33.8417, lng: 132.7661 },
    高知県: { lat: 33.5597, lng: 133.5311 },
    福岡県: { lat: 33.6068, lng: 130.4183 },
    佐賀県: { lat: 33.2494, lng: 130.2988 },
    長崎県: { lat: 32.7448, lng: 129.8737 },
    熊本県: { lat: 32.7898, lng: 130.7417 },
    大分県: { lat: 33.2382, lng: 131.6126 },
    宮崎県: { lat: 31.9111, lng: 131.4239 },
    鹿児島県: { lat: 31.5602, lng: 130.5581 },
    沖縄県: { lat: 26.2124, lng: 127.6809 },
  };

  const JAPAN_PREFECTURES_LIST = Object.keys(PREFECTURE_CENTERS_SERVER);

  // サーバー内部ジオコーディング関数
  async function internalGeocode(query: string): Promise<{ lat: number; lng: number; address: string } | null> {
    const q = query.trim();
    if (!q) return null;

    // 1. 国土地理院住所検索
    try {
      const gsiRes = await fetch(`https://msearch.gsi.go.jp/address-search/queryString?q=${encodeURIComponent(q)}`, {
        headers: { 'Accept': 'application/json' },
      });
      if (gsiRes.ok) {
        const gsiData = await gsiRes.json();
        if (Array.isArray(gsiData) && gsiData.length > 0 && gsiData[0].geometry?.coordinates) {
          const [lon, lat] = gsiData[0].geometry.coordinates;
          if (!isNaN(lat) && !isNaN(lon)) {
            return {
              lat,
              lng: lon,
              address: gsiData[0].properties?.title || q,
            };
          }
        }
      }
    } catch {
      // ignore
    }

    // 2. OpenStreetMap Nominatim
    try {
      const nomRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=jp&limit=1&accept-language=ja`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'JapanMapSpotLog/1.0',
          },
        }
      );
      if (nomRes.ok) {
        const nomData = await nomRes.json();
        if (Array.isArray(nomData) && nomData.length > 0) {
          const lat = parseFloat(nomData[0].lat);
          const lon = parseFloat(nomData[0].lon);
          if (!isNaN(lat) && !isNaN(lon)) {
            return {
              lat,
              lng: lon,
              address: nomData[0].display_name,
            };
          }
        }
      }
    } catch {
      // ignore
    }

    return null;
  }

  // API 1: Google Maps 共有リンク / 短縮URLの解決
  app.get('/api/resolve-maps-url', async (req, res) => {
    try {
      const rawUrl = req.query.url as string;
      if (!rawUrl) {
        res.status(400).json({ error: 'url parameter is required' });
        return;
      }

      let targetUrl = rawUrl.trim();
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = `https://${targetUrl}`;
      }

      // Fetch with redirect follow and Google consent bypass headers
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
          'Cookie': 'SOCS=CAESEwgDEgk2NzI2Mjg3MDcaAmphIAEaBgiA_LyaBg; CONSENT=PENDING+999;',
        },
        redirect: 'follow',
      });

      let finalUrl = response.url || targetUrl;
      let html = await response.text();

      // Check if redirected to Google consent page (consent.google.com)
      if (finalUrl.includes('consent.google.com')) {
        const contMatch = finalUrl.match(/[?&]continue=([^&]+)/i);
        if (contMatch && contMatch[1]) {
          try {
            const decodedRealUrl = decodeURIComponent(contMatch[1]);
            finalUrl = decodedRealUrl;
            // Re-fetch the actual Google Maps page with consent cookies
            const realRes = await fetch(decodedRealUrl, {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language': 'ja,en;q=0.9',
                'Cookie': 'SOCS=CAESEwgDEgk2NzI2Mjg3MDcaAmphIAEaBgiA_LyaBg;',
              },
              redirect: 'follow',
            });
            if (realRes.ok) {
              finalUrl = realRes.url || decodedRealUrl;
              html = await realRes.text();
            }
          } catch (e) {
            console.warn('Failed to follow continue URL from consent page:', e);
          }
        }
      }

      // 1. Extract title
      let title: string | undefined;
      const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
      if (ogTitleMatch && ogTitleMatch[1]) {
        title = ogTitleMatch[1].replace(/\s*-\s*Google\s*(?:マップ|Maps)$/i, '').trim();
      }

      if (!title) {
        const titleTagMatch = html.match(/<title>([^<]+)<\/title>/i);
        if (titleTagMatch && titleTagMatch[1]) {
          title = titleTagMatch[1].replace(/\s*-\s*Google\s*(?:マップ|Maps)$/i, '').trim();
        }
      }

      // Check place name from URL path if title still looks like "Google Maps"
      const placeMatch = finalUrl.match(/\/maps\/(?:place|search)\/([^/@?]+)/i);
      if (placeMatch && placeMatch[1]) {
        try {
          const decoded = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
          if (!decoded.match(/^[+-]?\d+(?:\.\d+)?[,\s]+[+-]?\d+(?:\.\d+)?$/)) {
            if (!title || title === 'Google マップ' || title === 'Google Maps') {
              title = decoded;
            }
          }
        } catch {
          if (!title) title = placeMatch[1].replace(/\+/g, ' ');
        }
      }

      // 2. Extract address
      let address: string | undefined;
      const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
      if (ogDescMatch && ogDescMatch[1]) {
        const desc = ogDescMatch[1].trim();
        if (desc && !desc.includes('Google マップで地図を見よう') && !desc.includes('Find local businesses') && !desc.includes('Google Maps')) {
          address = desc;
        }
      }

      // 3. Parse coordinates from URL and HTML
      let lat: number | undefined;
      let lng: number | undefined;

      // 3-1. Check finalUrl @lat,lng
      const atMatch = finalUrl.match(/@([+-]?\d+(?:\.\d+)?),([+-]?\d+(?:\.\d+)?)/);
      if (atMatch) {
        lat = parseFloat(atMatch[1]);
        lng = parseFloat(atMatch[2]);
      }

      // 3-2. Check !3dlat!4dlng
      if (!lat) {
        const dataMatch = finalUrl.match(/!3d([+-]?\d+(?:\.\d+)?)[^!]*!4d([+-]?\d+(?:\.\d+)?)/);
        if (dataMatch) {
          lat = parseFloat(dataMatch[1]);
          lng = parseFloat(dataMatch[2]);
        }
      }

      // 3-3. Check query params ?q=lat,lng or ll=lat,lng
      if (!lat) {
        const qMatch = finalUrl.match(/[?&](?:q|ll|query|loc:|center)=([+-]?\d+(?:\.\d+)?),([+-]?\d+(?:\.\d+)?)/i);
        if (qMatch) {
          lat = parseFloat(qMatch[1]);
          lng = parseFloat(qMatch[2]);
        }
      }

      // 3-4. Check staticmap center in HTML: maps.google.com/maps/api/staticmap?center=lat%2Clng
      if (!lat) {
        const staticMatch = html.match(/staticmap\?center=([+-]?\d+(?:\.\d+)?)(?:%2C|,)([+-]?\d+(?:\.\d+)?)/i);
        if (staticMatch) {
          const l1 = parseFloat(staticMatch[1]);
          const l2 = parseFloat(staticMatch[2]);
          if (l1 >= -90 && l1 <= 90 && l2 >= -180 && l2 <= 180) {
            lat = l1;
            lng = l2;
          }
        }
      }

      // 3-5. Check schema.org / itemprop latitude & longitude
      if (!lat) {
        const latItemMatch = html.match(/itemprop=["']latitude["']\s+content=["']([+-]?\d+(?:\.\d+)?)["']/i);
        const lngItemMatch = html.match(/itemprop=["']longitude["']\s+content=["']([+-]?\d+(?:\.\d+)?)["']/i);
        if (latItemMatch && lngItemMatch) {
          lat = parseFloat(latItemMatch[1]);
          lng = parseFloat(lngItemMatch[1]);
        }
      }

      // 3-6. Search HTML for coordinates in initialization state
      if (!lat) {
        const htmlCoordMatch = html.match(/\[null,null,([+-]?\d{1,3}\.\d+),([+-]?\d{1,3}\.\d+)\]/) ||
          html.match(/!3d([+-]?\d{1,3}\.\d+)!4d([+-]?\d{1,3}\.\d+)/) ||
          html.match(/center=([+-]?\d{1,3}\.\d+)%2C([+-]?\d{1,3}\.\d+)/);
        if (htmlCoordMatch) {
          const l1 = parseFloat(htmlCoordMatch[1]);
          const l2 = parseFloat(htmlCoordMatch[2]);
          if (l1 >= -90 && l1 <= 90 && l2 >= -180 && l2 <= 180) {
            lat = l1;
            lng = l2;
          }
        }
      }

      // 4. 【座標がURLやHTMLにない場合】: サーバー側でスポット名・住所から即座にジオコーディング補完！
      if (!lat && (title || address)) {
        // First try address if present
        if (address) {
          const geoAddr = await internalGeocode(address);
          if (geoAddr) {
            lat = geoAddr.lat;
            lng = geoAddr.lng;
          }
        }
        // If still not found, try title
        if (!lat && title && title !== 'Google マップ' && title !== 'Google Maps') {
          const geoTitle = await internalGeocode(title);
          if (geoTitle) {
            lat = geoTitle.lat;
            lng = geoTitle.lng;
            if (!address) address = geoTitle.address;
          }
        }
      }

      // 5. 【それでも座標が未解決の場合】: 都道府県名から代表座標を割り当て
      let prefecture: string | undefined;
      const combinedText = `${address || ''} ${title || ''} ${finalUrl}`;
      for (const pref of JAPAN_PREFECTURES_LIST) {
        if (combinedText.includes(pref)) {
          prefecture = pref;
          break;
        }
      }

      // 都道府県が見つかった場合、その県庁所在地の座標をフォールバックとして採用
      let isFallbackCoordinate = false;
      if (!lat && prefecture && PREFECTURE_CENTERS_SERVER[prefecture]) {
        lat = PREFECTURE_CENTERS_SERVER[prefecture].lat;
        lng = PREFECTURE_CENTERS_SERVER[prefecture].lng;
        isFallbackCoordinate = true;
      }

      // 都道府県も不明な場合、日本の中心（東京）をデフォルト座標として採用しピン作成を保証！
      if (!lat) {
        lat = 35.6895;
        lng = 139.6917;
        prefecture = '東京都';
        isFallbackCoordinate = true;
      }

      res.json({
        success: true,
        finalUrl,
        title: title || 'Googleマップ共有スポット',
        lat,
        lng,
        address,
        prefecture,
        isFallbackCoordinate,
      });
    } catch (err) {
      console.error('Failed to resolve Google Maps URL:', err);
      // 万が一エラー時でも、基本座標を返してピン作成を阻害しない
      res.json({
        success: true,
        finalUrl: req.query.url as string,
        title: '登録スポット',
        lat: 35.6895,
        lng: 139.6917,
        prefecture: '東京都',
        isFallbackCoordinate: true,
        error: String(err),
      });
    }
  });

  // API 2: ジオコーディングAPI (Google Maps API ＆ 国土地理院 ＆ Nominatim プロキシ)
  app.get('/api/geocode', async (req, res) => {
    try {
      const q = (req.query.q as string || '').trim();
      if (!q) {
        res.status(400).json({ error: 'Query q is required' });
        return;
      }

      const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GEMINI_API_KEY;

      // 1. Google Maps Geocoding API (APIキーがある場合に最優先で高精度検索)
      if (googleMapsApiKey) {
        try {
          const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${googleMapsApiKey}&language=ja&region=jp`;
          const gRes = await fetch(gUrl);
          if (gRes.ok) {
            const gData = await gRes.json();
            if (gData.status === 'OK' && Array.isArray(gData.results) && gData.results.length > 0) {
              const firstResult = gData.results[0];
              const { lat, lng } = firstResult.geometry.location;
              const formattedAddress = firstResult.formatted_address || q;
              res.json({
                success: true,
                lat,
                lng,
                address: formattedAddress,
                displayName: formattedAddress,
                source: 'google',
              });
              return;
            }
          }
        } catch (e) {
          console.warn('Google Maps geocoding failed, trying fallback:', e);
        }
      }

      // 2. 国土地理院 住所検索API (日本国内の住所に最適)
      try {
        const gsiRes = await fetch(`https://msearch.gsi.go.jp/address-search/queryString?q=${encodeURIComponent(q)}`, {
          headers: { 'Accept': 'application/json' },
        });
        if (gsiRes.ok) {
          const gsiData = await gsiRes.json();
          if (Array.isArray(gsiData) && gsiData.length > 0 && gsiData[0].geometry?.coordinates) {
            const [lon, lat] = gsiData[0].geometry.coordinates;
            const title = gsiData[0].properties?.title || q;
            res.json({
              success: true,
              lat,
              lng: lon,
              address: title,
              displayName: title,
              source: 'gsi',
            });
            return;
          }
        }
      } catch (e) {
        console.warn('GSI geocoding failed, trying fallback:', e);
      }

      // 2. OpenStreetMap Nominatim フォールバック
      try {
        const nomRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=jp&limit=1&accept-language=ja`,
          {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'JapanMapNav/1.0',
            },
          }
        );
        if (nomRes.ok) {
          const nomData = await nomRes.json();
          if (Array.isArray(nomData) && nomData.length > 0) {
            res.json({
              success: true,
              lat: parseFloat(nomData[0].lat),
              lng: parseFloat(nomData[0].lon),
              address: nomData[0].display_name,
              displayName: nomData[0].display_name,
              source: 'nominatim',
            });
            return;
          }
        }
      } catch (e) {
        console.warn('Nominatim geocoding failed:', e);
      }

      res.status(404).json({ error: 'Location not found' });
    } catch (err) {
      console.error('Geocode error:', err);
      res.status(500).json({ error: 'Geocode error', details: String(err) });
    }
  });

  // API 3: スポット名読み仮名（ふりがな）自動生成 API (Gemini AI)
  app.post('/api/generate-reading', async (req, res) => {
    try {
      const text = (req.body?.text as string || '').trim();
      if (!text) {
        res.status(400).json({ success: false, error: 'スポット名（text）が指定されていません', reading: '' });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn('GEMINI_API_KEY is not configured on server');
        res.status(503).json({ success: false, error: 'GEMINI_API_KEYが設定されていません', reading: '' });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      let rawReading = '';
      const modelsToTry = ['gemini-3.8-flash', 'gemini-3.6-flash'];
      let lastError: any = null;

      for (const model of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: `日本の場所名・観光地・地名・施設名・心霊スポット「${text}」の正確な読み仮名（ひらがな）のみを出力してください。
例:
- 犬鳴峠 -> いぬなきとうげ
- 吹上トンネル -> ふきあげとんねる
- 八木山橋 -> やぎやまばし
- 慰霊の森 -> いれいのもり
- 富士山 -> ふじさん
- 清水寺 -> きよみずでら
- 雄蛇ヶ池 -> おじゃがいけ
- 旧善波トンネル -> きゅうぜんばとんねる

【厳格なルール】
1. ひらがな（および長音記号「ー」）のみを出力してください。
2. 漢字・カタカナ・アルファベット・スペース・説明文・引用符・記号は一切含めず、ひらがな文字列のみを返してください。`,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
          });
          if (response.text) {
            rawReading = response.text.trim();
            break;
          }
        } catch (err) {
          lastError = err;
          console.warn(`Model ${model} failed, trying fallback:`, err);
        }
      }

      if (!rawReading && lastError) {
        throw lastError;
      }
      // ひらがな・長音符を抽出して正規化
      let cleaned = rawReading
        .replace(/[\r\n\t]/g, '')
        .replace(/[^\u3041-\u3096ー]/g, '')
        .trim();

      // カタカナで返された場合はひらがなに変換
      if (!cleaned && rawReading) {
        cleaned = rawReading
          .replace(/[\u30a1-\u30f6]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0x60))
          .replace(/[^\u3041-\u3096ー]/g, '')
          .trim();
      }

      res.json({
        success: true,
        reading: cleaned,
      });
    } catch (err) {
      console.error('Failed to generate reading via Gemini:', err);
      res.status(500).json({
        success: false,
        error: '読み仮名の生成に失敗しました',
        details: String(err),
        reading: '',
      });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Static asset serving helper with strict MIME types for Safari & older browsers
  const distPath = path.join(process.cwd(), 'dist');
  const staticMiddleware = express.static(distPath, {
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
      } else if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      } else if (filePath.endsWith('.webmanifest')) {
        res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      }
    },
  });

  // Never return index.html for missing /assets/* files (prevents Safari MIME type errors)
  app.use('/assets', (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const assetPath = path.join(distPath, 'assets', req.path);
    if (!fs.existsSync(assetPath)) {
      res.status(404).type('text/plain').end('Asset not found');
      return;
    }
    next();
  });

  // Vite middleware for development vs Static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use(staticMiddleware);
  } else {
    app.use(staticMiddleware);
    app.get('*', (req, res) => {
      // If a missing asset was requested, send 404 instead of index.html
      if (req.path.startsWith('/assets/')) {
        res.status(404).end('Asset not found');
        return;
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
