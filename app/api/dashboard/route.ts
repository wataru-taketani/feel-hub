import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';
import { getMypageWithReservations, getTickets, getLessonHistory } from '@/lib/feelcycle-api';
import type { FeelcycleSession } from '@/lib/feelcycle-api';
import { upsertHistory } from '@/lib/history-sync';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * プラン名から月間上限回数を抽出（例: "マンスリー30" → 30）
 */
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

  // FEELCYCLEセッションを取得・復号
  const { data: sessionRow } = await supabaseAdmin
    .from('feelcycle_sessions')
    .select('session_encrypted, expires_at')
    .eq('user_id', user.id)
    .single();

  if (!sessionRow || new Date(sessionRow.expires_at) < new Date()) {
    const { data: creds } = await supabaseAdmin
      .from('feelcycle_credentials')
      .select('user_id')
      .eq('user_id', user.id)
      .single();

    if (creds) {
      return NextResponse.json({ error: 'セッションが期限切れです', code: 'FC_SESSION_EXPIRED' }, { status: 401 });
    }
    return NextResponse.json({ error: 'FEELCYCLE未連携', code: 'FC_NOT_LINKED' }, { status: 404 });
  }

  let fcSession: FeelcycleSession;
  try {
    fcSession = JSON.parse(decrypt(sessionRow.session_encrypted));
  } catch {
    return NextResponse.json({ error: 'セッションの復号に失敗しました' }, { status: 500 });
  }

  // マイページ情報 + チケット情報 + 今月の履歴 を並列取得
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [mypageResult, ticketsResult, historyResult, rentalResult] = await Promise.allSettled([
    getMypageWithReservations(fcSession),
    getTickets(fcSession),
    getLessonHistory(fcSession, currentMonth),
    fetchRentalSubscription(fcSession),
  ]);

  if (mypageResult.status === 'rejected') {
    const msg = mypageResult.reason instanceof Error ? mypageResult.reason.message : String(mypageResult.reason);
    if (msg === 'SESSION_EXPIRED') {
      return NextResponse.json({ error: 'FEELCYCLEセッションが期限切れです', code: 'FC_SESSION_EXPIRED' }, { status: 401 });
    }
    console.error('Dashboard mypage error:', mypageResult.reason);
    return NextResponse.json({ error: 'データの取得に失敗しました' }, { status: 500 });
  }

  const mypageData = mypageResult.value;
  const tickets = ticketsResult.status === 'fulfilled' ? ticketsResult.value : [];
  if (ticketsResult.status === 'rejected') {
    console.warn('Dashboard ticket fetch failed:', ticketsResult.reason instanceof Error ? ticketsResult.reason.message : ticketsResult.reason);
  }

  // 今月の受講回数をFEELCYCLE APIから直接取得（常に最新）
  let totalMonthly = 0;
  let subscriptionUsed = 0;

  if (historyResult.status === 'fulfilled') {
    const records = historyResult.value.filter(r => r.cancelFlg === 0);
    totalMonthly = records.length;

    // サブスク利用 = ticketNameが空/null/"-"または"他店利用チケット"のもの
    subscriptionUsed = records.filter(r => {
      const t = r.ticketName;
      return !t || t === '-' || t === '' || t === '他店利用チケット';
    }).length;

    // DBも同期（バックグラウンド、エラー無視）
    upsertHistory(supabaseAdmin, user.id, historyResult.value, currentMonth).catch(e =>
      console.warn('Dashboard history sync failed:', e)
    );
  } else {
    console.warn('Dashboard history fetch failed:', historyResult.reason instanceof Error ? historyResult.reason.message : historyResult.reason);
    // フォールバック: DBから取得
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

  // 予約データにlessonId, sidHashを付与（lessonsテーブルと突合）
  // FC APIの reservation_store は "上大岡（KOK）"、DBのstudioは "上大岡" なのでカッコ除去で正規化
  // Batch: collect all unique (date, time, program, studio) combos
  const reservationKeys = mypageData.reservations.map(r => ({
    date: r.date,
    time: r.startTime + ':00',
    programName: r.programName,
    studio: r.studio.replace(/（.*）/, ''),
  }));

  // Single query with OR conditions
  const { data: allLessonRows } = await supabaseAdmin
    .from('lessons')
    .select('id, sid_hash, date, time, program_name, studio')
    .in('date', [...new Set(reservationKeys.map(k => k.date))])
    .in('time', [...new Set(reservationKeys.map(k => k.time))]);

  // Build lookup map
  const lessonMap = new Map<string, { id: string; sidHash: string | null }>();
  for (const row of (allLessonRows || [])) {
    const key = `${row.date}_${row.time}_${row.program_name}_${row.studio}`;
    lessonMap.set(key, { id: row.id, sidHash: row.sid_hash });
  }

  // Enrich without N+1
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

  // レンタルサブスク情報
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
