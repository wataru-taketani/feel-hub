import { Handler } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';

/**
 * FEELCYCLEレッスン情報取得 Lambda関数
 *
 * FEELCYCLE内部APIから直接JSONデータを取得（Puppeteer不要）
 */

const API_BASE = 'https://m.feelcycle.com/api/reserve/lesson_calendar';
const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15';
const MAX_SHUJIKU_ID = 50;
const BATCH_SIZE = 10;

type TicketType = 'WHITE' | 'SILVER' | 'GOLD' | 'PLATINUM' | null;

interface LessonData {
  date: string;
  startTime: string;
  endTime: string;
  programName: string;
  instructor: string;
  studio: string;
  isFull: boolean;
  availableSlots: number;
  ticketType: TicketType;
  colorCode: string;
  storeId: string;
  sidHash: string;
  lessonPeriod: number;
  lessonStatus: number;
  messFlg: number;
  reserveStatus: number;
  textColor: string;
}

interface ApiSchedule {
  lesson_name: string;
  lesson_start: string;
  lesson_end: string;
  user_name_list: Array<{ id: number; name: string }>;
  store_id: string;
  store_name: string;
  status: number;
  reserve_status: number;
  reserve_status_count: number;
  custom_icon_list: string[];
  ibgcol: string;
  itxtcol: string;
  sid_hash: string;
  lesson_period: number;
  mess_flg: number;
}

interface ApiLessonDay {
  lesson_date: string;
  schedule: ApiSchedule[];
}

interface ApiResponse {
  result_code: number;
  lesson_list?: ApiLessonDay[];
}

/**
 * custom_icon_listからチケット種類を判定
 */
function parseTicketType(iconList: string[]): TicketType {
  if (!iconList || iconList.length === 0) return null;
  for (const url of iconList) {
    const match = url.match(/icon_Add(\w+)\.png/i);
    if (match) {
      const type = match[1].toUpperCase() as TicketType;
      if (['WHITE', 'SILVER', 'GOLD', 'PLATINUM'].includes(type!)) return type;
    }
  }
  return null;
}

export const handler: Handler = async (event, context) => {
  console.log('Lambda function started', { event, context });

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let lessons: LessonData[] = [];

  try {
    lessons = await fetchAllLessons();

    // Supabaseにデータ保存
    try {
      const rows = lessons.map((l) => ({
        date: l.date,
        time: l.startTime,
        end_time: l.endTime,
        program_name: l.programName,
        instructor: l.instructor,
        studio: l.studio,
        is_full: l.isFull,
        available_slots: l.availableSlots,
        ticket_type: l.ticketType,
        color_code: l.colorCode,
        store_id: l.storeId,
        sid_hash: l.sidHash,
        lesson_period: l.lessonPeriod,
        lesson_status: l.lessonStatus,
        mess_flg: l.messFlg,
        reserve_status: l.reserveStatus,
        text_color: l.textColor,
        total_slots: 20,
        url: 'https://m.feelcycle.com/reserve',
      }));

      // 1000件ずつバッチupsert
      let saved = 0;
      for (let i = 0; i < rows.length; i += 1000) {
        const batch = rows.slice(i, i + 1000);
        const { error } = await supabase
          .from('lessons')
          .upsert(batch, { onConflict: 'date,time,studio,instructor' });

        if (error) {
          console.error(`Batch ${i}-${i + batch.length} error:`, error);
        } else {
          saved += batch.length;
        }
      }

      console.log(`Saved ${saved}/${lessons.length} lessons to Supabase`);
    } catch (dbError) {
      console.error('Database error (continuing):', dbError);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Fetch completed successfully',
        count: lessons.length,
      }),
    };
  } catch (error) {
    console.error('Error:', error);

    return {
      statusCode: lessons.length > 0 ? 200 : 500,
      body: JSON.stringify({
        message: lessons.length > 0 ? 'Fetch succeeded but save failed' : 'Fetch failed',
        count: lessons.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

/**
 * JSTの今日の日付をYYYY-MM-DD形式で取得
 */
function getTodayJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split('T')[0];
}

/**
 * FEELCYCLE APIから全スタジオのレッスンを取得
 * shujiku_id 1-50 を並列リクエストでスキャンしてスタジオを検出
 */
async function fetchAllLessons(): Promise<LessonData[]> {
  const startDate = getTodayJST();
  console.log(`Fetching lessons starting from ${startDate}`);

  const allLessons: LessonData[] = [];
  const ids = Array.from({ length: MAX_SHUJIKU_ID }, (_, i) => i + 1);

  // BATCH_SIZE件ずつ並列リクエスト
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((id) => fetchStudioLessons(id, startDate))
    );

    for (const { studioName, lessons } of results) {
      if (lessons.length > 0) {
        console.log(`  ${studioName}: ${lessons.length} lessons`);
        allLessons.push(...lessons);
      }
    }
  }

  console.log(`Total: ${allLessons.length} lessons`);
  return allLessons;
}

/**
 * 1スタジオのレッスンデータをAPIから取得
 */
async function fetchStudioLessons(
  shujikuId: number,
  startDate: string
): Promise<{ studioName: string; lessons: LessonData[] }> {
  const params = new URLSearchParams({
    mode: '2',
    shujiku_type: '1',
    get_direction: '1',
    get_starting_date: startDate,
    shujiku_id: String(shujikuId),
  });

  try {
    const res = await fetch(`${API_BASE}?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
    });

    const json: ApiResponse = await res.json();
    if (json.result_code !== 0 || !json.lesson_list) {
      return { studioName: '', lessons: [] };
    }

    const lessons: LessonData[] = [];
    let studioName = '';

    for (const day of json.lesson_list) {
      const date = `${day.lesson_date.substring(0, 4)}-${day.lesson_date.substring(4, 6)}-${day.lesson_date.substring(6, 8)}`;

      for (const s of day.schedule) {
        if (!studioName) {
          studioName = s.store_name.replace(/（.*）/, '');
        }

        lessons.push({
          date,
          startTime: s.lesson_start,
          endTime: s.lesson_end,
          programName: s.lesson_name,
          instructor: s.user_name_list?.map((u) => u.name).join(', ') || '',
          studio: studioName,
          isFull: s.reserve_status_count === 0,
          availableSlots: s.reserve_status_count,
          ticketType: parseTicketType(s.custom_icon_list),
          colorCode: s.ibgcol || '',
          storeId: s.store_id,
          sidHash: s.sid_hash,
          lessonPeriod: s.lesson_period,
          lessonStatus: s.status,
          messFlg: s.mess_flg,
          reserveStatus: s.reserve_status,
          textColor: s.itxtcol || '',
        });
      }
    }

    return { studioName, lessons };
  } catch {
    return { studioName: '', lessons: [] };
  }
}
