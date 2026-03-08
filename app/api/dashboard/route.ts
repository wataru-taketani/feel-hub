import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { getMypageWithReservations, getTickets, getLessonHistory } from '@/lib/feelcycle-api';
import type { FeelcycleSession } from '@/lib/feelcycle-api';
import { upsertHistory } from '@/lib/history-sync';
import { getFcSession, reauthSession } from '@/lib/fc-session';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function parsePlanLimit(membershipType: string): number | null {
  const match = membershipType.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/** FC APIからダッシュボードデータを並列取得 */
async function fetchFcData(fcSession: FeelcycleSession, currentMonth: string) {
  return Promise.allSettled([
    getMypageWithReservations(fcSession),
    getTickets(fcSession),
    getLessonHistory(fcSession, currentMonth),
    fetchRentalSubscription(fcSession),
  ]);
}

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  // FEELCYCLEセッション取得（DB期限切れなら自動再認証）
  const sessionResult = await getFcSession(user.id);
  if (!sessionResult.ok) {
    const status = sessionResult.code === 'FC_NOT_LINKED' ? 404 : 401;
    return NextResponse.json({ error: sessionResult.error, code: sessionResult.code }, { status });
  }
  let fcSession = sessionResult.session;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // FC APIデータ並列取得
  let [mypageResult, ticketsResult, historyResult, rentalResult] = await fetchFcData(fcSession, currentMonth);

  // FC APIセッション切れ → 自動再認証して全データ再取得
  if (mypageResult.status === 'rejected') {
    const msg = mypageResult.reason instanceof Error ? mypageResult.reason.message : String(mypageResult.reason);
    if (msg === 'SESSION_EXPIRED') {
      const reauth = await reauthSession(user.id);
      if (!reauth.ok) {
        return NextResponse.json({ error: reauth.error, code: reauth.code }, { status: 401 });
      }
      fcSession = reauth.session;
      [mypageResult, ticketsResult, historyResult, rentalResult] = await fetchFcData(fcSession, currentMonth);
    }
    if (mypageResult.status === 'rejected') {
      console.error('Dashboard mypage error:', mypageResult.reason);
      return NextResponse.json({ error: 'データの取得に失敗しました' }, { status: 500 });
    }
  }

  const mypageData = mypageResult.value;
  const tickets = ticketsResult.status === 'fulfilled' ? ticketsResult.value : [];
  if (ticketsResult.status === 'rejected') {
    console.warn('Dashboard ticket fetch failed:', ticketsResult.reason instanceof Error ? ticketsResult.reason.message : ticketsResult.reason);
  }

  // 今月の受講回数
  let totalMonthly = 0;
  let subscriptionUsed = 0;

  if (historyResult.status === 'fulfilled') {
    const records = historyResult.value.filter(r => r.cancelFlg === 0);
    totalMonthly = records.length;
    subscriptionUsed = records.filter(r => {
      const t = r.ticketName;
      return !t || t === '-' || t === '' || t === '他店利用チケット';
    }).length;

    upsertHistory(supabaseAdmin, user.id, historyResult.value, currentMonth).catch(e =>
      console.warn('Dashboard history sync failed:', e)
    );
  } else {
    console.warn('Dashboard history fetch failed:', historyResult.reason instanceof Error ? historyResult.reason.message : historyResult.reason);
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

    totalMonthly = (historyRows || []).length;
    subscriptionUsed = (historyRows || []).filter(r => {
      const t = r.ticket_name;
      return !t || t === '-' || t === '' || t === '他店利用チケット';
    }).length;
  }

  const planLimit = parsePlanLimit(mypageData.mypage.membershipType);

  // 予約データにlessonId, sidHashを付与
  const reservationKeys = mypageData.reservations.map(r => ({
    date: r.date,
    time: r.startTime + ':00',
    programName: r.programName,
    studio: r.studio.replace(/（.*）/, ''),
  }));

  const { data: allLessonRows } = await supabaseAdmin
    .from('lessons')
    .select('id, sid_hash, date, time, program_name, studio')
    .in('date', [...new Set(reservationKeys.map(k => k.date))])
    .in('time', [...new Set(reservationKeys.map(k => k.time))]);

  const lessonMap = new Map<string, { id: string; sidHash: string | null }>();
  for (const row of (allLessonRows || [])) {
    const key = `${row.date}_${row.time}_${row.program_name}_${row.studio}`;
    lessonMap.set(key, { id: row.id, sidHash: row.sid_hash });
  }

  const enrichedReservations = mypageData.reservations.map(r => {
    const studioNormalized = r.studio.replace(/（.*）/, '');
    const key = `${r.date}_${r.startTime}:00_${r.programName}_${studioNormalized}`;
    const lesson = lessonMap.get(key);
    return {
      ...r,
      lessonId: lesson?.id ?? null,
      sidHash: lesson?.sidHash ?? null,
    };
  });

  let rentalSubscriptions: { name: string; availableCount: number; availableCountFlg: boolean }[] = [];
  if (rentalResult.status === 'fulfilled' && rentalResult.value) {
    rentalSubscriptions = rentalResult.value;
  }

  return NextResponse.json({
    reservations: enrichedReservations,
    memberSummary: {
      displayName: mypageData.mypage.displayName,
      membershipType: mypageData.mypage.membershipType,
      totalAttendance: mypageData.mypage.totalAttendance,
      homeStore: mypageData.mypage.homeStore,
    },
    monthlySubscription: {
      used: subscriptionUsed,
      total: totalMonthly,
      limit: planLimit,
      currentMonth,
    },
    tickets,
    rentalSubscriptions,
  });
}

const BASE_URL = 'https://m.feelcycle.com';

async function fetchRentalSubscription(
  session: FeelcycleSession
): Promise<{ name: string; availableCount: number; availableCountFlg: boolean }[]> {
  const res = await fetch(`${BASE_URL}/api/rental_item/select`, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      'X-Requested-With': 'XMLHttpRequest',
      'X-XSRF-TOKEN': session.xsrfToken,
      'X-CSRF-TOKEN': session.csrfToken,
      'Cookie': `XSRF-TOKEN=${encodeURIComponent(session.xsrfToken)}; laravel_session=${session.laravelSession}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) return [];

  const data = await res.json();
  const list = (data.current_contract_rental_item_list || []) as {
    name: string;
    available_count: number;
    available_count_flg: number;
  }[];

  return list.map((item) => ({
    name: item.name,
    availableCount: item.available_count,
    availableCountFlg: item.available_count_flg === 1,
  }));
}
