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
    .from('bookmarks')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', today)
    .order('added_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const bookmarks: Record<string, { key: string; date: string; startTime: string; programName: string; instructor: string; studio: string; addedAt: number }> = {};
  for (const row of data || []) {
    bookmarks[row.lesson_key] = {
      key: row.lesson_key,
      date: row.date,
      startTime: row.start_time,
      programName: row.program_name,
      instructor: row.instructor,
      studio: row.studio,
      addedAt: new Date(row.added_at).getTime(),
    };
  }

  return NextResponse.json({ bookmarks });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  const { key, date, startTime, programName, instructor, studio } = await request.json();

  if (!key) {
    return NextResponse.json({ error: 'key is required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('bookmarks')
    .upsert({
      user_id: user.id,
      lesson_key: key,
      date,
      start_time: startTime,
      program_name: programName,
      instructor,
      studio,
    }, { onConflict: 'user_id,lesson_key' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  const { key } = await request.json();

  if (!key) {
    return NextResponse.json({ error: 'key is required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('user_id', user.id)
    .eq('lesson_key', key);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
