import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * プログラム別の利用可能レッスン件数API
 *
 * GET /api/lessons/count?program=BSWi%20House%202
 * Returns: { count: 5 }
 */
export async function GET(request: NextRequest) {
  try {
    const program = request.nextUrl.searchParams.get('program');
    if (!program) {
      return NextResponse.json({ count: 0 });
    }

    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });

    const { count, error } = await supabase
      .from('lessons')
      .select('id', { count: 'exact', head: true })
      .eq('program_name', program)
      .gte('date', today);

    if (error) {
      console.error('Lesson count query error:', error);
      return NextResponse.json({ count: 0 });
    }

    return NextResponse.json(
      { count: count ?? 0 },
      {
        headers: {
          'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
