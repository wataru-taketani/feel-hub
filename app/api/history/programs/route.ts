import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/lib/supabase/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** 表記ゆれ吸収用の正規化（BB2 UPGD 1のダブルスペース等のフォールバック） */
function normalizeProgram(name: string): string {
  return name
    .toUpperCase()
    .replace(/＆/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 自然順ソート（"Hit 1, Hit 2, ..., Hit 10" の順にする） */
function naturalCompare(a: string, b: string): number {
  const re = /(\d+)|(\D+)/g;
  const aParts = a.match(re) || [];
  const bParts = b.match(re) || [];
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    if (i >= aParts.length) return -1;
    if (i >= bParts.length) return 1;
    const aIsNum = /^\d+$/.test(aParts[i]);
    const bIsNum = /^\d+$/.test(bParts[i]);
    if (aIsNum && bIsNum) {
      const diff = parseInt(aParts[i], 10) - parseInt(bParts[i], 10);
      if (diff !== 0) return diff;
    } else {
      const cmp = aParts[i].localeCompare(bParts[i]);
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

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
    const normalized = normalizeProgram(row.program_name);
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
      programs: seriesMap.get(s)!.sort((a, b) => naturalCompare(a.name, b.name)),
    }));

  return NextResponse.json({
    series,
    summary: { total, taken },
  });
}
