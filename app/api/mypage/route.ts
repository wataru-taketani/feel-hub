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

  // user_profiles から FC 会員情報を取得
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('fc_member_name, fc_home_store, fc_plan_name, fc_monthly_fee, fc_long_plan, fc_rental_info, fc_synced_at')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.fc_synced_at) {
    // FC連携済みか確認
    const { data: creds } = await supabaseAdmin
      .from('feelcycle_credentials')
      .select('user_id')
      .eq('user_id', user.id)
      .single();

    if (!creds) {
      return NextResponse.json({ error: 'FEELCYCLE未連携', code: 'FC_NOT_LINKED' }, { status: 404 });
    }

    // FC連携済みだが未同期 → 空データ
    return NextResponse.json({
      mypage: {
        displayName: '',
        homeStore: '',
        membershipType: '',
        totalAttendance: 0,
        reservationCount: 0,
        ownedTicketCount: 0,
        monthlyClubFee: null,
        longPlan: null,
      },
      reservations: [],
      tickets: [],
      fcSyncedAt: null,
    });
  }

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
  }));

  // user_tickets からチケット情報を取得
  const { data: ticketRows } = await supabaseAdmin
    .from('user_tickets')
    .select('*')
    .eq('user_id', user.id);

  const tickets = (ticketRows || []).map(t => ({
    name: t.ticket_name,
    totalCount: t.total_lot || 0,
    details: t.details || [],
  }));

  return NextResponse.json({
    mypage: {
      displayName: profile.fc_member_name || '',
      homeStore: profile.fc_home_store || '',
      membershipType: profile.fc_plan_name || '',
      totalAttendance: 0,
      reservationCount: reservations.length,
      ownedTicketCount: tickets.reduce((sum, t) => sum + (t.totalCount || 0), 0),
      monthlyClubFee: profile.fc_monthly_fee,
      longPlan: profile.fc_long_plan,
    },
    reservations,
    tickets,
    fcSyncedAt: profile.fc_synced_at,
  });
}
