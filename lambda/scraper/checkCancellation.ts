import { Handler } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

/**
 * キャンセル待ちチェック Lambda関数
 *
 * Phase 3で実装予定:
 * - キャンセル待ちリストに登録されたレッスンの空き枠をチェック
 * - 空きが見つかった場合にLINE通知
 * - 自動予約が設定されている場合は予約処理を実行
 */

export const handler: Handler = async (event, context) => {
  console.log('Cancellation check started', { event, context });

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 1. キャンセル待ちリストを取得
    const { data: waitlist, error: waitlistError } = await supabase
      .from('waitlist')
      .select('*, lessons(*)')
      .eq('notified', false);

    if (waitlistError) {
      throw waitlistError;
    }

    console.log(`Found ${waitlist?.length || 0} waitlist entries to check`);

    // 2. 各レッスンの空き状況をチェック
    for (const entry of waitlist || []) {
      const hasAvailability = await checkLessonAvailability(entry.lessons.url);

      if (hasAvailability) {
        // 3. LINE通知送信
        await sendLineNotification(entry);

        // 4. 自動予約が有効な場合は予約処理
        if (entry.autoReserve) {
          await autoReserveLesson(entry);
        }

        // 5. 通知済みフラグを更新
        await supabase
          .from('waitlist')
          .update({ notified: true })
          .eq('id', entry.id);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Cancellation check completed',
        checked: waitlist?.length || 0,
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
 * Phase 3で実装予定
 */
async function checkLessonAvailability(lessonUrl: string): Promise<boolean> {
  // TODO: Phase 3で実装
  console.log(`Checking availability for: ${lessonUrl}`);
  return false;
}

/**
 * LINE通知送信
 * Phase 3で実装予定
 */
async function sendLineNotification(waitlistEntry: any): Promise<void> {
  // TODO: Phase 3で実装
  console.log('Sending LINE notification:', waitlistEntry);
}

/**
 * 自動予約処理
 * Phase 3で実装予定
 */
async function autoReserveLesson(waitlistEntry: any): Promise<void> {
  // TODO: Phase 3で実装
  console.log('Auto-reserving lesson:', waitlistEntry);
}
