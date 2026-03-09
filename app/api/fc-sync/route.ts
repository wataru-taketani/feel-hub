import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { getMypageWithReservations, getTickets } from '@/lib/feelcycle-api';
import type { FeelcycleSession, ReservationInfo, TicketInfo } from '@/lib/feelcycle-api';
import { getFcSession, reauthSession } from '@/lib/fc-session';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

/** FC APIからデータを一括取得 */
async function fetchAllFcData(fcSession: FeelcycleSession) {
  return Promise.allSettled([
    getMypageWithReservations(fcSession),
    getTickets(fcSession),
    fetchRentalSubscription(fcSession),
  ]);
}

/** 予約データにlessonId, sidHashを付与 */
async function enrichReservations(reservations: ReservationInfo[]) {
  if (reservations.length === 0) return [];

  const reservationKeys = reservations.map(r => ({
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

  return reservations.map(r => {
    const studioNormalized = r.studio.replace(/（.*）/, '');
    const key = `${r.date}_${r.startTime}:00_${r.programName}_${studioNormalized}`;
    const lesson = lessonMap.get(key);
    return {
      ...r,
      lessonId: lesson?.id ?? null,
      sidHash: lesson?.sidHash ?? null,
    };
  });
}

/** DB に予約データを保存（全件洗い替え） */
async function saveReservations(
  userId: string,
  reservations: (ReservationInfo & { lessonId: string | null; sidHash: string | null })[]
) {
  // 既存を削除
  await supabaseAdmin
    .from('user_reservations')
    .delete()
    .eq('user_id', userId);

  if (reservations.length === 0) return;

  const rows = reservations.map(r => ({
    user_id: userId,
    date: r.date,
    start_time: r.startTime,
    end_time: r.endTime,
    program_name: r.programName,
    instructor: r.instructor,
    studio: r.studio,
    sheet_no: r.sheetNo || null,
    lesson_id: r.lessonId,
    sid_hash: r.sidHash,
    ticket_name: r.ticketName || null,
    bg_color: r.bgColor || null,
    text_color: r.textColor || null,
    playlist_url: r.playlistUrl || null,
    cancel_wait_total: r.cancelWaitTotal || 0,
    cancel_wait_position: r.cancelWaitPosition || 0,
    payment_method: r.paymentMethod || 0,
  }));

  await supabaseAdmin
    .from('user_reservations')
    .insert(rows);
}

/** DB にチケットデータを保存（全件洗い替え） */
async function saveTickets(userId: string, tickets: TicketInfo[]) {
  await supabaseAdmin
    .from('user_tickets')
    .delete()
    .eq('user_id', userId);

  if (tickets.length === 0) return;

  const rows = tickets.map(t => ({
    user_id: userId,
    ticket_name: t.name,
    total_lot: t.totalCount,
    details: t.details,
  }));

  await supabaseAdmin
    .from('user_tickets')
    .insert(rows);
}

/** user_profiles に FC 会員情報を保存 */
async function saveProfileFcData(
  userId: string,
  mypage: { displayName: string; homeStore: string; membershipType: string; monthlyClubFee: number | null; longPlan: { name: string; discountEndDate: string } | null },
  rentalInfo: { name: string; availableCount: number; availableCountFlg: boolean }[]
) {
  await supabaseAdmin
    .from('user_profiles')
    .update({
      fc_member_name: mypage.displayName,
      fc_home_store: mypage.homeStore,
      fc_plan_name: mypage.membershipType,
      fc_monthly_fee: mypage.monthlyClubFee,
      fc_long_plan: mypage.longPlan,
      fc_rental_info: rentalInfo.length > 0 ? rentalInfo : null,
      fc_synced_at: new Date().toISOString(),
    })
    .eq('id', userId);
}

export async function POST() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  // FC セッション取得
  const sessionResult = await getFcSession(user.id);
  if (!sessionResult.ok) {
    const status = sessionResult.code === 'FC_NOT_LINKED' ? 404 : 401;
    return NextResponse.json({ error: sessionResult.error, code: sessionResult.code }, { status });
  }
  let fcSession = sessionResult.session;

  // FC API 一括取得
  let [mypageResult, ticketsResult, rentalResult] = await fetchAllFcData(fcSession);

  // SESSION_EXPIRED → 再認証してリトライ
  if (mypageResult.status === 'rejected') {
    const msg = mypageResult.reason instanceof Error ? mypageResult.reason.message : String(mypageResult.reason);
    if (msg === 'SESSION_EXPIRED') {
      const reauth = await reauthSession(user.id);
      if (!reauth.ok) {
        return NextResponse.json({ error: reauth.error, code: reauth.code }, { status: 401 });
      }
      fcSession = reauth.session;
      [mypageResult, ticketsResult, rentalResult] = await fetchAllFcData(fcSession);
    }
    if (mypageResult.status === 'rejected') {
      console.error('fc-sync mypage error:', mypageResult.reason);
      return NextResponse.json({ error: 'FC同期に失敗しました' }, { status: 500 });
    }
  }

  const mypageData = mypageResult.value;
  const tickets = ticketsResult.status === 'fulfilled' ? ticketsResult.value : [];
  const rentalInfo = rentalResult.status === 'fulfilled' ? rentalResult.value : [];

  // 予約データにlessonId, sidHashを付与
  const enrichedReservations = await enrichReservations(mypageData.reservations);

  // DB に保存（並列）
  await Promise.all([
    saveProfileFcData(user.id, mypageData.mypage, rentalInfo),
    saveReservations(user.id, enrichedReservations),
    saveTickets(user.id, tickets),
  ]);

  return NextResponse.json({ synced: true });
}
