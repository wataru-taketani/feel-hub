import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// サーバーサイドAPI用: service role keyでRLSバイパス
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * レッスン一覧取得API
 *
 * GET /api/lessons?studio=渋谷&date=2026-02-07
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const studios = searchParams.getAll('studio');
    const date = searchParams.get('date');
    const includePast = searchParams.get('includePast') === 'true';

    // フィルタ付きで全件取得（1000件ずつページネーション）
    const allData: Record<string, unknown>[] = [];
    const PAGE_SIZE = 1000;
    let from = 0;

    while (true) {
      let query = supabase
        .from('lessons')
        .select('*')
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (studios.length === 1) query = query.eq('studio', studios[0]);
      else if (studios.length > 1) query = query.in('studio', studios);
      if (date) query = query.eq('date', date);

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

    // 現在時刻（UTC epoch）— lessonEndも+09:00付きでUTC epochになるので直接比較可能
    const nowMs = Date.now();

    // snake_case → camelCase 変換 + isPast算出
    const allLessons = allData.map((row) => {
      const time = row.time as string;
      const endTimeRaw = row.end_time as string;
      const startTime = time?.substring(0, 5) || '';
      const endTime = endTimeRaw?.substring(0, 5) || '';

      // レッスン開始時刻（JST→UTC epoch）と現在時刻を比較
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
    });

    const totalCount = allLessons.length;
    const lessons = includePast ? allLessons : allLessons.filter((l) => !l.isPast);

    return NextResponse.json({
      success: true,
      data: lessons,
      count: lessons.length,
      totalCount,
    });
  } catch (error) {
    console.error('Error fetching lessons:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch lessons' },
      { status: 500 }
    );
  }
}

