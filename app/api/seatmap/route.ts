import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';
import { getSeatMap } from '@/lib/feelcycle-api';
import type { FeelcycleSession } from '@/lib/feelcycle-api';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const sidHash = request.nextUrl.searchParams.get('sidHash');
  if (!sidHash) {
    return NextResponse.json({ error: 'sidHash is required' }, { status: 400 });
  }

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

  try {
    const seatMap = await getSeatMap(fcSession, sidHash);
    return NextResponse.json(seatMap);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'SESSION_EXPIRED') {
      return NextResponse.json({ error: 'FEELCYCLEセッションが期限切れです', code: 'FC_SESSION_EXPIRED' }, { status: 401 });
    }
    console.error('SeatMap API error:', err);
    return NextResponse.json({ error: '座席マップの取得に失敗しました' }, { status: 500 });
  }
}
