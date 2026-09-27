// Yomigana (Furigana / Reading) utility
// Automatically converts Japanese place names, addresses, and spot titles to hiragana readings.

// Fullwidth Katakana to Hiragana conversion
export function katakanaToHiragana(str: string): string {
  return str.replace(/[\u30A1-\u30F6]/g, (match) =>
    String.fromCharCode(match.charCodeAt(0) - 0x60)
  );
}

// Clean title of English parentheticals and symbols
export function cleanTitleForYomigana(title: string): string {
  let cleaned = title.trim();
  // Remove parenthetical content if it's English e.g. (Old Komine Tunnel)
  cleaned = cleaned.replace(/\([A-Za-z0-9\s.,'_-]+\)/g, '');
  cleaned = cleaned.replace(/（[A-Za-z0-9\s.,'_-]+）/g, '');
  // Extract parenthesis content if Japanese e.g. "旧犬鳴トンネル (犬鳴峠)" -> "旧犬鳴トンネル"
  cleaned = cleaned.replace(/[（(][^）)]*[）)]/g, '');
  return cleaned.trim();
}

// Offline Japanese place phonetic dictionary for quick fallback
const COMMON_KANJI_READINGS: Record<string, string> = {
  旧: 'きゅう',
  新: 'しん',
  北: 'きた',
  南: 'みなみ',
  東: 'ひがし',
  西: 'にし',
  上: 'かみ',
  下: 'しも',
  中: 'なか',
  大: 'おお',
  小: 'こ',
  山: 'やま',
  川: 'かわ',
  谷: 'たに',
  峠: 'とうげ',
  橋: 'ばし',
  滝: 'たき',
  池: 'いけ',
  沼: 'ぬま',
  湖: 'こ',
  海: 'うみ',
  島: 'しま',
  岬: 'みさき',
  森: 'もり',
  林: 'はやし',
  原: 'はら',
  野: 'の',
  岩: 'いわ',
  石: 'いし',
  洞: 'どう',
  窟: 'くつ',
  穴: 'あな',
  トンネル: 'とんねる',
  隧道: 'ずいどう',
  神社: 'じんじゃ',
  寺: 'てら',
  院: 'いん',
  社: 'しゃ',
  宮: 'みや',
  大社: 'たいしゃ',
  城: 'じょう',
  跡: 'あと',
  遺構: 'いこう',
  廃墟: 'はいきょ',
  ホテル: 'ほてる',
  旅館: 'りょかん',
  病院: 'びょういん',
  医院: 'いいん',
  診療所: 'しんりょうじょ',
  学校: 'がっこう',
  分校: 'ぶんこう',
  小学校: 'しょうがっこう',
  中学校: 'ちゅうがっこう',
  高校: 'こうこう',
  大学: 'だいがく',
  寮: 'りょう',
  館: 'かん',
  屋敷: 'やしき',
  村: 'むら',
  町: 'まち',
  市: 'し',
  県: 'けん',
  府: 'ふ',
  道: 'どう',
  公園: 'こうえん',
  霊園: 'れいえん',
  墓地: 'ぼち',
  火葬場: 'かそうば',
  斎場: 'さいじょう',
  踏切: 'ふみきり',
  駅: 'えき',
  通り: 'どおり',
  坂: 'ざか',
  淵: 'ふち',
  堰: 'せき',
  ダム: 'だむ',
  展望台: 'てんぼうだい',
  温泉: 'おんせん',
  遊園地: 'ゆうえんち',
  テーマパーク: 'てーまぱーく',
};

// Known famous spot titles dictionary for immediate offline instant lookup
const FAMOUS_SPOTS_YOMIGANA: Record<string, string> = {
  旧犬鳴トンネル: 'きゅういぬなきとんねる',
  犬鳴トンネル: 'いぬなきとんねる',
  犬鳴峠: 'いぬなきとうげ',
  八木山橋: 'やぎやまばし',
  信州観光ホテル跡: 'しんしゅうかんこうほてるあと',
  信州観光ホテル: 'しんしゅうかんこうほてる',
  清滝トンネル: 'きよたきとんねる',
  旧小峰トンネル: 'きゅうこみねとんねる',
  小峰トンネル: 'こみねとんねる',
  滝尾神社: 'たきのおじんじゃ',
  雄蛇ヶ池: 'おじゃがいけ',
  青木ヶ原樹海: 'あおきがはらじゅかい',
  富士樹海: 'ふじじゅかい',
  慰霊の森: 'いれいのもり',
  雫石事故慰霊の森: 'しずくいしじこいれいのもり',
  常紋トンネル: 'じょうもんとんねる',
  白高大神: 'しらたかおおかみ',
  一里野温泉: 'いちりのおんせん',
  恐山: 'おそれざん',
  東尋坊: 'とうじんぼう',
  三段壁: 'さんだんぺき',
  首洗いの滝: 'くびあらいのたき',
  首斬り峠: 'くびきりとうげ',
  旧生越トンネル: 'きゅうおごせとんねる',
  旧天城トンネル: 'きゅうあまぎとんねる',
  天城トンネル: 'あまぎとんねる',
  佐倉城址公園: 'さくらじょうしこうえん',
  吹上トンネル: 'ふきあげとんねる',
  旧吹上トンネル: 'きゅうふきあげとんねる',
  畑トンネル: 'はたとんねる',
  深泥池: 'みどろがいけ',
  勝坂隧道: 'かっさかずいどう',
  千駄ヶ谷トンネル: 'せんだがやとんねる',
};

/**
 * Automatically fetch or infer yomigana (reading in hiragana) for a spot title and optional address
 */
export async function generateYomigana(title: string, address?: string): Promise<string> {
  if (!title || !title.trim()) return '';

  const clean = cleanTitleForYomigana(title);

  // 1. Direct match with famous spots dictionary
  for (const [key, reading] of Object.entries(FAMOUS_SPOTS_YOMIGANA)) {
    if (clean.includes(key)) {
      if (clean === key) return reading;
      // partial replace
      const remaining = clean.replace(key, '');
      const sub = katakanaToHiragana(remaining);
      return reading + sub;
    }
  }

  // 2. Try server API (uses Gemini AI / server morphizer)
  try {
    const endpoint = typeof window !== 'undefined' ? '/api/generate-reading' : 'http://localhost:3000/api/generate-reading';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: clean, context: address }),
    });
    if (res.ok) {
      const data = await res.json();
      const val = data.reading || data.yomigana;
      if (val && typeof val === 'string' && val.trim()) {
        return val.trim();
      }
    }
  } catch (err) {
    console.warn('API yomigana generation request failed, using local converter:', err);
  }

  // 3. Fallback: Local rule-based substitution + katakana conversion
  let converted = clean;
  for (const [kanji, kana] of Object.entries(COMMON_KANJI_READINGS)) {
    converted = converted.split(kanji).join(kana);
  }
  return katakanaToHiragana(converted);
}
