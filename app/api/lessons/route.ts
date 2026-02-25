import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// サーバーサイドAPI用: service role keyでRLSバイパス
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * レッスン取得API
 *
 * GET /api/lessons
 * GET /api/lessons?studios=渋谷,銀座
 */
export async function GET(request: NextRequest) {
  try {
    const studiosParam = request.nextUrl.searchParams.get('studios');
    const studioList = studiosParam ? studiosParam.split(',').filter(Boolean) : [];

    // 今日以降のレッスンのみ取得（過去日をDBレベルで除外）
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
    const allData: Record<string, unknown>[] = [];
    const PAGE_SIZE = 1000;
    let from = 0;

    while (true) {
      let query = supabase
        .from('lessons')
        .select('id, date, time, end_time, program_name, instructor, studio, is_full, available_slots, ticket_type, color_code, text_color, sid_hash, url')
        .gte('date', today)
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (studioList.length > 0) {
        query = query.in('studio', studioList);
      }

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

    // 現在時刻（UTC epoch） — 当日の時間帯フィルタ用（日付フィルタはDB側で実施済み）
    const nowMs = Date.now();

    // snake_case → camelCase 変換 + 当日の過去時間帯を除外
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
          sidHash: row.sid_hash || null,
        };
      })
      .filter((l) => !l.isPast);

    return NextResponse.json({
      success: true,
      data: lessons,
      count: lessons.length,
    }, {
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Error fetching lessons:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch lessons' },
      { status: 500 }
    );
  }
}
