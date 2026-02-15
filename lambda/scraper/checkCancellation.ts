import { Handler } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';
import { autoReserveLesson } from './autoReserve';

/**
 * キャンセル待ちチェック Lambda関数
 *
 * - ウォッチ対象レッスンの最新空き状況を FEELCYCLE API から直接取得
 * - DB を更新し、空きが見つかった場合に LINE 通知
 * - 自動予約が設定されている場合はログのみ（Phase 5で実装）
 */

const FEELCYCLE_API = 'https://m.feelcycle.com/api/reserve/lesson_calendar';
const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15';

interface WaitlistRow {
  id: string;
  user_id: string;
  lesson_id: string;
  auto_reserve: boolean;
  lessons: {
    id: string;
    date: string;
    time: string;
    end_time: string;
    program_name: string;
    instructor: string;
    studio: string;
    store_id: string;
    sid_hash: string;
    available_slots: number;
    is_full: boolean;
  };
  user_profiles: {
    line_user_id: string | null;
  } | null;
}

interface FreshLesson {
  date: string;       // YYYY-MM-DD
  time: string;       // HH:MM
  instructor: string;
  studio: string;
  available_slots: number;
  is_full: boolean;
}

interface ApiSchedule {
  lesson_name: string;
  lesson_start: string;
  lesson_end: string;
  user_name_list: Array<{ id: number; name: string }>;
  store_id: string;
  store_name: string;
  reserve_status_count: number;
}

interface ApiLessonDay {
  lesson_date: string; // YYYYMMDD
  schedule: ApiSchedule[];
}

interface ApiResponse {
  result_code: number;
  lesson_list?: ApiLessonDay[];
}

/**
 * FEELCYCLE API から1スタジオ・1日分のレッスン空き状況を取得
 */
async function fetchFreshLessons(storeId: number, date: string): Promise<FreshLesson[]> {
  const params = new URLSearchParams({
    mode: '2',
    shujiku_type: '1',
    get_direction: '1',
    get_starting_date: date,
    shujiku_id: String(storeId),
  });

  try {
    const res = await fetch(`${FEELCYCLE_API}?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
    });

    const json: ApiResponse = await res.json();
    if (json.result_code !== 0 || !json.lesson_list) {
      return [];
    }

    const lessons: FreshLesson[] = [];
    for (const day of json.lesson_list) {
      const d = `${day.lesson_date.substring(0, 4)}-${day.lesson_date.substring(4, 6)}-${day.lesson_date.substring(6, 8)}`;

      for (const s of day.schedule) {
        lessons.push({
          date: d,
          time: s.lesson_start,
          instructor: s.user_name_list?.map((u) => u.name).join(', ') || '',
          studio: s.store_name.replace(/（.*）/, ''),
          available_slots: s.reserve_status_count,
          is_full: s.reserve_status_count === 0,
        });
      }
    }

    return lessons;
  } catch (error) {
    console.error(`Failed to fetch fresh lessons for store ${storeId}, date ${date}:`, error);
    return [];
  }
}

export const handler: Handler = async (event, context) => {
  console.log('Cancellation check started', { event, context });

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 1. 未通知のウェイトリストエントリを取得（レッスン情報付き）
    const { data: waitlist, error: waitlistError } = await supabase
      .from('waitlist')
      .select('*, lessons(*)')
      .eq('notified', false);

    if (waitlistError) {
      throw waitlistError;
    }

    if (!waitlist || waitlist.length === 0) {
      console.log('No waitlist entries to check');
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Cancellation check completed',
          checked: 0,
          notified: 0,
          cleaned: 0,
        }),
      };
    }

    // user_profiles から line_user_id を別クエリで取得
    const userIds = [...new Set(waitlist.map((w: { user_id: string }) => w.user_id))];
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, line_user_id')
      .in('id', userIds);

    const lineUserIdMap = new Map<string, string | null>();
    for (const p of profiles || []) {
      lineUserIdMap.set(p.id, p.line_user_id);
    }

    // entries に user_profiles 情報をマージ
    const entries: WaitlistRow[] = waitlist.map((w: Record<string, unknown>) => ({
      ...w,
      user_profiles: lineUserIdMap.has(w.user_id as string)
        ? { line_user_id: lineUserIdMap.get(w.user_id as string) ?? null }
        : null,
    })) as WaitlistRow[];

    console.log(`Found ${entries.length} waitlist entries to check`);

    // 2. storeId+date のユニークペアを抽出
    const targets = new Map<string, { storeId: number; date: string }>();
    for (const entry of entries) {
      const key = `${entry.lessons.store_id}_${entry.lessons.date}`;
      targets.set(key, {
        storeId: parseInt(entry.lessons.store_id, 10),
        date: entry.lessons.date,
      });
    }

    console.log(`Fetching fresh data for ${targets.size} store/date pairs`);

    // 3. FEELCYCLE API からフレッシュデータ取得（並列）
    const freshResults = await Promise.all(
      Array.from(targets.values()).map(({ storeId, date }) =>
        fetchFreshLessons(storeId, date)
      )
    );
    const allFresh = freshResults.flat();
    console.log(`Fetched ${allFresh.length} fresh lessons from FEELCYCLE API`);

    // 4. DB の lessons テーブルを部分更新
    let dbUpdated = 0;
    for (const fresh of allFresh) {
      const { error } = await supabase
        .from('lessons')
        .update({
          available_slots: fresh.available_slots,
          is_full: fresh.is_full,
        })
        .match({
          date: fresh.date,
          time: fresh.time,
          studio: fresh.studio,
          instructor: fresh.instructor,
        });

      if (!error) {
        dbUpdated++;
      }
    }
    console.log(`Updated ${dbUpdated}/${allFresh.length} lessons in DB`);

    // 5. フレッシュデータで空き判定（インメモリ）
    const freshMap = new Map<string, FreshLesson>();
    for (const f of allFresh) {
      freshMap.set(`${f.date}_${f.time}_${f.instructor}`, f);
    }

    let notifiedCount = 0;
    let autoReservedCount = 0;

    for (const entry of entries) {
      const key = `${entry.lessons.date}_${entry.lessons.time}_${entry.lessons.instructor}`;
      const fresh = freshMap.get(key);

      // フレッシュデータがあればそれを使用、なければ DB の値にフォールバック
      const availableSlots = fresh ? fresh.available_slots : entry.lessons.available_slots;
      const hasAvailability = availableSlots > 0;

      if (hasAvailability) {
        const lineUserId = entry.user_profiles?.line_user_id ?? null;

        // 自動予約モード: autoReserveLesson に委譲（独自にLINE通知する）
        if (entry.auto_reserve) {
          const result = await autoReserveLesson(entry, supabase, lineUserId);
          console.log(`AutoReserve entry ${entry.id}: result=${result}`);

          if (result === 'success' || result === 'needs_confirm' || result === 'error' || result === 'auth_failed') {
            // 成功 or 非回復エラー → waitlist 完了
            await supabase
              .from('waitlist')
              .update({ notified: true })
              .eq('id', entry.id);
          }
          // conflict → そのまま（次サイクルで再試行）

          if (result === 'success') autoReservedCount++;
          continue;
        }

        // 通常モード: LINE通知のみ
        const lessonForNotification = {
          ...entry.lessons,
          available_slots: availableSlots,
          is_full: availableSlots === 0,
        };

        if (lineUserId) {
          const sent = await sendLineNotification(lineUserId, lessonForNotification);

          if (sent) {
            await supabase
              .from('waitlist')
              .update({ notified: true })
              .eq('id', entry.id);

            notifiedCount++;
            console.log(`Notified entry ${entry.id} for lesson ${entry.lesson_id} (slots: ${availableSlots})`);
          } else {
            console.warn(`Failed to notify entry ${entry.id}, will retry next run`);
          }
        } else {
          console.warn(`No LINE user ID for waitlist entry ${entry.id} (user: ${entry.user_id})`);
          await supabase
            .from('waitlist')
            .update({ notified: true })
            .eq('id', entry.id);
        }
      }
    }

    // 6. 過去レッスンのウェイトリストエントリを自動削除
    const today = new Date().toISOString().slice(0, 10);
    const { data: expiredIds, error: expiredError } = await supabase
      .from('waitlist')
      .select('id, lessons!inner(date)')
      .lt('lessons.date', today);

    let cleanedCount = 0;
    if (!expiredError && expiredIds && expiredIds.length > 0) {
      const ids = expiredIds.map((r: { id: string }) => r.id);
      const { error: deleteError } = await supabase
        .from('waitlist')
        .delete()
        .in('id', ids);

      if (deleteError) {
        console.error('Failed to clean up expired waitlist entries:', deleteError);
      } else {
        cleanedCount = ids.length;
        console.log(`Cleaned up ${cleanedCount} expired waitlist entries`);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Cancellation check completed',
        checked: entries.length,
        notified: notifiedCount,
        autoReserved: autoReservedCount,
        cleaned: cleanedCount,
        freshFetched: allFresh.length,
        dbUpdated,
      }),
    };
  } catch (error) {
    console.error('Error in cancellation check:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Cancellation check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

/**
 * LINE Messaging API でプッシュ通知を送信
 */
async function sendLineNotification(
  lineUserId: string,
  lesson: WaitlistRow['lessons']
): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN is not set');
    return false;
  }

  // HH:MM:SS → HH:MM
  const startTime = lesson.time.slice(0, 5);
  const endTime = lesson.end_time.slice(0, 5);
  // YYYY-MM-DD → M/D(曜日)
  const d = new Date(lesson.date);
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const dateStr = `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;

  const message = `【キャンセル待ち通知】\n${lesson.program_name}\n${dateStr} ${startTime}〜${endTime}\n${lesson.instructor}\n${lesson.studio}\n\nhttps://m.feelcycle.com/reserve`;

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: 'text', text: message }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`LINE API error: ${res.status} ${body}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('LINE notification error:', error);
    return false;
  }
}

