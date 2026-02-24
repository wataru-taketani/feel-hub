import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';
import { getProgramList } from '@/lib/feelcycle-api';
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

  // FCセッション取得
  const { data: sessionRow } = await supabaseAdmin
    .from('feelcycle_sessions')
    .select('session_encrypted, expires_at')
    .eq('user_id', user.id)
    .single();

  if (!sessionRow || new Date(sessionRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'セッションが期限切れです', code: 'FC_SESSION_EXPIRED' }, { status: 401 });
  }

  let fcSession: FeelcycleSession;
  try {
    fcSession = JSON.parse(decrypt(sessionRow.session_encrypted));
  } catch {
    return NextResponse.json({ error: 'セッションの復号に失敗しました' }, { status: 500 });
  }

  // プログラム一覧 + プログラム色 + 受講回数を並列取得
  const [programListResult, colorsResult, countsResult] = await Promise.allSettled([
    getProgramList(fcSession),
    supabaseAdmin.from('programs').select('program_name, color_code, text_color'),
    supabaseAdmin
      .from('attendance_history')
      .select('program_name')
      .eq('user_id', user.id)
      .eq('cancel_flg', 0),
  ]);

  if (programListResult.status === 'rejected') {
    const msg = programListResult.reason instanceof Error ? programListResult.reason.message : String(programListResult.reason);
    if (msg === 'SESSION_EXPIRED') {
      return NextResponse.json({ error: 'FEELCYCLEセッションが期限切れです', code: 'FC_SESSION_EXPIRED' }, { status: 401 });
    }
    return NextResponse.json({ error: 'プログラム一覧の取得に失敗しました' }, { status: 500 });
  }

  const programSeries = programListResult.value;

  // プログラム色マップ
  const colorMap: Record<string, { colorCode: string; textColor: string }> = {};
  if (colorsResult.status === 'fulfilled' && colorsResult.value.data) {
    for (const row of colorsResult.value.data) {
      colorMap[row.program_name] = { colorCode: row.color_code, textColor: row.text_color };
    }
  }

  // 受講回数マップ
  const countMap: Record<string, number> = {};
  if (countsResult.status === 'fulfilled' && countsResult.value.data) {
    for (const row of countsResult.value.data) {
      countMap[row.program_name] = (countMap[row.program_name] || 0) + 1;
    }
  }

  // マージ
  let total = 0;
  let taken = 0;
  const series = programSeries.map((s) => {
    const programs = s.programs.map((p) => {
      total++;
      const count = countMap[p.name] || 0;
      if (count > 0) taken++;
      const color = colorMap[p.name];
      return {
        id: p.id,
        name: p.name,
        colorCode: color?.colorCode || '#6B7280',
        textColor: color?.textColor || '#FFFFFF',
        count,
      };
    });
    return { seriesName: s.seriesName, programs };
  });

  return NextResponse.json({
    series,
    summary: { total, taken },
  });
}
