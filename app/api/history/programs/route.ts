import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/lib/supabase/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** musicページ名と受講履歴名の表記ゆれを正規化してマッチングする */
function normalizeProgram(name: string): string {
  let n = name
    .toUpperCase()
    .replace(/['']/g, '')      // 10's → 10S, X'mas → XMAS
    .replace(/-/g, ' ')         // 3Y-1 → 3Y 1
    .replace(/＆/g, '&')        // 全角→半角アンパサンド
    .replace(/!/g, 'I')         // P!NK → PINK
    .replace(/\s+/g, ' ')      // 連続スペース統合
    .trim();
  // 末尾が「英字+数字」の場合スペース挿入: MJ2→MJ 2, DUA LIPA2→DUA LIPA 2
  n = n.replace(/([A-Z])(\d+)$/, '$1 $2');
  return n;
}

// 正規化でも吸収できない既知の差異
const PROGRAM_ALIASES: Record<string, string> = {
  'BB2 R&B': 'BB2 R&B 1',
};

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  // プログラムマスター（series付き）+ 受講回数を並列取得
  const [programsResult, countsResult] = await Promise.allSettled([
    supabaseAdmin
      .from('programs')
      .select('program_name, series, color_code, text_color')
      .not('series', 'is', null)
      .order('series')
      .order('program_name'),
    supabaseAdmin
      .from('attendance_history')
      .select('program_name')
      .eq('user_id', user.id)
      .eq('cancel_flg', 0)
      .limit(10000),
  ]);

  if (programsResult.status === 'rejected' || !programsResult.value.data) {
    return NextResponse.json({ error: 'プログラムデータの取得に失敗しました' }, { status: 500 });
  }

  // 正規化済み受講回数マップ
  const countMap: Record<string, number> = {};
  if (countsResult.status === 'fulfilled' && countsResult.value.data) {
    for (const row of countsResult.value.data) {
      const key = normalizeProgram(row.program_name);
      countMap[key] = (countMap[key] || 0) + 1;
    }
  }

  // シリーズ別にグルーピング
  const seriesMap = new Map<string, { name: string; colorCode: string; textColor: string; count: number }[]>();
  let total = 0;
  let taken = 0;

  for (const row of programsResult.value.data) {
    const series = row.series as string;
    if (!seriesMap.has(series)) {
      seriesMap.set(series, []);
    }
    let normalized = normalizeProgram(row.program_name);
    if (PROGRAM_ALIASES[normalized]) {
      normalized = PROGRAM_ALIASES[normalized];
    }
    const count = countMap[normalized] || 0;
    total++;
    if (count > 0) taken++;
    seriesMap.get(series)!.push({
      name: row.program_name,
      colorCode: row.color_code,
      textColor: row.text_color,
      count,
    });
  }

  // シリーズ順序: BB1, BB2, BB3, BSB, BSBi, BSL, BSW, BSWi, OTHER
  const seriesOrder = ['BB1', 'BB2', 'BB3', 'BSW', 'BSWi', 'BSL', 'BSB', 'BSBi', 'OTHER'];
  const series = seriesOrder
    .filter((s) => seriesMap.has(s))
    .map((s) => ({
      seriesName: s,
      programs: seriesMap.get(s)!,
    }));

  return NextResponse.json({
    series,
    summary: { total, taken },
  });
}
