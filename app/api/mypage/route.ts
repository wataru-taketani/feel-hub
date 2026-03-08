import { NextResponse } from 'next/server';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { getMypageWithReservations, getTickets } from '@/lib/feelcycle-api';
import type { FeelcycleSession } from '@/lib/feelcycle-api';
import { getFcSession, reauthSession } from '@/lib/fc-session';

async function fetchMypageData(fcSession: FeelcycleSession) {
  return Promise.allSettled([
    getMypageWithReservations(fcSession),
    getTickets(fcSession),
  ]);
}

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  const sessionResult = await getFcSession(user.id);
  if (!sessionResult.ok) {
    const status = sessionResult.code === 'FC_NOT_LINKED' ? 404 : 401;
    return NextResponse.json({ error: sessionResult.error, code: sessionResult.code }, { status });
  }
  let fcSession = sessionResult.session;

  let [mypageResult, ticketsResult] = await fetchMypageData(fcSession);

  // FC APIセッション切れ → 自動再認証してリトライ
  if (mypageResult.status === 'rejected') {
    const msg = mypageResult.reason instanceof Error ? mypageResult.reason.message : String(mypageResult.reason);
    if (msg === 'SESSION_EXPIRED') {
      const reauth = await reauthSession(user.id);
      if (!reauth.ok) {
        return NextResponse.json({ error: reauth.error, code: reauth.code }, { status: 401 });
      }
      fcSession = reauth.session;
      [mypageResult, ticketsResult] = await fetchMypageData(fcSession);
    }
    if (mypageResult.status === 'rejected') {
      console.error('Mypage API error:', mypageResult.reason);
      return NextResponse.json({ error: 'マイページ情報の取得に失敗しました' }, { status: 500 });
    }
  }

  const mypageData = mypageResult.value;
  const tickets = ticketsResult.status === 'fulfilled' ? ticketsResult.value : [];
  if (ticketsResult.status === 'rejected') {
    console.warn('Ticket fetch failed (non-fatal):', ticketsResult.reason instanceof Error ? ticketsResult.reason.message : ticketsResult.reason);
  }

  return NextResponse.json({
    mypage: mypageData.mypage,
    reservations: mypageData.reservations,
    tickets,
  });
}
