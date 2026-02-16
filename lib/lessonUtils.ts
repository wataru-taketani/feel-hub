import type { Lesson } from '@/types';

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'] as const;

/**
 * 日付文字列を「M/D(曜日)」形式にフォーマット
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = DAY_NAMES[date.getDay()];
  return `${month}/${day}(${dayOfWeek})`;
}

/**
 * 曜日インデックスを返す (0=日, 6=土)
 */
export function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getDay();
}

/**
 * レッスンのユニークキーを生成（ブックマーク用）
 */
export function getLessonKey(lesson: Pick<Lesson, 'date' | 'startTime' | 'studio' | 'instructor'>): string {
  return `${lesson.date}_${lesson.startTime}_${lesson.studio}_${lesson.instructor}`;
}

/**
 * プログラム名の部分一致検索
 */
export function matchesProgram(programName: string, search: string): boolean {
  if (!search) return true;
  return programName.toLowerCase().includes(search.toLowerCase());
}

const STUDIO_ABBR: Record<string, string> = {
  '渋谷': 'SBY',
  '新宿': 'SJK',
  '池袋': 'IKB',
  '銀座': 'GNZ',
  '銀座京橋': 'GKBS',
  '上野': 'UEN',
  '汐留': 'SDM',
  '五反田': 'GTD',
  '中目黒': 'NMG',
  '自由が丘': 'JYO',
  '吉祥寺': 'KCJ',
  '町田': 'MCD',
  '横浜': 'YKH',
  '川崎': 'KWS',
  '武蔵小杉': 'MKG',
  '上大岡': 'KOK',
  '横須賀中央': 'YSC',
  'あざみ野': 'AZN',
  'あざみ野Pilates': 'AZNP',
  '多摩センター': 'TMC',
  '柏': 'KSW',
  '船橋': 'FNB',
  '海浜幕張': 'KHM',
  '越谷': 'KSG',
  '名古屋': 'NGY',
  '栄': 'SKE',
  '岐阜': 'GIF',
  '大阪京橋': 'OKBS',
  '心斎橋': 'SSB',
  '梅田茶屋町': 'UMDC',
  '三ノ宮': 'SMY',
  '京都河原町': 'KTK',
  '札幌': 'SPR',
  '広島': 'HSM',
  '福岡天神': 'FTJ',
  '高松': 'TKM',
};

export interface StudioRegion {
  area: string;
  prefectures: { name: string; studios: string[] }[];
}

export const STUDIO_REGIONS: StudioRegion[] = [
  {
    area: '北海道・東北',
    prefectures: [
      { name: '北海道', studios: ['札幌'] },
    ],
  },
  {
    area: '関東',
    prefectures: [
      { name: '埼玉県', studios: ['越谷'] },
      { name: '千葉県', studios: ['船橋', '海浜幕張', '柏'] },
      { name: '東京都', studios: ['銀座京橋', '銀座', '五反田', '池袋', '自由が丘', '吉祥寺', '町田', '中目黒', '渋谷', '汐留', '新宿', '多摩センター', '上野'] },
      { name: '神奈川県', studios: ['あざみ野', 'あざみ野Pilates', '上大岡', '川崎', '武蔵小杉', '横浜', '横須賀中央'] },
    ],
  },
  {
    area: '東海・関西',
    prefectures: [
      { name: '岐阜県', studios: ['岐阜'] },
      { name: '愛知県', studios: ['名古屋', '栄'] },
      { name: '京都府', studios: ['京都河原町'] },
      { name: '大阪府', studios: ['大阪京橋', '心斎橋', '梅田茶屋町'] },
      { name: '兵庫県', studios: ['三ノ宮'] },
    ],
  },
  {
    area: '中国・四国・九州',
    prefectures: [
      { name: '広島県', studios: ['広島'] },
      { name: '香川県', studios: ['高松'] },
      { name: '福岡県', studios: ['福岡天神'] },
    ],
  },
];

/**
 * スタジオ名の略称を返す（例: "中目黒" → "NMG"）
 */
export function getStudioAbbr(studio: string): string {
  return STUDIO_ABBR[studio] || studio.substring(0, 3).toUpperCase();
}

/**
 * スタジオ名を略称付きでフォーマット（例: "中目黒（NMG）"）
 */
export function formatStudio(studio: string): string {
  const abbr = STUDIO_ABBR[studio];
  return abbr ? `${studio}（${abbr}）` : studio;
}

/**
 * FC API形式のホームストア名をDB形式に変換
 * 例: "銀座（GNZ）" → "銀座"
 */
export function parseHomeStoreToStudio(homeStore: string): string {
  return homeStore.replace(/（.*）$/, '');
}

/**
 * 今日の日付を YYYY-MM-DD で返す (JST)
 */
export function getTodayDateString(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split('T')[0];
}
