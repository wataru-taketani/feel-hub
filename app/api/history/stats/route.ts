import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/lib/supabase/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const program = searchParams.get('program');
  const instructor = searchParams.get('instructor');
  const studio = searchParams.get('studio');
  const splitInstructor = searchParams.get('splitInstructor') === '1';

  let query = supabaseAdmin
    .from('attendance_history')
    .select('program_name, instructor_name, store_name')
    .eq('user_id', user.id)
    .eq('cancel_flg', 0);

  if (from) query = query.gte('shift_date', from);
  if (to) query = query.lte('shift_date', to);
  if (program) {
    const programs = program.split(',').filter(Boolean);
    if (programs.length === 1) {
      query = query.ilike('program_name', `%${programs[0]}%`);
    } else {
      query = query.in('program_name', programs);
    }
  }
  if (instructor) {
    const instructors = instructor.split(',').filter(Boolean);
    if (instructors.length === 1) {
      query = query.ilike('instructor_name', `%${instructors[0]}%`);
    } else {
      query = query.in('instructor_name', instructors);
    }
  }
  if (studio) query = query.ilike('store_name', `%${studio}%`);

  const { data, error } = await query;

  if (error) {
    console.error('[history/stats] query error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data || [];

  // JS側で集計
  const programCounts: Record<string, number> = {};
  const instructorCounts: Record<string, number> = {};
  const studioCounts: Record<string, number> = {};

  for (const r of rows) {
    programCounts[r.program_name] = (programCounts[r.program_name] || 0) + 1;
    studioCounts[r.store_name] = (studioCounts[r.store_name] || 0) + 1;

    if (splitInstructor && r.instructor_name.includes(', ')) {
      // Wイントラ: 個別にカウント（フィルタ時は一致する名前のみ）
      for (const name of r.instructor_name.split(', ')) {
        const trimmed = name.trim();
        if (trimmed) {
          if (instructor && !trimmed.toLowerCase().includes(instructor.toLowerCase())) {
            continue;
          }
          instructorCounts[trimmed] = (instructorCounts[trimmed] || 0) + 1;
        }
      }
    } else {
      instructorCounts[r.instructor_name] = (instructorCounts[r.instructor_name] || 0) + 1;
    }
  }

  const toRanking = (counts: Record<string, number>) =>
    Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    totalLessons: rows.length,
    programRanking: toRanking(programCounts),
    instructorRanking: toRanking(instructorCounts),
    studioRanking: toRanking(studioCounts),
  });
}
