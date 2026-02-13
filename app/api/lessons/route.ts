import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// サーバーサイドAPI用: service role keyでRLSバイパス
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * 全未来レッスン一括取得API
 *
 * GET /api/lessons
 */
export async function GET() {
  try {
    // 全件取得（1000件ずつページネーション）
    const allData: Record<string, unknown>[] = [];
    const PAGE_SIZE = 1000;
    let from = 0;

    while (true) {
      const query = supabase
        .from('lessons')
        .select('*')
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      const { data, error } = await query;

      if (error) {
        console.error('Supabase query error:', error);
        return NextResponse.json(
          { success: false, error: 'データの取得に失敗しました' },
          { status: 500 }
        );
      }

      if (!data || data.length === 0) break;
      allData.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    // 現在時刻（UTC epoch）
    const nowMs = Date.now();

    // snake_case → camelCase 変換 + isPast算出 → 過去除外
    const lessons = allData
      .map((row) => {
        const time = row.time as string;
        const endTimeRaw = row.end_time as string;
        const startTime = time?.substring(0, 5) || '';
        const endTime = endTimeRaw?.substring(0, 5) || '';

        const lessonStart = new Date(`${row.date}T${startTime}:00+09:00`);
        const isPast = lessonStart.getTime() < nowMs;

        return {
          id: row.id,
          date: row.date,
          startTime,
          endTime,
          programName: row.program_name,
          instructor: row.instructor,
          studio: row.studio,
          isFull: row.is_full,
          isPast,
          availableSlots: row.available_slots ?? 0,
          ticketType: row.ticket_type ?? null,
          colorCode: row.color_code ?? '',
          textColor: row.text_color ?? '#FFFFFF',
        };
      })
      .filter((l) => !l.isPast);

    return NextResponse.json({
      success: true,
      data: lessons,
      count: lessons.length,
    });
  } catch (error) {
    console.error('Error fetching lessons:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch lessons' },
      { status: 500 }
    );
  }
}
