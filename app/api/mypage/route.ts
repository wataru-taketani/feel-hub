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

  if (!sessionRow) {
    return NextResponse.json({ error: 'セッションが見つかりません。再ログインしてください。' }, { status: 401 });
  }

  if (new Date(sessionRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'セッションが期限切れです。再ログインしてください。' }, { status: 401 });
  }

  let fcSession: FeelcycleSession;
  try {
    fcSession = JSON.parse(decrypt(sessionRow.session_encrypted));
  } catch {
    return NextResponse.json({ error: 'セッションの復号に失敗しました' }, { status: 500 });
  }

  // マイページ情報を取得（必須）
  let mypageData;
  try {
    mypageData = await getMypageWithReservations(fcSession);
  } catch (e) {
    if (e instanceof Error && e.message === 'SESSION_EXPIRED') {
      return NextResponse.json({ error: 'FEELCYCLEセッションが期限切れです。再ログインしてください。' }, { status: 401 });
    }
    console.error('Mypage API error:', e);
    return NextResponse.json({ error: 'マイページ情報の取得に失敗しました' }, { status: 500 });
  }

  // チケット情報を取得（失敗しても続行）
  let tickets: Awaited<ReturnType<typeof getTickets>> = [];
  try {
    tickets = await getTickets(fcSession);
  } catch (e) {
    console.warn('Ticket fetch failed (non-fatal):', e instanceof Error ? e.message : e);
  }

  return NextResponse.json({
    mypage: mypageData.mypage,
    reservations: mypageData.reservations,
    tickets,
  });
}
