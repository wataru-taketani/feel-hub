import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { getMypageWithReservations } from '@/lib/feelcycle-api';
import { getFcSession, reauthSession } from '@/lib/fc-session';

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

  // FEELCYCLEセッション取得（DB期限切れなら自動再認証）
  const sessionResult = await getFcSession(user.id);
  if (!sessionResult.ok) {
    const status = sessionResult.code === 'FC_NOT_LINKED' ? 404 : 401;
    return NextResponse.json({ error: sessionResult.error, code: sessionResult.code }, { status });
  }
  let fcSession = sessionResult.session;

  // FC APIから予約一覧のみ取得
  let mypageData;
  try {
    mypageData = await getMypageWithReservations(fcSession);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'SESSION_EXPIRED') {
      // FC APIセッション切れ → 自動再認証してリトライ
      const reauth = await reauthSession(user.id);
      if (!reauth.ok) {
        return NextResponse.json({ error: reauth.error, code: reauth.code }, { status: 401 });
      }
      fcSession = reauth.session;
      try {
        mypageData = await getMypageWithReservations(fcSession);
      } catch (e2) {
        console.error('Reservations API retry error:', e2);
        return NextResponse.json({ error: 'データの取得に失敗しました' }, { status: 500 });
      }
    } else {
      console.error('Reservations API error:', e);
      return NextResponse.json({ error: 'データの取得に失敗しました' }, { status: 500 });
    }
  }

  // 予約データにlessonId, sidHashを付与（dashboardと同じバッチルックアップ）
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

  return NextResponse.json({
    reservations: enrichedReservations,
    homeStore: mypageData.mypage.homeStore,
  });
}
