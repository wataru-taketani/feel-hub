import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('waitlist')
    .select('*, lessons(*)')
    .eq('user_id', user.id)
    .gte('lessons.date', today)
    .not('lessons', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const entries = (data || []).map((row: Record<string, unknown>) => {
    const lesson = row.lessons as Record<string, unknown>;
    return {
      id: row.id,
      lessonId: row.lesson_id,
      notified: row.notified,
      autoReserve: row.auto_reserve ?? false,
      createdAt: row.created_at,
      lesson: lesson ? {
        id: lesson.id,
        date: lesson.date,
        startTime: lesson.time,
        endTime: lesson.end_time,
        programName: lesson.program_name,
        instructor: lesson.instructor,
        studio: lesson.studio,
        isFull: lesson.is_full,
        availableSlots: lesson.available_slots,
        colorCode: lesson.color_code,
        textColor: lesson.text_color,
        sidHash: lesson.sid_hash,
      } : null,
    };
  });

  return NextResponse.json({ entries });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  const { lessonId, autoReserve } = await request.json();

  if (!lessonId) {
    return NextResponse.json({ error: 'lessonId is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('waitlist')
    .upsert(
      { user_id: user.id, lesson_id: lessonId, notified: false, auto_reserve: !!autoReserve },
      { onConflict: 'user_id,lesson_id' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entry: { id: data.id, lessonId: data.lesson_id, autoReserve: data.auto_reserve } });
}
