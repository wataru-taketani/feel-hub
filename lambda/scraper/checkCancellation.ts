import { Handler } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';
import { autoReserveLesson } from './autoReserve';

/**
 * キャンセル待ちチェック Lambda関数
 *
 * - DB上のレッスン空き状況（メインスクレイパーが10分間隔で更新）を参照
 * - 空きが見つかった場合に LINE 通知 or 自動予約
 *
 * NOTE: 未認証の lesson_calendar API は reserve_status_count=0 を返すことがあるため、
 *       この関数では FEELCYCLE API を直接呼ばず、DB値のみを使用する。
 */

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

    // 2. DB値で空き判定（メインスクレイパーが10分間隔で更新）
    let notifiedCount = 0;
    let autoReservedCount = 0;

    for (const entry of entries) {
      const availableSlots = entry.lessons.available_slots;
      const hasAvailability = availableSlots > 0;

      console.log(`[Check] entry=${entry.id} lesson=${entry.lessons.program_name} ${entry.lessons.date} ${entry.lessons.time.slice(0, 5)} slots=${availableSlots} auto=${entry.auto_reserve}`);

      if (hasAvailability) {
        const lineUserId = entry.user_profiles?.line_user_id ?? null;

        // 自動予約モード: autoReserveLesson に委譲（独自にLINE通知する）
        if (entry.auto_reserve) {
          const result = await autoReserveLesson(entry, supabase, lineUserId);
          console.log(`AutoReserve entry ${entry.id}: result=${result}`);

          if (result === 'success' || result === 'needs_confirm' || result === 'error') {
            // 成功 or 非回復エラー → waitlist 完了
            await supabase
              .from('waitlist')
              .update({ notified: true })
              .eq('id', entry.id);
          }
          // auth_failed, auth_invalid, conflict → そのまま（再連携後 or 次サイクルで再試行）

          if (result === 'success') autoReservedCount++;
          continue;
        }

        // 通常モード: LINE通知のみ
        if (lineUserId) {
          const sent = await sendLineNotification(lineUserId, entry.lessons);

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

    // 3. 過去レッスンのウェイトリストエントリを自動削除
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
