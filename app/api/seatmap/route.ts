import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { getSeatMap } from '@/lib/feelcycle-api';
import { getFcSession, reauthSession } from '@/lib/fc-session';

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

  const result = await getFcSession(user.id);
  if (!result.ok) {
    const status = result.code === 'FC_NOT_LINKED' ? 404 : 401;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  try {
    const seatMap = await getSeatMap(result.session, sidHash);
    return NextResponse.json(seatMap);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'SESSION_EXPIRED') {
      // FC API側のセッション切れ → 自動再認証してリトライ
      const reauth = await reauthSession(user.id);
      if (!reauth.ok) {
        return NextResponse.json({ error: reauth.error, code: reauth.code }, { status: 401 });
      }
      try {
        const seatMap = await getSeatMap(reauth.session, sidHash);
        return NextResponse.json(seatMap);
      } catch (retryErr) {
        console.error('SeatMap retry after reauth failed:', retryErr);
        return NextResponse.json({ error: '座席マップの取得に失敗しました' }, { status: 500 });
      }
    }
    console.error('SeatMap API error:', err);
    return NextResponse.json({ error: '座席マップの取得に失敗しました' }, { status: 500 });
  }
}
