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

  if (!sessionRow) {
    return NextResponse.json({ error: 'FEELCYCLE未連携', code: 'FC_NOT_LINKED' }, { status: 404 });
  }

  if (new Date(sessionRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'セッションが期限切れです', code: 'FC_SESSION_EXPIRED' }, { status: 401 });
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

  const [mypageResult, ticketsResult, historyResult] = await Promise.allSettled([
    getMypageWithReservations(fcSession),
    getTickets(fcSession),
    getLessonHistory(fcSession, currentMonth),
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

  return NextResponse.json({
    reservations: mypageData.reservations,
    memberSummary: {
      displayName: mypageData.mypage.displayName,
      membershipType: mypageData.mypage.membershipType,
      totalAttendance: mypageData.mypage.totalAttendance,
    },
    monthlySubscription: {
      used: subscriptionUsed,
      total: totalMonthly,
      limit: planLimit,
      currentMonth,
    },
    tickets,
  });
}
