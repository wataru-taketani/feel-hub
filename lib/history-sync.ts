import type { SupabaseClient } from '@supabase/supabase-js';
import type { HistoryRecord } from '@/lib/feelcycle-api';

/**
 * 受講履歴をattendance_historyテーブルにUPSERT
 *
 * app/api/history/sync/route.ts と app/api/auth/login/route.ts の両方で使用
 */
export async function upsertHistory(
  supabaseAdmin: SupabaseClient,
  userId: string,
  records: HistoryRecord[],
  fetchedMonth: string
): Promise<{ synced: number; error?: string }> {
  if (records.length === 0) {
    return { synced: 0 };
  }

  const rows = records.map((r) => ({
    user_id: userId,
    shift_date: r.shiftDate,
    start_time: r.startTime,
    end_time: r.endTime,
    store_name: r.storeName,
    instructor_name: r.instructorName,
    program_name: r.programName,
    sheet_no: r.sheetNo || null,
    ticket_name: r.ticketName || null,
    playlist_url: r.playlistUrl || null,
    cancel_flg: r.cancelFlg,
    fetched_month: fetchedMonth,
  }));

  const { error: upsertError } = await supabaseAdmin
    .from('attendance_history')
    .upsert(rows, {
      onConflict: 'user_id,shift_date,start_time,store_name,instructor_name',
    });

  if (upsertError) {
    return { synced: 0, error: upsertError.message };
  }

  return { synced: records.length };
}
