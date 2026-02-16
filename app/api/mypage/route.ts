import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';
import { getMypageWithReservations, getTickets } from '@/lib/feelcycle-api';
import type { FeelcycleSession } from '@/lib/feelcycle-api';

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

  // FEELCYCLEセッションを取得・復号
  const { data: sessionRow } = await supabaseAdmin
    .from('feelcycle_sessions')
    .select('session_encrypted, expires_at')
    .eq('user_id', user.id)
    .single();

  if (!sessionRow || new Date(sessionRow.expires_at) < new Date()) {
    // セッションなし or 期限切れ → credentials があれば自動再認証可能
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

  // マイページ情報 + チケット情報を並列取得
  const [mypageResult, ticketsResult] = await Promise.allSettled([
    getMypageWithReservations(fcSession),
    getTickets(fcSession),
  ]);

  if (mypageResult.status === 'rejected') {
    const msg = mypageResult.reason instanceof Error ? mypageResult.reason.message : String(mypageResult.reason);
    if (msg === 'SESSION_EXPIRED') {
      return NextResponse.json({ error: 'FEELCYCLEセッションが期限切れです', code: 'FC_SESSION_EXPIRED' }, { status: 401 });
    }
    console.error('Mypage API error:', mypageResult.reason);
    return NextResponse.json({ error: 'マイページ情報の取得に失敗しました' }, { status: 500 });
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
