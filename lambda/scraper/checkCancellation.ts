import { Handler } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';

/**
 * キャンセル待ちチェック Lambda関数
 *
 * - キャンセル待ちリストに登録されたレッスンの空き枠をチェック
 * - 空きが見つかった場合にLINE通知
 * - 自動予約が設定されている場合はログのみ（Phase 5で実装）
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
    // 1. 未通知のウェイトリストエントリを取得（レッスン情報 + LINE ID 付き）
    const { data: waitlist, error: waitlistError } = await supabase
      .from('waitlist')
      .select('*, lessons(*), user_profiles(line_user_id)')
      .eq('notified', false);

    if (waitlistError) {
      throw waitlistError;
    }

    const entries = (waitlist || []) as unknown as WaitlistRow[];
    console.log(`Found ${entries.length} waitlist entries to check`);

    let notifiedCount = 0;

    // 2. 各エントリの空き状況をチェック
    for (const entry of entries) {
      const hasAvailability = checkLessonAvailability(entry.lessons);

      if (hasAvailability) {
        const lineUserId = entry.user_profiles?.line_user_id;

        // 3. LINE通知送信
        if (lineUserId) {
          const sent = await sendLineNotification(lineUserId, entry.lessons);

          if (sent) {
            // 通知成功時のみ notified を更新
            await supabase
              .from('waitlist')
              .update({ notified: true })
              .eq('id', entry.id);

            notifiedCount++;
            console.log(`Notified entry ${entry.id} for lesson ${entry.lesson_id}`);
          } else {
            console.warn(`Failed to notify entry ${entry.id}, will retry next run`);
          }
        } else {
          console.warn(`No LINE user ID for waitlist entry ${entry.id} (user: ${entry.user_id})`);
          // LINE未連携でも notified にして無限ループを防ぐ
          await supabase
            .from('waitlist')
            .update({ notified: true })
            .eq('id', entry.id);
        }

        // 4. 自動予約（Phase 5先送り）
        if (entry.auto_reserve) {
          autoReserveLesson(entry);
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Cancellation check completed',
        checked: entries.length,
        notified: notifiedCount,
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
 * レッスンの空き状況をチェック
 * スクレイパーが10分毎に更新した available_slots を参照
 */
function checkLessonAvailability(lesson: WaitlistRow['lessons']): boolean {
  return lesson.available_slots > 0;
}

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

  const message = `【空き通知】\n${lesson.program_name}\n${lesson.date} ${lesson.time}–${lesson.end_time}\nIR: ${lesson.instructor}\nスタジオ: ${lesson.studio}\n残席: ${lesson.available_slots}`;

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

/**
 * 自動予約処理（Phase 5で実装）
 */
function autoReserveLesson(entry: WaitlistRow): void {
  console.log(`[Phase 5] Auto-reserve requested for entry ${entry.id}, lesson ${entry.lesson_id} - not implemented yet`);
}
