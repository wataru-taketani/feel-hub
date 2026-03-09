import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/lib/supabase/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  // user_profiles から homeStore と fc_synced_at を取得
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('fc_home_store, fc_synced_at')
    .eq('user_id', user.id)
    .single();

  // user_reservations から予約一覧を取得
  const { data: reservationRows } = await supabaseAdmin
    .from('user_reservations')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  const reservations = (reservationRows || []).map(r => ({
    date: r.date,
    startTime: r.start_time,
    endTime: r.end_time,
    programName: r.program_name,
    instructor: r.instructor,
    studio: r.studio,
    sheetNo: r.sheet_no || '',
    ticketName: r.ticket_name || '',
    bgColor: r.bg_color || '',
    textColor: r.text_color || '',
    playlistUrl: r.playlist_url || '',
    cancelWaitTotal: r.cancel_wait_total || 0,
    cancelWaitPosition: r.cancel_wait_position || 0,
    paymentMethod: r.payment_method || 0,
    lessonId: r.lesson_id,
    sidHash: r.sid_hash,
  }));

  return NextResponse.json({
    reservations,
    homeStore: profile?.fc_home_store || '',
    fcSyncedAt: profile?.fc_synced_at || null,
  });
}
