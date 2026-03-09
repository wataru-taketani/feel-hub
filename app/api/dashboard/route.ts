import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/lib/supabase/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function parsePlanLimit(membershipType: string): number | null {
  const match = membershipType.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

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
    .eq('user_id', user.id)
    .single();

  // FC未同期の場合は FC_NOT_LINKED ではなく空データを返す
  // （フロント側で fc_synced_at=null を見て同期を開始する）
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

    // FC連携済みだがまだ同期されていない → 空データ + fc_synced_at=null
    return NextResponse.json({
      reservations: [],
      memberSummary: {
        displayName: '',
        membershipType: '',
        totalAttendance: 0,
        homeStore: '',
      },
      monthlySubscription: {
        used: 0,
        total: 0,
        limit: null,
        currentMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      },
      tickets: [],
      rentalSubscriptions: [],
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
    lessonId: r.lesson_id,
    sidHash: r.sid_hash,
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

  // 今月の受講回数（attendance_history から）
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthStart = `${currentMonth}-01`;
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthEndStr = `${currentMonth}-${String(monthEnd.getDate()).padStart(2, '0')}`;

  const { data: historyRows } = await supabaseAdmin
    .from('attendance_history')
    .select('ticket_name')
    .eq('user_id', user.id)
    .eq('cancel_flg', 0)
    .gte('shift_date', monthStart)
    .lte('shift_date', monthEndStr);

  const totalMonthly = (historyRows || []).length;
  const subscriptionUsed = (historyRows || []).filter(r => {
    const t = r.ticket_name;
    return !t || t === '-' || t === '' || t === '他店利用チケット';
  }).length;

  const planLimit = parsePlanLimit(profile.fc_plan_name || '');

  // レンタル情報
  const rentalInfo = profile.fc_rental_info as { name: string; availableCount: number; availableCountFlg: boolean }[] | null;

  return NextResponse.json({
    reservations,
    memberSummary: {
      displayName: profile.fc_member_name || '',
      membershipType: profile.fc_plan_name || '',
      totalAttendance: 0, // DB キャッシュには totalAttendance がないが、フロントでは未使用
      homeStore: profile.fc_home_store || '',
    },
    monthlySubscription: {
      used: subscriptionUsed,
      total: totalMonthly,
      limit: planLimit,
      currentMonth,
    },
    tickets,
    rentalSubscriptions: rentalInfo || [],
    fcSyncedAt: profile.fc_synced_at,
  });
}
