import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const studio = searchParams.get('studio');

  let query = supabase
    .from('seat_preferences')
    .select('studio, seat_numbers')
    .eq('user_id', user.id);

  if (studio) {
    query = query.eq('studio', studio);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const preferences: Record<string, string[]> = {};
  for (const row of data || []) {
    preferences[row.studio] = row.seat_numbers;
  }

  return NextResponse.json({ preferences });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  const { studio, seatNumbers } = await request.json();

  if (!studio) {
    return NextResponse.json({ error: 'studio is required' }, { status: 400 });
  }

  if (!Array.isArray(seatNumbers)) {
    return NextResponse.json({ error: 'seatNumbers must be an array' }, { status: 400 });
  }

  // 空配列なら行削除
  if (seatNumbers.length === 0) {
    const { error } = await supabase
      .from('seat_preferences')
      .delete()
      .eq('user_id', user.id)
      .eq('studio', studio);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  const { error } = await supabase
    .from('seat_preferences')
    .upsert({
      user_id: user.id,
      studio,
      seat_numbers: seatNumbers,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,studio' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
